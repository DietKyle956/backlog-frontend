import type { StoryStatus } from "../types";
import type { BacklogAdapter } from "./adapter";

export interface TransitionResult {
  success: boolean;
  error?: string;
}

export interface TransitionRunner {
  performTransition: (
    storyId: number,
    currentStatus: StoryStatus,
    newStatus: StoryStatus,
  ) => Promise<TransitionResult>;
}

const TRANSITIONS: Record<StoryStatus, StoryStatus[]> = {
  backlog: ["ready", "cancelled"],
  ready: ["in_progress", "backlog", "cancelled"],
  in_progress: ["in_review", "ready", "failed"],
  in_review: ["done", "in_progress", "failed"],
  done: ["in_review"],
  cancelled: ["backlog", "failed"],
  failed: ["backlog", "cancelled"],
};

export function getAllowedTargets(status: StoryStatus): StoryStatus[] {
  return TRANSITIONS[status] ?? [];
}

export function createTransitionRunner(
  adapter: Pick<BacklogAdapter, "updateStoryStatus">,
): TransitionRunner {
  let transitioning = false;

  async function performTransition(
    storyId: number,
    currentStatus: StoryStatus,
    newStatus: StoryStatus,
  ): Promise<TransitionResult> {
    if (transitioning) {
      return {
        success: false,
        error: "A transition is already in progress",
      };
    }

    const allowed = getAllowedTargets(currentStatus);
    if (!allowed.includes(newStatus)) {
      return {
        success: false,
        error: `Invalid transition from ${currentStatus} to ${newStatus}`,
      };
    }

    transitioning = true;
    try {
      const { error } = await adapter.updateStoryStatus(storyId, newStatus);
      if (error) {
        return { success: false, error };
      }
      return { success: true };
    } finally {
      transitioning = false;
    }
  }

  return { performTransition };
}
