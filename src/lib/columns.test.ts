import { describe, it, expect } from "vitest";
import { computeColumns } from "./columns";
import type { Story } from "../types";

function makeStory(overrides: Partial<Story> = {}): Story {
  return {
    id: 1,
    project_id: 1,
    key: "TST-001",
    title: "Test story",
    description: "",
    status: "backlog",
    acceptance_criteria: [],
    priority: 3,
    created_at: "2026-07-01T00:00:00Z",
    updated_at: "2026-07-01T00:00:00Z",
    reviewed_by: null,
    ...overrides,
  };
}

const defaultFilters = { searchTerm: "", priorityFilter: new Set<number>() };

describe("computeColumns", () => {
  it("groups stories into correct status columns", () => {
    const stories = [
      makeStory({ id: 1, key: "A-1", status: "backlog" }),
      makeStory({ id: 2, key: "A-2", status: "ready" }),
      makeStory({ id: 3, key: "A-3", status: "in_progress" }),
    ];

    const columns = computeColumns(stories, defaultFilters);

    const backlog = columns.find((c) => c.status === "backlog")!;
    const ready = columns.find((c) => c.status === "ready")!;
    const inProgress = columns.find((c) => c.status === "in_progress")!;

    expect(backlog.stories).toHaveLength(1);
    expect(backlog.stories[0].key).toBe("A-1");
    expect(ready.stories).toHaveLength(1);
    expect(ready.stories[0].key).toBe("A-2");
    expect(inProgress.stories).toHaveLength(1);
    expect(inProgress.stories[0].key).toBe("A-3");
  });

  it("returns all 5 columns even when no stories match", () => {
    const columns = computeColumns([], defaultFilters);

    expect(columns).toHaveLength(5);
    expect(columns.map((c) => c.status)).toEqual([
      "backlog",
      "ready",
      "in_progress",
      "in_review",
      "done",
    ]);
    columns.forEach((col) => {
      expect(col.stories).toEqual([]);
    });
  });

  it("filters by title (case-insensitive substring)", () => {
    const stories = [
      makeStory({ id: 1, key: "A-1", title: "Fix login bug" }),
      makeStory({ id: 2, key: "A-2", title: "Add dashboard" }),
      makeStory({ id: 3, key: "A-3", title: "Update LOGIN page" }),
    ];

    const columns = computeColumns(stories, {
      searchTerm: "login",
      priorityFilter: new Set(),
    });

    const backlog = columns.find((c) => c.status === "backlog")!;
    expect(backlog.stories).toHaveLength(2);
    expect(backlog.stories.map((s) => s.key)).toEqual(["A-1", "A-3"]);
  });

  it("filters by key (case-insensitive substring)", () => {
    const stories = [
      makeStory({ id: 1, key: "BLF-001", title: "Foo" }),
      makeStory({ id: 2, key: "CIQ-002", title: "Bar" }),
      makeStory({ id: 3, key: "blf-003", title: "Baz" }),
    ];

    const columns = computeColumns(stories, {
      searchTerm: "blf",
      priorityFilter: new Set(),
    });

    const backlog = columns.find((c) => c.status === "backlog")!;
    expect(backlog.stories).toHaveLength(2);
    expect(backlog.stories.map((s) => s.key)).toEqual(["BLF-001", "blf-003"]);
  });

  it("priority filter includes only selected priorities", () => {
    const stories = [
      makeStory({ id: 1, key: "A-1", priority: 1 }),
      makeStory({ id: 2, key: "A-2", priority: 2 }),
      makeStory({ id: 3, key: "A-3", priority: 3 }),
    ];

    const columns = computeColumns(stories, {
      searchTerm: "",
      priorityFilter: new Set([1, 3]),
    });

    const backlog = columns.find((c) => c.status === "backlog")!;
    expect(backlog.stories).toHaveLength(2);
    expect(backlog.stories.map((s) => s.priority)).toEqual([1, 3]);
  });

  it("empty priority filter shows all stories", () => {
    const stories = [
      makeStory({ id: 1, key: "A-1", priority: 1 }),
      makeStory({ id: 2, key: "A-2", priority: 4 }),
    ];

    const columns = computeColumns(stories, {
      searchTerm: "",
      priorityFilter: new Set(),
    });

    const backlog = columns.find((c) => c.status === "backlog")!;
    expect(backlog.stories).toHaveLength(2);
  });

  it("sorts by priority ascending (highest first), then oldest first", () => {
    const stories = [
      makeStory({
        id: 1,
        key: "A-1",
        priority: 3,
        created_at: "2026-07-01T00:00:00Z",
      }),
      makeStory({
        id: 2,
        key: "A-2",
        priority: 1,
        created_at: "2026-07-05T00:00:00Z",
      }),
      makeStory({
        id: 3,
        key: "A-3",
        priority: 1,
        created_at: "2026-07-01T00:00:00Z",
      }),
    ];

    const columns = computeColumns(stories, defaultFilters);

    const backlog = columns.find((c) => c.status === "backlog")!;
    expect(backlog.stories.map((s) => s.key)).toEqual([
      "A-3",
      "A-2",
      "A-1",
    ]);
  });

  it("excludes terminal status stories (cancelled, failed)", () => {
    const stories = [
      makeStory({ id: 1, key: "A-1", status: "backlog" }),
      makeStory({ id: 2, key: "A-2", status: "cancelled" }),
      makeStory({ id: 3, key: "A-3", status: "failed" }),
      makeStory({ id: 4, key: "A-4", status: "done" }),
    ];

    const columns = computeColumns(stories, defaultFilters);

    const allVisible = columns.flatMap((c) => c.stories.map((s) => s.key));
    expect(allVisible).toContain("A-1");
    expect(allVisible).toContain("A-4");
    expect(allVisible).not.toContain("A-2");
    expect(allVisible).not.toContain("A-3");
  });

  it("empty stories array returns columns with empty story arrays", () => {
    const columns = computeColumns([], defaultFilters);

    expect(columns).toHaveLength(5);
    columns.forEach((col) => {
      expect(col.stories).toEqual([]);
    });
  });
});
