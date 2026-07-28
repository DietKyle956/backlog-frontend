import type { BacklogAdapter } from "../lib/adapter";
import type { AppData } from "../types";

export function createMemoryAdapter(
  initialData?: AppData,
): BacklogAdapter {
  let data: AppData = initialData ?? {
    projects: [],
    stories: [],
    blockers: [],
    dependencies: [],
  };

  return {
    fetchAll: async () => ({ data, error: null }),

    updateStoryStatus: async (storyId, status) => {
      const story = data.stories.find((s) => s.id === storyId);
      if (!story) {
        return { error: "Story not found" };
      }
      story.status = status;
      story.updated_at = new Date().toISOString();
      return {};
    },

    onDataChange: () => () => {
      // no-op: tests trigger refetch explicitly
    },
  };
}
