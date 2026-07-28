import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, cleanup, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "./App";
import {
  mockProjects,
  mockStories,
  mockBlockers,
  mockDependencies,
} from "./test/fixtures";
import type { AppData } from "./types";

// Mutable store and overrides for the memory adapter
const mocks = vi.hoisted(() => {
  const mockAuth = {
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(),
    signInWithOAuth: vi.fn(),
    signOut: vi.fn(),
  };

  // Mutable data store - reset in beforeEach to fresh fixture copies
  const store = {
    data: null as AppData | null,
  };

  // Override for fetchAll (loading test, error test)
  let fetchAllOverride: (() => Promise<{ data: AppData | null; error: string | null }>) | null = null;

  // Override for updateStoryStatus (failure test for BLF-023)
  let updateStatusOverride: ((storyId: number, status: string) => { error?: string } | Promise<{ error?: string }>) | null = null;

  // Realtime subscription callback (BLF-015)
  let dataChangeCallback: (() => void) | null = null;

  return {
    mockAuth,
    store,
    get fetchAllOverride() { return fetchAllOverride; },
    set fetchAllOverride(v: typeof fetchAllOverride) { fetchAllOverride = v; },
    get updateStatusOverride() { return updateStatusOverride; },
    set updateStatusOverride(v: typeof updateStatusOverride) { updateStatusOverride = v; },
    get dataChangeCallback() { return dataChangeCallback; },
    set dataChangeCallback(v: typeof dataChangeCallback) { dataChangeCallback = v; },
    triggerDataChange() {
      // Snapshot store into a fresh reference so React detects the change
      if (dataChangeCallback && store.data) {
        store.data = {
          ...store.data,
          stories: [...store.data.stories],
          blockers: [...store.data.blockers],
          dependencies: [...store.data.dependencies],
        };
      }
      if (dataChangeCallback) dataChangeCallback();
    },
  };
});

// Mock supabase: only auth is needed; data access goes through the adapter
vi.mock("./supabase", () => ({
  supabase: {
    auth: mocks.mockAuth,
  },
}));

// Mock the Supabase adapter to return a memory adapter
vi.mock("./adapters/supabase-adapter", () => ({
  createSupabaseAdapter: () => ({
    fetchAll: async () => {
      if (mocks.fetchAllOverride) {
        return mocks.fetchAllOverride();
      }
      return { data: mocks.store.data, error: null };
    },
    updateStoryStatus: async (storyId: number, status: string) => {
      if (mocks.updateStatusOverride) {
        return mocks.updateStatusOverride(storyId, status);
      }
      if (!mocks.store.data) return { error: "No data loaded" };
      const story = mocks.store.data.stories.find((s) => s.id === storyId);
      if (!story) return { error: "Story not found" };
      story.status = status as never;
      // Snapshot store into fresh references so React detects the change
      // when fetchAll is called (e.g. via onRefresh after a transition).
      mocks.store.data = {
        ...mocks.store.data,
        stories: [...mocks.store.data.stories],
        blockers: [...mocks.store.data.blockers],
        dependencies: [...mocks.store.data.dependencies],
      };
      return {};
    },
    onDataChange: (cb: () => void) => {
      mocks.dataChangeCallback = cb;
      return () => {
        mocks.dataChangeCallback = null;
      };
    },
  }),
}));

function resetStore() {
  mocks.store.data = {
    projects: mockProjects.map((p) => ({ ...p })),
    stories: mockStories.map((s) => ({ ...s, acceptance_criteria: [...s.acceptance_criteria] })),
    blockers: mockBlockers.map((b) => ({ ...b })),
    dependencies: mockDependencies.map((d) => ({ ...d })),
  };
  mocks.fetchAllOverride = null;
  mocks.updateStatusOverride = null;
  mocks.dataChangeCallback = null;
}

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  localStorage.clear();
  resetStore();
  mocks.mockAuth.getSession.mockResolvedValue({ data: { session: null } });
  mocks.mockAuth.onAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
  });
});

describe("BLF-002: Board loads with Backlog column", () => {
  it("shows loading skeleton while fetching data", async () => {
    // Use a promise that never resolves to stay in loading state
    mocks.fetchAllOverride = () => new Promise(() => {});

    render(<App />);
    const skeletons = document.querySelectorAll(".skeleton-shimmer");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("renders skeleton cards that match the shape and layout of story cards", async () => {
    // Use a promise that never resolves to stay in loading state
    mocks.fetchAllOverride = () => new Promise(() => {});

    render(<App />);

    // Each SkeletonCard should have the same container classes as StoryCard
    const skeletonCards = document.querySelectorAll('[aria-hidden="true"]');
    expect(skeletonCards.length).toBeGreaterThanOrEqual(5);

    // Verify skeleton cards have the expected structure
    const firstSkeleton = skeletonCards[0];
    expect(firstSkeleton.classList.contains("bg-surface")).toBe(true);
    expect(firstSkeleton.classList.contains("rounded-xl")).toBe(true);

    // Each skeleton card should have shimmer elements
    const shimmerElements = firstSkeleton.querySelectorAll(".skeleton-shimmer");
    expect(shimmerElements.length).toBeGreaterThanOrEqual(6);
  });

  it("renders the Backlog column by default on first visit", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Backlog")).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText("Alpha Project")).toBeInTheDocument();
    });
  });

  it("displays story cards in the Backlog column", async () => {
    localStorage.setItem("backlog-last-project-id", "3"); // Contract IQ
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("CIQ-002")).toBeInTheDocument();
      expect(screen.getByText("CIQ-003")).toBeInTheDocument();
    });

    // CIQ-001 is done, not in backlog
    expect(screen.queryByText("CIQ-001")).not.toBeInTheDocument();
  });

  it("stories are sorted by priority then creation date", async () => {
    localStorage.setItem("backlog-last-project-id", "3");
    render(<App />);

    await waitFor(() => {
      const cards = screen.getAllByText(/CIQ-\d{3}/);
      expect(cards[0].textContent).toBe("CIQ-002"); // Priority 2 first
      expect(cards[1].textContent).toBe("CIQ-003"); // Priority 3 second
    });
  });

  it("shows story count for current column", async () => {
    localStorage.setItem("backlog-last-project-id", "3");
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("2 stories")).toBeInTheDocument();
    });
  });

  it("shows empty state when column has no stories", async () => {
    localStorage.setItem("backlog-last-project-id", "1"); // Alpha Project
    render(<App />);

    await waitFor(() => {
      expect(screen.getByLabelText("Done")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByLabelText("Done"));

    await waitFor(() => {
      expect(screen.getByText("Nothing in Done yet")).toBeInTheDocument();
    });
  });

  it("shows blocked indicator on stories with unresolved blockers", async () => {
    localStorage.setItem("backlog-last-project-id", "3");
    render(<App />);

    await waitFor(() => {
      expect(screen.getByLabelText("Blocked")).toBeInTheDocument();
    });
  });

  it("shows dependency count on stories with dependencies", async () => {
    localStorage.setItem("backlog-last-project-id", "3");
    render(<App />);

    await waitFor(() => {
      expect(screen.getByLabelText("1 dependencies")).toBeInTheDocument();
      expect(screen.getByLabelText("2 dependencies")).toBeInTheDocument();
    });
  });
});

describe("BLF-002: Project persistence via localStorage", () => {
  it("restores the last viewed project from localStorage", async () => {
    localStorage.setItem("backlog-last-project-id", "1");
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Alpha Project")).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText("AP-001")).toBeInTheDocument();
    });
  });

  it("defaults to first project alphabetically when no saved project", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Alpha Project")).toBeInTheDocument();
    });
  });

  it("saves the selected project to localStorage when switching", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Alpha Project")).toBeInTheDocument();
    });

    const select = screen.getByRole("combobox");
    await userEvent.selectOptions(select, "3");

    await waitFor(() => {
      expect(localStorage.getItem("backlog-last-project-id")).toBe("3");
    });
  });

  it("shows only the selected project's stories", async () => {
    localStorage.setItem("backlog-last-project-id", "1");
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("AP-001")).toBeInTheDocument();
    });

    expect(screen.queryByText("CIQ-002")).not.toBeInTheDocument();
  });
});

