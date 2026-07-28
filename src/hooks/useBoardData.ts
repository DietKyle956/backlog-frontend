import { useEffect, useState, useCallback } from "react";
import type { BacklogAdapter } from "../lib/adapter";
import type { AppData } from "../types";

interface BoardDataState {
  data: AppData | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  refreshing: boolean;
}

export function useBoardData(adapter: BacklogAdapter): BoardDataState {
  const [data, setData] = useState<AppData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAll = useCallback(async () => {
    const result = await adapter.fetchAll();
    if (result.error) {
      setError(result.error);
      setData(null);
    } else {
      setData(result.data);
      setError(null);
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
    setRefreshing(true);
    try {
      await fetchAll();
    } finally {
      setRefreshing(false);
    }
  }, [fetchAll]);

  return { data, loading, error, refetch, refreshing };
}
