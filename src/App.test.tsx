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
      expect(screen.getByText("Nothing here yet")).toBeInTheDocument();
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