describe("BLF-002: No login required to view the board", () => {
  it("renders the board without authentication", async () => {
    localStorage.setItem("backlog-last-project-id", "3");
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Backlog")).toBeInTheDocument();
    });

    expect(screen.getByText("Sign In")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("CIQ-002")).toBeInTheDocument();
    });
  });

  it("shows 'Sign in to edit' in detail overlay when not authenticated", async () => {
    localStorage.setItem("backlog-last-project-id", "3");
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("CIQ-002")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText("CIQ-002"));

    await waitFor(() => {
      expect(screen.getByText("Sign in to edit")).toBeInTheDocument();
    });
  });
});

describe("BLF-002: Error and empty states", () => {
  it("shows error message when data fetch fails", async () => {
    mocks.fetchAllOverride = async () => ({
      data: null,
      error: "Network error",
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Failed to load data")).toBeInTheDocument();
    });
    expect(
      screen.getByText(
        "Could not load board data from the server. Please check your connection and try again.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Network error")).toBeInTheDocument();
    expect(screen.getByText("Try Again")).toBeInTheDocument();
  });

  it("error state has visual distinction from empty state", async () => {
    // Error state should have an error icon container
    mocks.fetchAllOverride = async () => ({
      data: null,
      error: "Test error",
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Failed to load data")).toBeInTheDocument();
    });

    // Error state should have the error icon (the red circle SVG is aria-hidden)
    const errorIcon = document.querySelector('[aria-hidden="true"]');
    expect(errorIcon).toBeInTheDocument();
    // The icon SVG should be inside a red-tinted circle container
    expect(errorIcon!.closest(".bg-red-500\\/10")).toBeInTheDocument();

    // Error state should NOT show "No projects found" (empty state text)
    expect(screen.queryByText("No projects found")).not.toBeInTheDocument();
  });

  it("shows empty state when no projects exist", async () => {
    mocks.store.data = {
      projects: [],
      stories: [],
      blockers: [],
      dependencies: [],
    };

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("No projects found")).toBeInTheDocument();
    });
  });
});

describe("BLF-003: Swipe navigation between columns", () => {
  const swipe = (element: Element, fromX: number, toX: number) => {
    fireEvent.touchStart(element, {
      touches: [{ clientX: fromX, clientY: 0 }],
    });
    fireEvent.touchEnd(element, {
      changedTouches: [{ clientX: toX, clientY: 0 }],
    });
  };

  const getSwipeableArea = (): Element => {
    const el = document.querySelector(".overflow-y-auto");
    if (!el) throw new Error("Could not find swipeable content area");
    return el;
  };

  it("swipe left advances to next column", async () => {
    localStorage.setItem("backlog-last-project-id", "3");
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Backlog")).toBeInTheDocument();
    });

    swipe(getSwipeableArea(), 300, 200);

    await waitFor(() => {
      expect(screen.getByText("Ready")).toBeInTheDocument();
    });
  });

  it("swipe right goes to previous column", async () => {
    localStorage.setItem("backlog-last-project-id", "3");
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Backlog")).toBeInTheDocument();
    });

    swipe(getSwipeableArea(), 300, 200);

    await waitFor(() => {
      expect(screen.getByText("Ready")).toBeInTheDocument();
    });

    swipe(getSwipeableArea(), 200, 300);

    await waitFor(() => {
      expect(screen.getByText("Backlog")).toBeInTheDocument();
    });
  });

  it("column title updates when swiping to a new column", async () => {
    localStorage.setItem("backlog-last-project-id", "3");
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Backlog")).toBeInTheDocument();
    });

    swipe(getSwipeableArea(), 300, 200);

    await waitFor(() => {
      expect(screen.getByText("Ready")).toBeInTheDocument();
    });

    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings[0].textContent).toBe("Ready");
  });

  it("does not navigate on small swipes below threshold", async () => {
    localStorage.setItem("backlog-last-project-id", "3");
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Backlog")).toBeInTheDocument();
    });

    swipe(getSwipeableArea(), 300, 250);

    await waitFor(() => {
      expect(screen.getByText("Backlog")).toBeInTheDocument();
    });
  });

  it("cannot swipe past the last column", async () => {
    localStorage.setItem("backlog-last-project-id", "3");
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Backlog")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByLabelText("Done"));

    await waitFor(() => {
      expect(screen.getByText("Done")).toBeInTheDocument();
    });

    swipe(getSwipeableArea(), 300, 200);

    await waitFor(() => {
      expect(screen.getByText("Done")).toBeInTheDocument();
    });

    const nextButton = screen.getByLabelText("Next column");
    expect(nextButton).toBeDisabled();
  });

  it("cannot swipe before the first column", async () => {
    localStorage.setItem("backlog-last-project-id", "3");
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Backlog")).toBeInTheDocument();
    });

    swipe(getSwipeableArea(), 200, 400);

    await waitFor(() => {
      expect(screen.getByText("Backlog")).toBeInTheDocument();
    });

    const prevButton = screen.getByLabelText("Previous column");
    expect(prevButton).toBeDisabled();
  });

  it("applies spring animation class on swipe left", async () => {
    localStorage.setItem("backlog-last-project-id", "3");
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Backlog")).toBeInTheDocument();
    });

    swipe(getSwipeableArea(), 300, 200);

    await waitFor(() => {
      expect(screen.getByText("Ready")).toBeInTheDocument();
    });

    expect(
      getSwipeableArea().classList.contains("animate-spring-in-right"),
    ).toBe(true);
  });

  it("applies spring animation class on swipe right", async () => {
    localStorage.setItem("backlog-last-project-id", "3");
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Backlog")).toBeInTheDocument();
    });

    swipe(getSwipeableArea(), 300, 200);

    await waitFor(() => {
      expect(screen.getByText("Ready")).toBeInTheDocument();
    });

    swipe(getSwipeableArea(), 200, 300);

    await waitFor(() => {
      expect(screen.getByText("Backlog")).toBeInTheDocument();
    });

    expect(
      getSwipeableArea().classList.contains("animate-spring-in-left"),
    ).toBe(true);
  });
});

describe("BLF-004: Dot indicators show dash-style column position", () => {
  const COLUMNS = ["Backlog", "Ready", "In Progress", "In Review", "Done"];

  const getDotButtons = (): HTMLButtonElement[] => {
    return COLUMNS.map((label) => screen.getByLabelText(label));
  };

  it("renders all five dot indicators for the five active columns", async () => {
    localStorage.setItem("backlog-last-project-id", "3");
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Backlog")).toBeInTheDocument();
    });

    const dots = getDotButtons();
    expect(dots).toHaveLength(5);
    dots.forEach((dot) => {
      expect(dot.tagName).toBe("BUTTON");
    });
  });

  it("active dot is dash-shaped (w-6 h-1.5) with accent color", async () => {
    localStorage.setItem("backlog-last-project-id", "3");
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Backlog")).toBeInTheDocument();
    });

    // Initially Backlog is the active column (index 0)
    const activeDot = screen.getByLabelText("Backlog");
    expect(activeDot.className).toContain("w-6");
    expect(activeDot.className).toContain("h-1.5");
    expect(activeDot.className).toContain("bg-accent");
    // Active dot should not have the inactive muted color
    expect(activeDot.className).not.toContain("bg-text-muted");
  });

  it("inactive dots are uniform dash shapes (w-6 h-1) with muted color", async () => {
    localStorage.setItem("backlog-last-project-id", "3");
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Backlog")).toBeInTheDocument();
    });

    // All inactive dots should be uniform dashes
    const inactiveDots = COLUMNS.slice(1).map((label) => screen.getByLabelText(label));
    inactiveDots.forEach((dot) => {
      expect(dot.className).toContain("w-6");
      expect(dot.className).toContain("h-1");
      expect(dot.className).toContain("bg-text-muted/30");
    });
  });

  it("all five indicators use rounded-full for pill/dash shape", async () => {
    localStorage.setItem("backlog-last-project-id", "3");
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Backlog")).toBeInTheDocument();
    });

    getDotButtons().forEach((dot) => {
      expect(dot.className).toContain("rounded-full");
    });
  });

  it("clicking a dot navigates to its column and updates active indicator", async () => {
    localStorage.setItem("backlog-last-project-id", "3");
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Backlog")).toBeInTheDocument();
    });

    // Click the "Done" dot (index 4)
    await userEvent.click(screen.getByLabelText("Done"));

    await waitFor(() => {
      expect(screen.getByText("Done")).toBeInTheDocument();
    });

    // Now Done should be the active dot
    const activeDot = screen.getByLabelText("Done");
    expect(activeDot.className).toContain("bg-accent");
    expect(activeDot.className).toContain("h-1.5");

    // Backlog should now be inactive
    const inactiveDot = screen.getByLabelText("Backlog");
    expect(inactiveDot.className).toContain("bg-text-muted/30");
    expect(inactiveDot.className).toContain("h-1");
  });

  it("active dot is thicker than inactive dots (h-1.5 vs h-1)", async () => {
    localStorage.setItem("backlog-last-project-id", "3");
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Backlog")).toBeInTheDocument();
    });

    const activeDot = screen.getByLabelText("Backlog");
    const inactiveDot = screen.getByLabelText("Ready");

    expect(activeDot.className).toContain("h-1.5");
    expect(inactiveDot.className).toContain("h-1");
    // Both should be same width (w-6) for uniformity
    expect(activeDot.className).toContain("w-6");
    expect(inactiveDot.className).toContain("w-6");
  });
});

