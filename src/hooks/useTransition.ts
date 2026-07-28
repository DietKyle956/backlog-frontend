import { useState, useMemo, useCallback } from "react";
import type { StoryStatus } from "../types";
import type { BacklogAdapter } from "../lib/adapter";
import {
  createTransitionRunner,
  type TransitionResult,
} from "../lib/transitions";

export interface UseTransitionReturn {
  performTransition: (
    storyId: number,
    currentStatus: StoryStatus,
    newStatus: StoryStatus,
  ) => Promise<TransitionResult>;
  error: string | null;
  clearError: () => void;
}

export function useTransition(
  adapter: Pick<BacklogAdapter, "updateStoryStatus">,
): UseTransitionReturn {
  const [error, setError] = useState<string | null>(null);

  const runner = useMemo(() => createTransitionRunner(adapter), [adapter]);

  const performTransition = useCallback(
    async (
      storyId: number,
      currentStatus: StoryStatus,
      newStatus: StoryStatus,
    ): Promise<TransitionResult> => {
      setError(null);
      const result = await runner.performTransition(
        storyId,
        currentStatus,
        newStatus,
      );
      if (!result.success && result.error) {
        setError(result.error);
      }
      return result;
    },
    [runner],
  );

  const clearError = useCallback(() => setError(null), []);

  return { performTransition, error, clearError };
}
