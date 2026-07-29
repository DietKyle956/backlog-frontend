import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { AppData, Story, StoryStatus } from "../../../../src/types";
import type { BacklogAdapter } from "../../../../src/lib/adapter";
import { Board } from "../../../../src/components/Board";

// Create many stories in "backlog" to force overflow in the column
function makeOverflowStories(count: number, status: StoryStatus = "backlog"): Story[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    project_id: 1,
    key: `TST-${String(i + 1).padStart(3, "0")}`,
    title: `Test story number ${i + 1} with a longer title to fill space`,
    description: `Description for story ${i + 1}`,
    status,
    acceptance_criteria: [],
    priority: ((i % 4) + 1) as 1 | 2 | 3 | 4,
    created_at: "2026-07-01T00:00:00Z",
    updated_at: "2026-07-01T00:00:00Z",
    reviewed_by: null,
  }));
}

const mockData: AppData = {
  projects: [{ id: 1, name: "Test Project", slug: "TST", github_repo: null }],
  stories: makeOverflowStories(25, "backlog"),
  blockers: [],
  dependencies: [],
};

function createMockAdapter(data: AppData): Pick<BacklogAdapter, "updateStoryStatus"> {
  return {
    updateStoryStatus: async () => ({}),
  };
}

describe("Vertical scroll in Kanban columns", () => {
  beforeEach(() => {
    // Mock scrollHeight and clientHeight on the column content area
    // jsdom doesn't lay out CSS, so we simulate overflow
    const originalGetComputedStyle = window.getComputedStyle;
    vi.spyOn(window, "getComputedStyle").mockImplementation((el: Element, pseudoElt?: string | null) => {
      const style = originalGetComputedStyle(el, pseudoElt);
      // We can't easily mock actual CSS layout in jsdom,
      // but we can verify the CSS classes are present
      return style;
    });
  });

  it("renders Board with overflow-y-auto on the column content area", () => {
    render(
      <Board
        stories={mockData.stories}
        blockers={mockData.blockers}
        dependencies={mockData.dependencies}
        isAuthenticated={false}
        adapter={createMockAdapter(mockData)}
        onRefresh={async () => {}}
        onSignIn={() => {}}
        applyOptimisticUpdate={() => () => {}}
      />,
    );

    // The column content area should have overflow-y-auto class (which is Tailwind for overflow-y: auto)
    // We look for the scrollable container by checking for a div with overflow-y-auto
    // Actually, let's check that the component renders with the correct CSS class
    const columnContent = document.querySelector(".overflow-y-auto");
    expect(columnContent).not.toBeNull();
    expect(columnContent).toHaveClass("overflow-y-auto");
  });

  it("renders 25 stories in the backlog column", () => {
    render(
      <Board
        stories={mockData.stories}
        blockers={mockData.blockers}
        dependencies={mockData.dependencies}
        isAuthenticated={false}
        adapter={createMockAdapter(mockData)}
        onRefresh={async () => {}}
        onSignIn={() => {}}
        applyOptimisticUpdate={() => () => {}}
      />,
    );

    // All 25 stories should be rendered (overflow-y-auto with flex-1 means scrolling)
    const storyCards = document.querySelectorAll(".overflow-y-auto > div, .overflow-y-auto > .cursor-pointer");
    // The stories are rendered inside the overflow-y-auto container
    const storiesText = screen.getAllByText(/Test story number/);
    expect(storiesText.length).toBe(25);
  });

  it("column content area has flex-1 and overflow-y-auto for scrolling behavior", () => {
    render(
      <Board
        stories={mockData.stories}
        blockers={mockData.blockers}
        dependencies={mockData.dependencies}
        isAuthenticated={false}
        adapter={createMockAdapter(mockData)}
        onRefresh={async () => {}}
        onSignIn={() => {}}
        applyOptimisticUpdate={() => () => {}}
      />,
    );

    // The scrollable area element should have both flex-1 and overflow-y-auto
    const scrollableDiv = document.querySelector(".flex-1.overflow-y-auto");
    expect(scrollableDiv).not.toBeNull();

    // Verify it contains the animated class for column transitions
    expect(scrollableDiv).toHaveClass("flex-1");
    expect(scrollableDiv).toHaveClass("overflow-y-auto");
  });
});