describe("BLF-008: Story detail overlay slides in from right", () => {
  it("renders overlay with slide-in-right animation class", async () => {
    localStorage.setItem("backlog-last-project-id", "3");
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("CIQ-002")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText("CIQ-002"));

    await waitFor(() => {
      expect(screen.getByText("Sign in to edit")).toBeInTheDocument();
    });

    const overlay = document.querySelector(".animate-slide-in-right");
    expect(overlay).toBeInTheDocument();
  });

  it("close button dismisses the overlay", async () => {
    localStorage.setItem("backlog-last-project-id", "3");
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("CIQ-002")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText("CIQ-002"));

    await waitFor(() => {
      expect(screen.getByText("Sign in to edit")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByLabelText("Close detail"));

    await waitFor(() => {
      expect(screen.queryByText("Sign in to edit")).not.toBeInTheDocument();
    });
  });

  it("overlay is full-screen", async () => {
    localStorage.setItem("backlog-last-project-id", "3");
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("CIQ-002")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText("CIQ-002"));

    await waitFor(() => {
      expect(screen.getByText("Sign in to edit")).toBeInTheDocument();
    });

    const overlay = document.querySelector(".animate-slide-in-right");
    expect(overlay).toBeInTheDocument();
    expect(overlay!.classList.contains("fixed")).toBe(true);
    expect(overlay!.classList.contains("inset-0")).toBe(true);
    expect(overlay!.classList.contains("z-50")).toBe(true);
  });
});

describe("BLF-009: Story detail overlay content sections", () => {
  it("shows description with proper whitespace rendering", async () => {
    localStorage.setItem("backlog-last-project-id", "3");
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("CIQ-002")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText("CIQ-002"));

    // Confirm overlay is open via the sign-in notice
    await waitFor(() => {
      expect(screen.getByText("Sign in to edit")).toBeInTheDocument();
    });

    // Description section heading is an H3
    const descHeadings = screen.getAllByText("Description");
    const descHeading = descHeadings.find((el) => el.tagName === "H3");
    expect(descHeading).toBeInTheDocument();

    // The description text appears on both the board card (line-clamp) and
    // in the detail overlay (whitespace-pre-wrap). The overlay version has
    // whitespace-pre-wrap for proper line break rendering.
    const descParas = screen.getAllByText("Implement GitHub OAuth login");
    const overlayDesc = descParas.find(
      (el) => el.tagName === "P" && el.className.includes("whitespace-pre-wrap"),
    );
    expect(overlayDesc).toBeInTheDocument();
  });

  it("shows acceptance criteria as numbered checklist", async () => {
    localStorage.setItem("backlog-last-project-id", "3");
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("CIQ-002")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText("CIQ-002"));

    await waitFor(() => {
      expect(screen.getByText("Sign in to edit")).toBeInTheDocument();
    });

    // Acceptance Criteria section heading
    expect(screen.getByText("Acceptance Criteria")).toBeInTheDocument();

    // The list should be rendered as <ol> (ordered/numbered checklist)
    const ol = document.querySelector("ol.list-decimal");
    expect(ol).toBeInTheDocument();

    // The AC items should be list items within the ordered list
    expect(screen.getByText("Login works")).toBeInTheDocument();
    expect(screen.getByText("Session persists")).toBeInTheDocument();
  });

  it("shows dependencies with status pills", async () => {
    localStorage.setItem("backlog-last-project-id", "3");
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("CIQ-002")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText("CIQ-002"));

    await waitFor(() => {
      expect(screen.getByText("Sign in to edit")).toBeInTheDocument();
    });

    // Dependencies section heading
    expect(screen.getByText("Dependencies")).toBeInTheDocument();

    // CIQ-002 depends on CIQ-001 which is done - should show Done pill
    expect(screen.getByText("Done")).toBeInTheDocument();

    // The dependency displays "CIQ-001 - Set up project scaffolding"
    // (story key plus title).
    expect(
      screen.getByText("CIQ-001 - Set up project scaffolding"),
    ).toBeInTheDocument();
  });

  it("shows unresolved blockers with red warning card and 'Blocked' label", async () => {
    localStorage.setItem("backlog-last-project-id", "3");
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("CIQ-002")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText("CIQ-002"));

    await waitFor(() => {
      expect(screen.getByText("Sign in to edit")).toBeInTheDocument();
    });

    // Blockers section heading
    expect(screen.getByText("Blockers")).toBeInTheDocument();

    // "Blocked" label in red for unresolved blocker
    expect(screen.getByText("Blocked")).toBeInTheDocument();

    // Unresolved blocker description
    expect(
      screen.getByText("Waiting on CIQ-001 completion"),
    ).toBeInTheDocument();
  });

  it("shows resolved blockers muted with line-through, green 'Resolved', opacity-60", async () => {
    // Add a resolved blocker to the store alongside the existing unresolved one
    mocks.store.data!.blockers.push({
      id: 2,
      story_id: 2,
      blocking_story_id: 3,
      description: "Resolved dependency issue",
      resolved_at: "2026-07-04T00:00:00Z",
      created_at: "2026-07-02T00:00:00Z",
    });

    localStorage.setItem("backlog-last-project-id", "3");
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("CIQ-002")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText("CIQ-002"));

    await waitFor(() => {
      expect(screen.getByText("Sign in to edit")).toBeInTheDocument();
    });

    // Should show "Resolved" label (green)
    expect(screen.getByText("Resolved")).toBeInTheDocument();

    // Resolved description should have line-through
    const resolvedDesc = screen.getByText("Resolved dependency issue");
    expect(resolvedDesc.className).toContain("line-through");

    // Both "Blocked" (unresolved) and "Resolved" should be there
    expect(screen.getByText("Blocked")).toBeInTheDocument();
  });

  it("StoryCard lock icon does NOT show when all blockers are resolved", async () => {
    // Set up only resolved blockers (no unresolved)
    mocks.store.data!.blockers = [
      {
        id: 2,
        story_id: 2,
        blocking_story_id: 3,
        description: "All clear now",
        resolved_at: "2026-07-04T00:00:00Z",
        created_at: "2026-07-02T00:00:00Z",
      },
    ];

    localStorage.setItem("backlog-last-project-id", "3");
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("CIQ-002")).toBeInTheDocument();
    });

    // With only resolved blockers, no lock icon should be shown
    await waitFor(() => {
      expect(screen.queryByLabelText("Blocked")).not.toBeInTheDocument();
    });
  });

  it("blocking story reference shows story key from in-memory allStories", async () => {
    localStorage.setItem("backlog-last-project-id", "3");
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("CIQ-002")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText("CIQ-002"));

    await waitFor(() => {
      expect(screen.getByText("Sign in to edit")).toBeInTheDocument();
    });

    // The unresolved blocker for CIQ-002 blocks on CIQ-001.
    // The blocker span shows the exact story key "CIQ-001" from in-memory
    // allStories lookup (not a Supabase join).
    expect(screen.getByText("CIQ-001")).toBeInTheDocument();

    // The blocking story key is resolved from in-memory allStories, not
    // from a Supabase join - Board resolves it via useMemo before passing
    // resolvedBlockers to StoryDetail.
  });
});

