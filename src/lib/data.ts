import type { AppData, StoryStatus } from "../types";

export interface BoardDataAdapter {
  fetchAll(): Promise<{ data: AppData | null; error: string | null }>;
  updateStoryStatus(
    storyId: number,
    status: StoryStatus,
  ): Promise<{ error?: string }>;
  onDataChange(callback: () => void): () => void;
}
