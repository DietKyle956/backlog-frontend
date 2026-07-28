import type { AppData, StoryStatus } from "../types";

export interface BacklogAdapter {
  fetchAll(): Promise<{ data: AppData | null; error: string | null }>;
  updateStoryStatus(
    storyId: number,
    status: StoryStatus,
  ): Promise<{ error?: string }>;
  onDataChange(callback: () => void): () => void;
}