describe("BLF-012: Terminal view shows cancelled and failed across all projects", () => {
  it("opens Terminal view when Terminal button is clicked", async () => {
    localStorage.setItem("backlog-last-project-id", "3");
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Backlog")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText("Terminal"));

    await waitFor(() => {
      // Terminal view heading is visible
      const headings = screen.getAllByRole("heading", { level: 1 });
      expect(headings[0].textContent).toBe("Terminal");
    });
  });

  it("shows all terminal stories across all projects regardless of selected project", async () => {
    // Select Contract IQ (project 3) which has CIQ-004 (cancelled)
    localStorage.setItem("backlog-last-project-id", "3");
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Backlog")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText("Terminal"));

    await waitFor(() => {
      // CIQ-004 is cancelled (from Contract IQ)
      expect(screen.getByText("CIQ-004")).toBeInTheDocument();
      // BP-001 is failed (from Beta Project) - should appear even though Beta Project is not selected
      expect(screen.getByText("BP-001")).toBeInTheDocument();
    });
  });

  it("shows project name on each terminal story", async () => {
    localStorage.setItem("backlog-last-project-id", "3");
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Backlog")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText("Terminal"));

    await waitFor(() => {
      expect(screen.getByText("CIQ-004")).toBeInTheDocument();
    });

    // Contract IQ appears in both the project switcher dropdown and in the
    // terminal story cards (as the project name label)
    const contractIQElements = screen.getAllByText("Contract IQ");
    expect(contractIQElements.length).toBeGreaterThanOrEqual(2);

    // BP-001 is in Beta Project
    expect(screen.getByText("BP-001")).toBeInTheDocument();
    const betaProjectElements = screen.getAllByText("Beta Project");
    expect(betaProjectElements.length).toBeGreaterThanOrEqual(2);
  });

  it("groups terminal stories by status with section headers", async () => {
    localStorage.setItem("backlog-last-project-id", "3");
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Backlog")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText("Terminal"));

    await waitFor(() => {
      expect(screen.getByText("CIQ-004")).toBeInTheDocument();
    });

    // Section headers for each status group
    expect(screen.getByText("Cancelled (1)")).toBeInTheDocument();
    expect(screen.getByText("Failed (1)")).toBeInTheDocument();
  });

  it("each terminal story shows key, title, and status badge", async () => {
    localStorage.setItem("backlog-last-project-id", "3");
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Backlog")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText("Terminal"));

    await waitFor(() => {
      expect(screen.getByText("CIQ-004")).toBeInTheDocument();
    });

    // Key and title
    expect(screen.getByText("CIQ-004")).toBeInTheDocument();
    expect(screen.getByText("Cancelled story")).toBeInTheDocument();

    // Status badges
    const cancelledBadges = screen.getAllByText("Cancelled");
    expect(cancelledBadges.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Failed")).toBeInTheDocument();
  });

  it("shows empty state when no terminal stories exist", async () => {
    // Remove all terminal stories from the store
    mocks.store.data!.stories = mocks.store.data!.stories.filter(
      (s) => s.status !== "cancelled" && s.status !== "failed",
    );

    localStorage.setItem("backlog-last-project-id", "3");
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Backlog")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText("Terminal"));

    await waitFor(() => {
      expect(screen.getByText("No terminal stories")).toBeInTheDocument();
    });

    expect(
      screen.getByText("Cancelled and failed stories appear here"),
    ).toBeInTheDocument();
  });

  it("closes Terminal view and returns to board", async () => {
    localStorage.setItem("backlog-last-project-id", "3");
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Backlog")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText("Terminal"));

    await waitFor(() => {
      // Terminal view shows stories
      expect(screen.getByText("CIQ-004")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByLabelText("Close terminal view"));

    await waitFor(() => {
      expect(screen.queryByText("CIQ-004")).not.toBeInTheDocument();
      expect(screen.getByText("Backlog")).toBeInTheDocument();
    });
  });
});

describe("BLF-014: Filter stories by priority level", () => {
  const PRIORITIES = ["Critical", "High", "Medium", "Low"] as const;

  it("renders all four priority filter chips with labels", async () => {
    localStorage.setItem("backlog-last-project-id", "3");
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Backlog")).toBeInTheDocument();
    });

    PRIORITIES.forEach((label) => {
      const chip = screen.getByLabelText(`Filter ${label} priority`);
      expect(chip).toBeInTheDocument();
      expect(chip.tagName).toBe("BUTTON");
      expect(chip.textContent).toBe(label);
    });
  });

  it("all chips appear active (filled) when no filter is set", async () => {
    localStorage.setItem("backlog-last-project-id", "3");
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Backlog")).toBeInTheDocument();
    });

    PRIORITIES.forEach((label) => {
      const chip = screen.getByLabelText(`Filter ${label} priority`);
      expect(chip.className).toContain("text-white");
      expect(chip.className).toContain("border-transparent");
      // aria-pressed is false when no filter is active (size === 0)
      expect(chip.getAttribute("aria-pressed")).toBe("false");
    });
  });

  it("clicking a priority chip activates only that filter and sets aria-pressed", async () => {
    localStorage.setItem("backlog-last-project-id", "3");
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Backlog")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByLabelText("Filter High priority"));

    await waitFor(() => {
      // High should be active (aria-pressed true)
      const highChip = screen.getByLabelText("Filter High priority");
      expect(highChip.getAttribute("aria-pressed")).toBe("true");
      expect(highChip.className).toContain("text-white");

      // Other chips should be inactive
      const criticalChip = screen.getByLabelText("Filter Critical priority");
      expect(criticalChip.getAttribute("aria-pressed")).toBe("false");
      expect(criticalChip.className).toContain("text-text-muted");
    });
  });

  it("multiple priority chips can be selected simultaneously", async () => {
    localStorage.setItem("backlog-last-project-id", "3");
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Backlog")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByLabelText("Filter High priority"));
    await userEvent.click(screen.getByLabelText("Filter Medium priority"));

    await waitFor(() => {
      expect(
        screen.getByLabelText("Filter High priority").getAttribute("aria-pressed"),
      ).toBe("true");
      expect(
        screen.getByLabelText("Filter Medium priority").getAttribute("aria-pressed"),
      ).toBe("true");
    });

    // Critical and Low should still be inactive
    expect(
      screen.getByLabelText("Filter Critical priority").getAttribute("aria-pressed"),
    ).toBe("false");
    expect(
      screen.getByLabelText("Filter Low priority").getAttribute("aria-pressed"),
    ).toBe("false");
  });

  it("filters stories to only those matching the selected priority", async () => {
    localStorage.setItem("backlog-last-project-id", "3");
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Backlog")).toBeInTheDocument();
    });

    // Both CIQ-002 (High) and CIQ-003 (Medium) are in backlog for Contract IQ
    await waitFor(() => {
      expect(screen.getByText("CIQ-002")).toBeInTheDocument();
      expect(screen.getByText("CIQ-003")).toBeInTheDocument();
    });

    // Filter to only High priority
    await userEvent.click(screen.getByLabelText("Filter High priority"));

    await waitFor(() => {
      expect(screen.getByText("CIQ-002")).toBeInTheDocument();
      expect(screen.queryByText("CIQ-003")).not.toBeInTheDocument();
    });
  });

  it("clicking the last active chip returns to show-all state", async () => {
    localStorage.setItem("backlog-last-project-id", "3");
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Backlog")).toBeInTheDocument();
    });

    // First, filter to only High
    await userEvent.click(screen.getByLabelText("Filter High priority"));

    await waitFor(() => {
      expect(screen.queryByText("CIQ-003")).not.toBeInTheDocument();
    });

    // Click High again to deselect it (returns to empty set = show all)
    await userEvent.click(screen.getByLabelText("Filter High priority"));

    await waitFor(() => {
      expect(screen.getByText("CIQ-002")).toBeInTheDocument();
      expect(screen.getByText("CIQ-003")).toBeInTheDocument();
    });

    // All chips should appear active again
    PRIORITIES.forEach((label) => {
      const chip = screen.getByLabelText(`Filter ${label} priority`);
      expect(chip.getAttribute("aria-pressed")).toBe("false");
    });
  });

  it("shows empty column state when no stories match the selected priority", async () => {
    localStorage.setItem("backlog-last-project-id", "3");
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Backlog")).toBeInTheDocument();
    });

    // Filter to Critical priority - CIQ-001 is Critical but it's "done", not in backlog
    await userEvent.click(screen.getByLabelText("Filter Critical priority"));

    await waitFor(() => {
      expect(
        screen.getByText("Nothing in Backlog yet"),
      ).toBeInTheDocument();
    });
  });

  it("priority filter persists when switching columns", async () => {
    localStorage.setItem("backlog-last-project-id", "3");
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Backlog")).toBeInTheDocument();
    });

    // Select High priority filter
    await userEvent.click(screen.getByLabelText("Filter High priority"));

    await waitFor(() => {
      expect(screen.getByText("CIQ-002")).toBeInTheDocument();
    });

    // Navigate to Ready column via dash indicator click
    await userEvent.click(screen.getByLabelText("Ready"));

    await waitFor(() => {
      expect(screen.getByText("Ready")).toBeInTheDocument();
    });

    // High chip should still show as active (aria-pressed)
    const highChip = screen.getByLabelText("Filter High priority");
    expect(highChip.getAttribute("aria-pressed")).toBe("true");
  });

  it("inactive chip has outlined border style and muted text", async () => {
    localStorage.setItem("backlog-last-project-id", "3");
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Backlog")).toBeInTheDocument();
    });

    // Activate High to make others inactive
    await userEvent.click(screen.getByLabelText("Filter High priority"));

    await waitFor(() => {
      const lowChip = screen.getByLabelText("Filter Low priority");
      expect(lowChip.className).toContain("text-text-muted");
      expect(lowChip.className).toContain("border-border-subtle");
    });
  });
});

