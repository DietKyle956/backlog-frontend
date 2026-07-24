import { useEffect, useState, useCallback } from "react";
import { supabase } from "../supabase";
import type { AppData, Project, Story, Blocker, Dependency } from "../types";

interface BoardDataState {
  data: AppData | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useBoardData(): BoardDataState {
  const [data, setData] = useState<AppData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const [projectsRes, storiesRes, blockersRes, dependenciesRes] =
        await Promise.all([
          supabase.from("projects").select("*").order("name"),
          supabase.from("stories").select("*"),
          supabase.from("blockers").select("*").is("resolved_at", null),
          supabase.from("dependencies").select("*"),
        ]);

      if (projectsRes.error) throw projectsRes.error;
      if (storiesRes.error) throw storiesRes.error;
      if (blockersRes.error) throw blockersRes.error;
      if (dependenciesRes.error) throw dependenciesRes.error;

      setData({
        projects: (projectsRes.data as Project[]) ?? [],
        stories: (storiesRes.data as Story[]) ?? [],
        blockers: (blockersRes.data as Blocker[]) ?? [],
        dependencies: (dependenciesRes.data as Dependency[]) ?? [],
      });
      setError(null);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to load data";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Subscribe to realtime changes
  useEffect(() => {
    const channel = supabase
      .channel("board-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "stories" },
        () => fetchAll(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "projects" },
        () => fetchAll(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "blockers" },
        () => fetchAll(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "dependencies" },
        () => fetchAll(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAll]);

  return { data, loading, error, refetch: fetchAll };
}
