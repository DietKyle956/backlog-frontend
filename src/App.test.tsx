import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
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

  return {
    mockAuth,
    store,
    get fetchAllOverride() { return fetchAllOverride; },
    set fetchAllOverride(v: typeof fetchAllOverride) { fetchAllOverride = v; },
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
      if (!mocks.store.data) return { error: "No data loaded" };
      const story = mocks.store.data.stories.find((s) => s.id === storyId);
      if (!story) return { error: "Story not found" };
      story.status = status as never;
      return {};
    },
    onDataChange: () => () => {
      // no-op in tests: refetch is triggered explicitly
    },
  }),
}));

function resetStore() {
  mocks.store.data = {
    projects: [...mockProjects],
    stories: [...mockStories],
    blockers: [...mockBlockers],
    dependencies: [...mockDependencies],
  };
  mocks.fetchAllOverride = null;
}

beforeEach(() => {
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
    const skeletons = document.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
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
      expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    });
    expect(screen.getByText("Try Again")).toBeInTheDocument();
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
    // from a Supabase join - the getDepStory helper uses allStories.find()
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