describe("BLF-013: Search clear button", () => {
  it("clear button is not visible when search term is empty", async () => {
    localStorage.setItem("backlog-last-project-id", "3");
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Backlog")).toBeInTheDocument();
    });

    // Clear button should NOT be present when search is empty
    expect(screen.queryByLabelText("Clear search")).not.toBeInTheDocument();
  });

  it("clear button appears when user types in search input", async () => {
    localStorage.setItem("backlog-last-project-id", "3");
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Backlog")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText("Search by title or key...") as HTMLInputElement;
    await userEvent.type(searchInput, "auth");

    // Clear button should now be visible
    expect(screen.getByLabelText("Clear search")).toBeInTheDocument();
  });

  it("clicking clear button resets search term and hides the button", async () => {
    localStorage.setItem("backlog-last-project-id", "3");
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Backlog")).toBeInTheDocument();
    });

    const searchInput: HTMLInputElement = screen.getByPlaceholderText("Search by title or key...");
    await userEvent.type(searchInput, "auth");

    // Search should filter to only matching stories
    await waitFor(() => {
      expect(screen.getByText("Add authentication")).toBeInTheDocument();
      expect(screen.queryByText("Build Kanban board")).not.toBeInTheDocument();
    });

    // Click the clear button
    await userEvent.click(screen.getByLabelText("Clear search"));

    // Input should be cleared
    expect(searchInput.value).toBe("");

    // All stories should be visible again
    await waitFor(() => {
      expect(screen.getByText("Add authentication")).toBeInTheDocument();
      expect(screen.getByText("Build Kanban board")).toBeInTheDocument();
    });

    // Clear button should be gone
    expect(screen.queryByLabelText("Clear search")).not.toBeInTheDocument();
  });

  it("clear button is visible when search term is non-empty on initial render", async () => {
    // This tests the UI state when search has content (e.g., via state initialization)
    localStorage.setItem("backlog-last-project-id", "3");
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Backlog")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText("Search by title or key...") as HTMLInputElement;
    await userEvent.type(searchInput, "kanban");

    // Search filters to matching story
    await waitFor(() => {
      expect(screen.getByText("Build Kanban board")).toBeInTheDocument();
      expect(screen.queryByText("Add authentication")).not.toBeInTheDocument();
    });

    // Clear button is visible
    const clearButton = screen.getByLabelText("Clear search");
    expect(clearButton).toBeInTheDocument();
    expect(clearButton.tagName).toBe("BUTTON");

    await userEvent.click(clearButton);

    // Search is cleared, input is empty
    await waitFor(() => {
      expect(searchInput.value).toBe("");
    });
  });
});

describe("BLF-015: Real-time board updates", () => {
  it("registers onDataChange subscription on mount", async () => {
    localStorage.setItem("backlog-last-project-id", "3");
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Backlog")).toBeInTheDocument();
    });

    // onDataChange callback should be registered
    expect(mocks.dataChangeCallback).not.toBeNull();
    expect(typeof mocks.dataChangeCallback).toBe("function");
  });

  it("deleted stories disappear without manual refresh when realtime event fires", async () => {
    localStorage.setItem("backlog-last-project-id", "3");
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Backlog")).toBeInTheDocument();
      expect(screen.getByText("CIQ-002")).toBeInTheDocument();
      expect(screen.getByText("CIQ-003")).toBeInTheDocument();
    });

    // Simulate story deletion externally
    mocks.store.data!.stories = mocks.store.data!.stories.filter(
      (s) => s.id !== 3,
    );

    // Fire the realtime callback
    mocks.triggerDataChange();

    await waitFor(() => {
      expect(screen.queryByText("CIQ-003")).not.toBeInTheDocument();
    });

    // CIQ-002 should still be there
    expect(screen.getByText("CIQ-002")).toBeInTheDocument();

    // Story count should decrease
    expect(screen.getByText("1 story")).toBeInTheDocument();
  });

  it("new stories appear without manual refresh when realtime event fires", async () => {
    localStorage.setItem("backlog-last-project-id", "3");
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Backlog")).toBeInTheDocument();
      expect(screen.getByText("CIQ-002")).toBeInTheDocument();
      expect(screen.getByText("CIQ-003")).toBeInTheDocument();
    });

    // Simulate a new story being added externally (by an agent)
    const newStory = {
      id: 10,
      project_id: 3,
      key: "CIQ-010",
      title: "New realtime story",
      description: "Created by an agent",
      status: "backlog" as const,
      acceptance_criteria: [],
      priority: 2,
      created_at: "2026-07-20T00:00:00Z",
      updated_at: "2026-07-20T00:00:00Z",
      reviewed_by: null,
    };
    mocks.store.data!.stories.push(newStory);

    // Fire the realtime callback
    mocks.triggerDataChange();

    await waitFor(() => {
      expect(screen.getByText("New realtime story")).toBeInTheDocument();
    });

    // Story count should update
    expect(screen.getByText("3 stories")).toBeInTheDocument();
  });

  it("cards move between columns when status changes via realtime", async () => {
    localStorage.setItem("backlog-last-project-id", "3");
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Backlog")).toBeInTheDocument();
      expect(screen.getByText("CIQ-003")).toBeInTheDocument();
    });

    // Simulate status being changed externally (by an agent)
    const story = mocks.store.data!.stories.find((s) => s.id === 3);
    expect(story).toBeDefined();
    story!.status = "in_progress";

    // Fire the realtime callback
    mocks.triggerDataChange();

    // CIQ-003 should be gone from Backlog
    await waitFor(() => {
      expect(screen.queryByText("CIQ-003")).not.toBeInTheDocument();
    });

    // Navigate to In Progress column
    const inProgressDot = screen.getByLabelText("In Progress");
    await userEvent.click(inProgressDot);

    // CIQ-003 should now be in In Progress
    await waitFor(() => {
      expect(screen.getByText("CIQ-003")).toBeInTheDocument();
    });
  });

  it("blocker changes propagate via realtime", async () => {
    localStorage.setItem("backlog-last-project-id", "3");
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Backlog")).toBeInTheDocument();
    });

    // CIQ-002 should have blocked indicator initially
    expect(screen.getByLabelText("Blocked")).toBeInTheDocument();

    // Simulate blocker being resolved externally
    const blocker = mocks.store.data!.blockers.find((b) => b.id === 1);
    expect(blocker).toBeDefined();
    blocker!.resolved_at = "2026-07-20T00:00:00Z";

    // Fire the realtime callback
    mocks.triggerDataChange();

    // Blocked indicator should be gone
    await waitFor(() => {
      expect(screen.queryByLabelText("Blocked")).not.toBeInTheDocument();
    });
  });
});

