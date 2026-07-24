import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "./App";
import {
  mockProjects,
  mockStories,
  mockBlockers,
  mockDependencies,
} from "./test/fixtures";

// All mock objects must be created via vi.hoisted since vi.mock is hoisted
const mocks = vi.hoisted(() => {
  const mockFrom = vi.fn();
  const mockSelect = vi.fn();
  const mockOrder = vi.fn();
  const mockIs = vi.fn();
  const mockUpdate = vi.fn();
  const mockEq = vi.fn();
  const on = vi.fn();
  const subscribe = vi.fn();
  const mockChannel = { on, subscribe };
  const mockAuth = {
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(),
    signInWithOAuth: vi.fn(),
    signOut: vi.fn(),
  };

  return {
    mockFrom,
    mockSelect,
    mockOrder,
    mockIs,
    mockUpdate,
    mockEq,
    mockChannel,
    mockAuth,
    on,
    subscribe,
  };
});

vi.mock("./supabase", () => ({
  supabase: {
    from: mocks.mockFrom,
    auth: mocks.mockAuth,
    channel: vi.fn(() => mocks.mockChannel),
    removeChannel: vi.fn(),
  },
}));

// Helper to resolve mock responses
function resolveWith(data: unknown) {
  return { data, error: null };
}

function setupSupabaseMock(options?: {
  projects?: unknown[];
  stories?: unknown[];
  blockers?: unknown[];
  dependencies?: unknown[];
}) {
  mocks.mockIs.mockReturnValue({ select: mocks.mockSelect });
  mocks.mockOrder.mockReturnValue(resolveWith(options?.projects ?? mockProjects));
  mocks.mockSelect.mockImplementation((table?: string) => {
    const t = typeof table === "string" ? table : "";
    if (t === "projects") {
      return {
        order: () => resolveWith(options?.projects ?? mockProjects),
      };
    }
    if (t === "stories") return resolveWith(options?.stories ?? mockStories);
    if (t === "blockers")
      return {
        is: () => resolveWith(options?.blockers ?? mockBlockers),
      };
    if (t === "dependencies")
      return resolveWith(options?.dependencies ?? mockDependencies);
    return resolveWith([]);
  });
  mocks.mockFrom.mockImplementation((table: string) => ({
    select: (cols?: string) => {
      if (table === "projects" && cols === "*") {
        return {
          order: () => resolveWith(options?.projects ?? mockProjects),
        };
      }
      if (table === "stories")
        return resolveWith(options?.stories ?? mockStories);
      if (table === "blockers")
        return {
          is: () => resolveWith(options?.blockers ?? mockBlockers),
        };
      if (table === "dependencies")
        return resolveWith(options?.dependencies ?? mockDependencies);
      return resolveWith([]);
    },
    update: mocks.mockUpdate.mockReturnValue({ eq: mocks.mockEq }),
  }));
  mocks.mockAuth.getSession.mockResolvedValue({ data: { session: null } });
  mocks.mockAuth.onAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
  });
  mocks.on.mockReturnValue(mocks.mockChannel);
  mocks.subscribe.mockReturnValue(mocks.mockChannel);
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  setupSupabaseMock();
});

describe("BLF-002: Board loads with Backlog column", () => {
  it("shows loading skeleton while fetching data", async () => {
    // Use promises that never resolve to stay in loading state.
    const pending = new Promise(() => {});
    mocks.mockFrom.mockReturnValue({
      select: () => ({
        order: () => pending,
        is: () => pending,
      }),
      update: mocks.mockUpdate.mockReturnValue({ eq: mocks.mockEq }),
    });

    render(<App />);
    // Loading skeleton should show pulse-animated placeholders
    const skeletons = document.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("renders the Backlog column by default on first visit", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Backlog")).toBeInTheDocument();
    });

    await waitFor(() => {
      // Should show project switcher with first project alphabetically (Alpha Project)
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
    mocks.mockFrom.mockImplementation(() => {
      throw new Error("Network error");
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    });
    expect(screen.getByText("Try Again")).toBeInTheDocument();
  });

  it("shows empty state when no projects exist", async () => {
    setupSupabaseMock({
      projects: [],
      stories: [],
      blockers: [],
      dependencies: [],
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("No projects found")).toBeInTheDocument();
    });
  });
});
