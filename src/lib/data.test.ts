import { describe, it, expect } from "vitest";
import { createMemoryAdapter } from "../adapters/memory-adapter";
import type { BoardDataAdapter } from "./data";
import type { AppData } from "../types";

const sampleData: AppData = {
  projects: [
    { id: 1, name: "Test Project", slug: "TST", github_repo: null },
  ],
  stories: [
    {
      id: 1,
      project_id: 1,
      key: "TST-001",
      title: "Story one",
      description: "",
      status: "backlog",
      acceptance_criteria: [],
      priority: 2,
      created_at: "2026-07-01T00:00:00Z",
      updated_at: "2026-07-01T00:00:00Z",
      reviewed_by: null,
    },
    {
      id: 2,
      project_id: 1,
      key: "TST-002",
      title: "Story two",
      description: "",
      status: "in_progress",
      acceptance_criteria: [],
      priority: 1,
      created_at: "2026-07-02T00:00:00Z",
      updated_at: "2026-07-02T00:00:00Z",
      reviewed_by: null,
    },
  ],
  blockers: [
    {
      id: 1,
      story_id: 1,
      blocking_story_id: 2,
      description: "Blocked by TST-002",
      resolved_at: null,
      created_at: "2026-07-03T00:00:00Z",
    },
  ],
  dependencies: [{ story_id: 1, depends_on_id: 2 }],
};

function createAdapter(data?: AppData): BoardDataAdapter {
  return createMemoryAdapter(data);
}

describe("BoardDataAdapter contract (memory adapter)", () => {
  it("fetchAll returns the provided data", async () => {
    const adapter = createAdapter(sampleData);
    const result = await adapter.fetchAll();

    expect(result.error).toBeNull();
    expect(result.data).toEqual(sampleData);
  });

  it("fetchAll returns empty data when no initial data provided", async () => {
    const adapter = createAdapter();
    const result = await adapter.fetchAll();

    expect(result.error).toBeNull();
    expect(result.data).toEqual({
      projects: [],
      stories: [],
      blockers: [],
      dependencies: [],
    });
  });

  it("updateStoryStatus updates the story status", async () => {
    const adapter = createAdapter(sampleData);
    const result = await adapter.updateStoryStatus(1, "done");

    expect(result.error).toBeUndefined();

    // Verify the status was updated
    const data = await adapter.fetchAll();
    const story = data.data!.stories.find((s) => s.id === 1);
    expect(story!.status).toBe("done");
  });

  it("updateStoryStatus returns error for non-existent story", async () => {
    const adapter = createAdapter(sampleData);
    const result = await adapter.updateStoryStatus(999, "done");

    expect(result.error).toBe("Story not found");
  });

  it("onDataChange returns an unsubscribe function", () => {
    const adapter = createAdapter(sampleData);
    const unsubscribe = adapter.onDataChange(() => {});

    expect(typeof unsubscribe).toBe("function");
    // Should not throw
    unsubscribe();
  });

  it("adapter swap: two adapters with different data behave independently", async () => {
    const adapterA = createAdapter(sampleData);
    const adapterB = createAdapter({
      ...sampleData,
      projects: [
        { id: 2, name: "Other Project", slug: "OTH", github_repo: null },
      ],
    });

    const resultA = await adapterA.fetchAll();
    const resultB = await adapterB.fetchAll();

    expect(resultA.data!.projects[0].name).toBe("Test Project");
    expect(resultB.data!.projects[0].name).toBe("Other Project");
  });
});