describe("BLF-016: Pull-to-refresh on board card list", () => {
  const getSwipeableArea = (): Element => {
    const el = document.querySelector(".overflow-y-auto");
    if (!el) throw new Error("Could not find swipeable content area");
    return el;
  };

  const pullDown = (element: Element, startY: number, endY: number) => {
    fireEvent.touchStart(element, {
      touches: [{ clientX: 100, clientY: startY }],
    });
    fireEvent.touchMove(element, {
      touches: [{ clientX: 100, clientY: endY }],
    });
  };

  const releasePull = (element: Element, endX: number, endY: number) => {
    fireEvent.touchEnd(element, {
      changedTouches: [{ clientX: endX, clientY: endY }],
    });
  };

  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    localStorage.clear();
    resetStore();
    mocks.mockAuth.getSession.mockResolvedValue({ data: { session: null } });
    mocks.mockAuth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
  });

  it("shows 'Pull to refresh' indicator when pulling down at scroll top", async () => {
    localStorage.setItem("backlog-last-project-id", "3");
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Backlog")).toBeInTheDocument();
    });

    const area = getSwipeableArea();

    // Pull down a moderate distance (below threshold)
    pullDown(area, 0, 80);

    await waitFor(() => {
      expect(screen.getByText("Pull to refresh")).toBeInTheDocument();
    });

    // Arrow should be pointing up (not rotated)
    const indicatorArea = document.querySelector("[aria-live='polite']");
    expect(indicatorArea).toBeInTheDocument();
    const arrowSvg = indicatorArea!.querySelector("svg");
    expect(arrowSvg).toBeInTheDocument();
    expect(arrowSvg!.classList.contains("rotate-180")).toBe(false);
  });

  it("shows 'Release to refresh' when pulled past threshold", async () => {
    localStorage.setItem("backlog-last-project-id", "3");
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Backlog")).toBeInTheDocument();
    });

    const area = getSwipeableArea();

    // Pull past the threshold (damped 60 requires raw ~120 with 0.5 damping)
    pullDown(area, 0, 150);

    await waitFor(() => {
      expect(screen.getByText("Release to refresh")).toBeInTheDocument();
    });

    // Arrow should be rotated 180deg
    const indicatorArea = document.querySelector("[aria-live='polite']");
    const arrowSvg = indicatorArea!.querySelector("svg");
    expect(arrowSvg!.classList.contains("rotate-180")).toBe(true);
  });

  it("triggers refetch and shows spinner when released past threshold", async () => {
    localStorage.setItem("backlog-last-project-id", "3");
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Backlog")).toBeInTheDocument();
      expect(screen.getByText("CIQ-002")).toBeInTheDocument();
    });

    const area = getSwipeableArea();

    // Simulate complete pull-to-refresh gesture
    pullDown(area, 0, 150);
    await waitFor(() => {
      expect(screen.getByText("Release to refresh")).toBeInTheDocument();
    });

    releasePull(area, 100, 150);

    // Should show refreshing spinner - verify both text and SVG in one waitFor
    await waitFor(() => {
      expect(screen.getByText("Refreshing...")).toBeInTheDocument();
      // Verify the spinner SVG is present (has animate-spin in class)
      const indicatorArea = document.querySelector("[aria-live='polite']");
      expect(indicatorArea).toBeTruthy();
      const svg = indicatorArea!.querySelector("svg");
      expect(svg).toBeTruthy();
      expect(svg!.className.baseVal || svg!.getAttribute("class")).toContain(
        "animate-spin",
      );
    });

    // After refresh completes, indicator should be gone
    await waitFor(() => {
      expect(screen.queryByText("Refreshing...")).not.toBeInTheDocument();
    });
  });

  it("board updates with fresh data after pull-to-refresh", async () => {
    localStorage.setItem("backlog-last-project-id", "3");
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("CIQ-002")).toBeInTheDocument();
    });

    const area = getSwipeableArea();

    // Modify the data store to simulate server-side data change
    mocks.store.data = {
      ...mocks.store.data!,
      stories: [
        ...mocks.store.data!.stories,
        {
          id: 99,
          project_id: 3,
          key: "CIQ-099",
          title: "Fresh data after refresh",
          description: "",
          status: "backlog",
          acceptance_criteria: [],
          priority: 3,
          created_at: "2026-07-20T00:00:00Z",
          updated_at: "2026-07-20T00:00:00Z",
          reviewed_by: null,
        },
      ],
    };

    // Pull and release past threshold
    pullDown(area, 0, 150);
    releasePull(area, 100, 150);

    // Fresh data should appear after refresh completes
    await waitFor(() => {
      expect(screen.getByText("Fresh data after refresh")).toBeInTheDocument();
    });

    // Original data should still be there
    expect(screen.getByText("CIQ-002")).toBeInTheDocument();

    // Story count should reflect the new story
    expect(screen.getByText("3 stories")).toBeInTheDocument();
  });

  it("works independently of Realtime subscription", async () => {
    // Clear the Realtime callback to simulate disconnected Realtime
    mocks.dataChangeCallback = null;

    localStorage.setItem("backlog-last-project-id", "3");
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("CIQ-002")).toBeInTheDocument();
    });

    // Modify data store while Realtime is "disconnected"
    mocks.store.data = {
      ...mocks.store.data!,
      stories: [
        ...mocks.store.data!.stories,
        {
          id: 77,
          project_id: 3,
          key: "CIQ-077",
          title: "Realtime disconnected refresh",
          description: "",
          status: "backlog",
          acceptance_criteria: [],
          priority: 4,
          created_at: "2026-07-20T00:00:00Z",
          updated_at: "2026-07-20T00:00:00Z",
          reviewed_by: null,
        },
      ],
    };

    const area = getSwipeableArea();
    pullDown(area, 0, 150);
    releasePull(area, 100, 150);

    // Even with Realtime disconnected, pull-to-refresh should work
    await waitFor(() => {
      expect(
        screen.getByText("Realtime disconnected refresh"),
      ).toBeInTheDocument();
    });
  });

  it("horizontal swipe still navigates columns without triggering pull", async () => {
    localStorage.setItem("backlog-last-project-id", "3");
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Backlog")).toBeInTheDocument();
    });

    const area = getSwipeableArea();

    // Swipe left (dominant horizontal movement)
    fireEvent.touchStart(area, {
      touches: [{ clientX: 300, clientY: 0 }],
    });
    fireEvent.touchEnd(area, {
      changedTouches: [{ clientX: 200, clientY: 5 }],
    });

    // Should navigate to next column, not show pull indicator
    await waitFor(() => {
      expect(screen.getByText("Ready")).toBeInTheDocument();
    });

    // Pull indicator should NOT be shown
    expect(screen.queryByText("Pull to refresh")).not.toBeInTheDocument();
    expect(screen.queryByText("Refreshing...")).not.toBeInTheDocument();
  });

  it("vertical pull at scroll top does not trigger horizontal swipe", async () => {
    localStorage.setItem("backlog-last-project-id", "3");
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Backlog")).toBeInTheDocument();
    });

    const area = getSwipeableArea();

    // Pull down (dominant vertical movement)
    pullDown(area, 0, 150);
    releasePull(area, 100, 150);

    // Should trigger refresh (shows spinner), not navigate
    await waitFor(() => {
      expect(screen.getByText("Refreshing...")).toBeInTheDocument();
    });

    // Should still be on Backlog column
    expect(screen.getByText("Backlog")).toBeInTheDocument();

    // Refresh spinner should eventually disappear
    await waitFor(() => {
      expect(screen.queryByText("Refreshing...")).not.toBeInTheDocument();
    });
  });

  it("pull below threshold without releasing does not trigger refresh", async () => {
    localStorage.setItem("backlog-last-project-id", "3");
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("CIQ-002")).toBeInTheDocument();
    });

    const area = getSwipeableArea();

    // Pull slightly but release below threshold
    pullDown(area, 0, 80);
    releasePull(area, 100, 80);

    // Should not show refreshing spinner
    expect(screen.queryByText("Refreshing...")).not.toBeInTheDocument();

    // Pull indicator should be gone
    await waitFor(() => {
      expect(screen.queryByText("Pull to refresh")).not.toBeInTheDocument();
    });
  });

  it("swipe during active pull resets pull state without triggering refresh", async () => {
    localStorage.setItem("backlog-last-project-id", "3");
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Backlog")).toBeInTheDocument();
    });

    const area = getSwipeableArea();

    // Start a pull that passes threshold
    pullDown(area, 0, 130);
    await waitFor(() => {
      expect(screen.getByText("Release to refresh")).toBeInTheDocument();
    });

    // Release with dominant horizontal swipe (deltaX=100 > deltaY=60, |deltaX| > 60)
    // pullStartRef was set to {x:100, y:0} by the pull
    // Horizontal swipe takes precedence: navigates left and resets pull
    fireEvent.touchEnd(area, {
      changedTouches: [{ clientX: 200, clientY: 60 }],
    });

    // Pull indicator should be gone (horizontal swipe resets pull state)
    await waitFor(() => {
      expect(screen.queryByText("Release to refresh")).not.toBeInTheDocument();
      expect(screen.queryByText("Pull to refresh")).not.toBeInTheDocument();
      expect(screen.queryByText("Refreshing...")).not.toBeInTheDocument();
    });
  });
});

