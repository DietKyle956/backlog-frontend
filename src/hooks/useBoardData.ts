import { useEffect, useState, useCallback } from "react";
import type { BoardDataAdapter } from "../lib/data";
import type { AppData } from "../types";

interface BoardDataState {
  data: AppData | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useBoardData(adapter: BoardDataAdapter): BoardDataState {
  const [data, setData] = useState<AppData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
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

  return { data, loading, error, refetch: fetchAll };
}
