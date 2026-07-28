import { useEffect, useState, useCallback, useMemo } from "react";
import type { BacklogAdapter } from "../lib/adapter";
import type { AppData, StoryStatus } from "../types";

export interface BoardDataState {
  data: AppData | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  applyOptimisticUpdate: (
    storyId: number,
    newStatus: StoryStatus,
  ) => () => void;
}

export function useBoardData(adapter: BacklogAdapter): BoardDataState {
  const [data, setData] = useState<AppData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [optimisticStatuses, setOptimisticStatuses] = useState<
    Map<number, StoryStatus>
  >(new Map());

  const fetchAll = useCallback(async () => {
    const result = await adapter.fetchAll();
    if (result.error) {
      setError(result.error);
      setData(null);
    } else {
      setData(result.data);
      setError(null);
      // Clear optimistic overrides that the server has now confirmed
      setOptimisticStatuses((prev) => {
        if (prev.size === 0) return prev;
        const next = new Map(prev);
        for (const [storyId, status] of prev) {
          const story = result.data?.stories.find((s) => s.id === storyId);
          if (story && story.status === status) {
            next.delete(storyId);
          }
        }
        return next.size === prev.size ? prev : next;
      });
    }
    setLoading(false);
  }, [adapter]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Subscribe to realtime changes via adapter
  useEffect(() => {
    const unsubscribe = adapter.onDataChange(() => {
      fetchAll();
    });
    return unsubscribe;
  }, [adapter, fetchAll]);

  const refetch = useCallback(async () => {
    await fetchAll();
  }, [fetchAll]);

  const applyOptimisticUpdate = useCallback(
    (storyId: number, newStatus: StoryStatus) => {
      setOptimisticStatuses((prev) => new Map(prev).set(storyId, newStatus));
      return () => {
        setOptimisticStatuses((prev) => {
          const next = new Map(prev);
          next.delete(storyId);
          return next;
        });
      };
    },
    [],
  );

  // Merge optimistic statuses into the effective data so the board
  // reflects the update before the server confirms.
  const effectiveData = useMemo(() => {
    if (!data) return null;
    if (optimisticStatuses.size === 0) return data;
    return {
      ...data,
      stories: data.stories.map((s) => {
        const optStatus = optimisticStatuses.get(s.id);
        return optStatus ? { ...s, status: optStatus } : s;
      }),
    };
  }, [data, optimisticStatuses]);

  return {
    data: effectiveData,
    loading,
    error,
    refetch,
    applyOptimisticUpdate,
  };
}