describe("BLF-019: Sign in via GitHub OAuth from the board", () => {
  it("shows Sign In button on the board header when not authenticated", async () => {
    localStorage.setItem("backlog-last-project-id", "3");
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Backlog")).toBeInTheDocument();
    });

    // Sign In button is visible in the header
    expect(screen.getByText("Sign In")).toBeInTheDocument();
    expect(screen.queryByText("Sign Out")).not.toBeInTheDocument();
  });

  it("clicking Sign In initiates GitHub OAuth flow via Supabase Auth", async () => {
    localStorage.setItem("backlog-last-project-id", "3");
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Sign In")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText("Sign In"));

    expect(mocks.mockAuth.signInWithOAuth).toHaveBeenCalledWith({
      provider: "github",
      options: {
        redirectTo: window.location.origin + "/backlog-frontend/",
      },
    });
  });

  it("shows Sign Out button and hides Sign In when authenticated", async () => {
    mocks.mockAuth.getSession.mockResolvedValue({
      data: { session: { user: { id: "test-user" } } },
    });

    localStorage.setItem("backlog-last-project-id", "3");
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Backlog")).toBeInTheDocument();
    });

    expect(screen.getByText("Sign Out")).toBeInTheDocument();
    expect(screen.queryByText("Sign In")).not.toBeInTheDocument();
  });

  it("clicking Sign Out calls signOut and clears auth state", async () => {
    mocks.mockAuth.getSession.mockResolvedValue({
      data: { session: { user: { id: "test-user" } } },
    });

    localStorage.setItem("backlog-last-project-id", "3");
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Sign Out")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText("Sign Out"));

    expect(mocks.mockAuth.signOut).toHaveBeenCalled();
  });

  it("shows transition buttons in StoryDetail when authenticated instead of 'Sign in to edit'", async () => {
    mocks.mockAuth.getSession.mockResolvedValue({
      data: { session: { user: { id: "test-user" } } },
    });

    localStorage.setItem("backlog-last-project-id", "3");
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("CIQ-002")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText("CIQ-002"));

    await waitFor(() => {
      expect(screen.getByText("Transition")).toBeInTheDocument();
      expect(screen.queryByText("Sign in to edit")).not.toBeInTheDocument();
      expect(screen.getByText("Ready")).toBeInTheDocument();
      expect(screen.getByText("Cancelled")).toBeInTheDocument();
    });
  });

  it("performs transition and closes overlay after successful status update", async () => {
    mocks.mockAuth.getSession.mockResolvedValue({
      data: { session: { user: { id: "test-user" } } },
    });

    localStorage.setItem("backlog-last-project-id", "3");
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("CIQ-002")).toBeInTheDocument();
    });

    // Open detail overlay
    await userEvent.click(screen.getByText("CIQ-002"));

    await waitFor(() => {
      expect(screen.getByText("Transition")).toBeInTheDocument();
    });

    // CIQ-002 is in backlog, so "Ready" should be an available transition target
    const readyButton = screen.getByText("Ready");
    expect(readyButton).toBeInTheDocument();

    // Click the Ready transition button
    await userEvent.click(readyButton);

    // After successful transition, the overlay should close
    await waitFor(() => {
      expect(screen.queryByText("Transition")).not.toBeInTheDocument();
    });

    // Verify the story status was updated in the store
    const updatedStory = mocks.store.data!.stories.find((s) => s.id === 2);
    expect(updatedStory!.status).toBe("ready");
  });

  it("auth state change listener updates UI from unauthenticated to authenticated", async () => {
    // Capture the onAuthStateChange callback for later invocation
    let capturedCallback: ((event: string, session: unknown) => void) | null = null;
    mocks.mockAuth.onAuthStateChange.mockImplementation(
      (cb: (event: string, session: unknown) => void) => {
        capturedCallback = cb;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      },
    );

    localStorage.setItem("backlog-last-project-id", "3");
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Sign In")).toBeInTheDocument();
    });

    // Simulate Supabase firing the auth state change callback on sign in
    expect(capturedCallback).not.toBeNull();
    act(() => {
      capturedCallback!("SIGNED_IN", { user: { id: "test-user" } });
    });

    await waitFor(() => {
      expect(screen.getByText("Sign Out")).toBeInTheDocument();
      expect(screen.queryByText("Sign In")).not.toBeInTheDocument();
    });
  });

  it("auth state change listener updates UI from authenticated to unauthenticated", async () => {
    // Start authenticated
    mocks.mockAuth.getSession.mockResolvedValue({
      data: { session: { user: { id: "test-user" } } },
    });

    let capturedCallback: ((event: string, session: unknown) => void) | null = null;
    mocks.mockAuth.onAuthStateChange.mockImplementation(
      (cb: (event: string, session: unknown) => void) => {
        capturedCallback = cb;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      },
    );

    localStorage.setItem("backlog-last-project-id", "3");
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Sign Out")).toBeInTheDocument();
    });

    // Simulate Supabase firing the auth state change callback on sign out
    expect(capturedCallback).not.toBeNull();
    act(() => {
      capturedCallback!("SIGNED_OUT", null);
    });

    await waitFor(() => {
      expect(screen.getByText("Sign In")).toBeInTheDocument();
      expect(screen.queryByText("Sign Out")).not.toBeInTheDocument();
    });
  });

  describe("BLF-020: Sign in to edit prompt in detail overlay when unauthenticated", () => {
    it("shows lock icon and Sign in to edit button in detail overlay when unauthenticated", async () => {
      localStorage.setItem("backlog-last-project-id", "3");
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText("CIQ-002")).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText("CIQ-002"));

      await waitFor(() => {
        expect(screen.getByText("Sign in to edit")).toBeInTheDocument();
      });

      // The Sign in to edit text is inside a button with aria-label="Sign in to edit"
      const signInButton = screen.getByLabelText("Sign in to edit");
      expect(signInButton).toBeInTheDocument();
      expect(signInButton.tagName).toBe("BUTTON");

      // Lock icon is present (inline SVG with aria-hidden)
      const lockIcon = signInButton.querySelector('svg[aria-hidden="true"]');
      expect(lockIcon).toBeInTheDocument();
    });

    it("clicking Sign in to edit button in detail overlay triggers GitHub OAuth sign in", async () => {
      localStorage.setItem("backlog-last-project-id", "3");
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText("CIQ-002")).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText("CIQ-002"));

      await waitFor(() => {
        expect(screen.getByLabelText("Sign in to edit")).toBeInTheDocument();
      });

      await userEvent.click(screen.getByLabelText("Sign in to edit"));

      expect(mocks.mockAuth.signInWithOAuth).toHaveBeenCalledWith({
        provider: "github",
        options: {
          redirectTo: window.location.origin + "/backlog-frontend/",
        },
      });
    });

    it("prompt disappears from detail overlay after successful authentication", async () => {
      mocks.mockAuth.getSession.mockResolvedValue({
        data: { session: { user: { id: "test-user" } } },
      });

      localStorage.setItem("backlog-last-project-id", "3");
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText("CIQ-002")).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText("CIQ-002"));

      await waitFor(() => {
        expect(screen.getByText("Transition")).toBeInTheDocument();
        expect(screen.queryByLabelText("Sign in to edit")).not.toBeInTheDocument();
        expect(screen.queryByText("Sign in to edit")).not.toBeInTheDocument();
      });
    });
  });

  describe("BLF-023: Optimistic UI update on status transition", () => {
    it("card moves to target column immediately when transition is tapped", async () => {
      mocks.mockAuth.getSession.mockResolvedValue({
        data: { session: { user: { id: "test-user" } } },
      });

      localStorage.setItem("backlog-last-project-id", "3");
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText("Backlog")).toBeInTheDocument();
        expect(screen.getByText("CIQ-002")).toBeInTheDocument();
      });

      // Open detail overlay for CIQ-002
      await userEvent.click(screen.getByText("CIQ-002"));

      await waitFor(() => {
        expect(screen.getByText("Transition")).toBeInTheDocument();
      });

      // Click "Ready" transition for CIQ-002 (currently in backlog)
      const readyButton = screen.getByText("Ready");
      await userEvent.click(readyButton);

      // Overlay should close immediately (optimistic update, no waiting for server)
      await waitFor(() => {
        expect(screen.queryByText("Transition")).not.toBeInTheDocument();
      });

      // CIQ-002 should no longer be in the Backlog column
      await waitFor(() => {
        expect(screen.queryByText("CIQ-002")).not.toBeInTheDocument();
      });

      // Navigate to Ready column - CIQ-002 should be there (optimistic)
      await userEvent.click(screen.getByLabelText("Ready"));

      await waitFor(() => {
        expect(screen.getByText("CIQ-002")).toBeInTheDocument();
      });

      // Verify the story status was updated in the store (server confirmed)
      const updatedStory = mocks.store.data!.stories.find((s) => s.id === 2);
      expect(updatedStory!.status).toBe("ready");
    });

    it("card returns to original column when update fails", async () => {
      mocks.mockAuth.getSession.mockResolvedValue({
        data: { session: { user: { id: "test-user" } } },
      });

      // Use a deferred promise so we can control when the server responds
      let rejectUpdate: (value: { error: string }) => void;
      mocks.updateStatusOverride = () =>
        new Promise<{ error: string }>((resolve) => {
          rejectUpdate = resolve;
        });

      localStorage.setItem("backlog-last-project-id", "3");
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText("Backlog")).toBeInTheDocument();
        expect(screen.getByText("CIQ-002")).toBeInTheDocument();
      });

      // Open detail overlay
      await userEvent.click(screen.getByText("CIQ-002"));

      await waitFor(() => {
        expect(screen.getByText("Transition")).toBeInTheDocument();
      });

      // Click "Ready" transition
      const readyButton = screen.getByText("Ready");
      await userEvent.click(readyButton);

      // Overlay closes immediately (optimistic update applied)
      await waitFor(() => {
        expect(screen.queryByText("Transition")).not.toBeInTheDocument();
      });

      // Card moves optimistically - CIQ-002 disappears from Backlog
      await waitFor(() => {
        expect(screen.queryByText("CIQ-002")).not.toBeInTheDocument();
      });

      // Navigate to Ready - CIQ-002 is there optimistically
      await userEvent.click(screen.getByLabelText("Ready"));
      await waitFor(() => {
        expect(screen.getByText("CIQ-002")).toBeInTheDocument();
      });

      // Now let the server fail
      await act(async () => {
        rejectUpdate!({ error: "Network error" });
      });

      // After revert, the story should disappear from Ready
      await waitFor(() => {
        expect(screen.queryByText("CIQ-002")).not.toBeInTheDocument();
      });

      // Navigate back to Backlog - CIQ-002 should be back
      await userEvent.click(screen.getByLabelText("Backlog"));
      await waitFor(() => {
        expect(screen.getByText("CIQ-002")).toBeInTheDocument();
      });

      // Server store should still show "backlog" (update failed)
      const story = mocks.store.data!.stories.find((s) => s.id === 2);
      expect(story!.status).toBe("backlog");

      // Error banner should appear
      await waitFor(() => {
        expect(screen.getByText("Network error")).toBeInTheDocument();
      });
    });

    it("no double-move when realtime refetch confirms the optimistic update", async () => {
      mocks.mockAuth.getSession.mockResolvedValue({
        data: { session: { user: { id: "test-user" } } },
      });

      localStorage.setItem("backlog-last-project-id", "3");
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText("Backlog")).toBeInTheDocument();
        expect(screen.getByText("CIQ-002")).toBeInTheDocument();
      });

      // Open detail overlay
      await userEvent.click(screen.getByText("CIQ-002"));

      await waitFor(() => {
        expect(screen.getByText("Transition")).toBeInTheDocument();
      });

      // Click "Ready" transition
      const readyButton = screen.getByText("Ready");
      await userEvent.click(readyButton);

      // Overlay closes immediately
      await waitFor(() => {
        expect(screen.queryByText("Transition")).not.toBeInTheDocument();
      });

      // Card moved to Ready column optimistically
      expect(screen.queryByText("CIQ-002")).not.toBeInTheDocument();

      await userEvent.click(screen.getByLabelText("Ready"));
      await waitFor(() => {
        expect(screen.getByText("CIQ-002")).toBeInTheDocument();
      });

      // Simulate realtime event (server confirms the update)
      // triggerDataChange snapshots the store, which already has status: "ready"
      mocks.triggerDataChange();

      // Card should remain in Ready column after refetch
      // No flicker: CIQ-002 should still be in Ready
      await waitFor(() => {
        expect(screen.getByText("CIQ-002")).toBeInTheDocument();
      });

      // And should not be in Backlog
      await userEvent.click(screen.getByLabelText("Backlog"));
      await waitFor(() => {
        expect(screen.queryByText("CIQ-002")).not.toBeInTheDocument();
      });
    });

    it("optimistic update works across all valid transitions from backlog", async () => {
      mocks.mockAuth.getSession.mockResolvedValue({
        data: { session: { user: { id: "test-user" } } },
      });

      localStorage.setItem("backlog-last-project-id", "3");
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText("Backlog")).toBeInTheDocument();
        expect(screen.getByText("CIQ-003")).toBeInTheDocument();
      });

      // Open CIQ-003 (backlog, priority 3)
      await userEvent.click(screen.getByText("CIQ-003"));

      await waitFor(() => {
        expect(screen.getByText("Transition")).toBeInTheDocument();
      });

      // From backlog, valid transitions: Ready, Cancelled
      expect(screen.getByText("Ready")).toBeInTheDocument();
      expect(screen.getByText("Cancelled")).toBeInTheDocument();

      // Transition CIQ-003 to Ready
      await userEvent.click(screen.getByText("Ready"));

      // Overlay closes immediately
      await waitFor(() => {
        expect(screen.queryByText("Transition")).not.toBeInTheDocument();
      });

      // CIQ-003 is now in Ready column
      await userEvent.click(screen.getByLabelText("Ready"));
      await waitFor(() => {
        expect(screen.getByText("CIQ-003")).toBeInTheDocument();
      });

      // Verify store was updated
      const story = mocks.store.data!.stories.find((s) => s.id === 3);
      expect(story!.status).toBe("ready");
    });

    it("dismiss button clears transition error banner", async () => {
      mocks.mockAuth.getSession.mockResolvedValue({
        data: { session: { user: { id: "test-user" } } },
      });

      // Override updateStoryStatus to fail
      mocks.updateStatusOverride = async () => ({ error: "Database error" });

      localStorage.setItem("backlog-last-project-id", "3");
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText("Backlog")).toBeInTheDocument();
        expect(screen.getByText("CIQ-002")).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText("CIQ-002"));

      await waitFor(() => {
        expect(screen.getByText("Transition")).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText("Ready"));

      // Error banner should appear
      await waitFor(() => {
        expect(screen.getByText("Database error")).toBeInTheDocument();
      });

      // Click Dismiss
      await userEvent.click(screen.getByText("Dismiss"));

      await waitFor(() => {
        expect(screen.queryByText("Database error")).not.toBeInTheDocument();
      });
    });
  });
});
