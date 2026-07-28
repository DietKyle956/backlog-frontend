import { supabase } from "../supabase";
import type { BacklogAdapter } from "../lib/adapter";
import type { Project, Story, Blocker, Dependency } from "../types";

export function createSupabaseAdapter(): BacklogAdapter {
  return {
    fetchAll: async () => {
      try {
        const [
          projectsRes,
          storiesRes,
          blockersRes,
          dependenciesRes,
        ] = await Promise.all([
          supabase.from("projects").select("*").order("name"),
          supabase.from("stories").select("*"),
          supabase.from("blockers").select("*"),
          supabase.from("dependencies").select("*"),
        ]);

        if (projectsRes.error) throw projectsRes.error;
        if (storiesRes.error) throw storiesRes.error;
        if (blockersRes.error) throw blockersRes.error;
        if (dependenciesRes.error) throw dependenciesRes.error;

        return {
          data: {
            projects: (projectsRes.data as Project[]) ?? [],
            stories: (storiesRes.data as Story[]) ?? [],
            blockers: (blockersRes.data as Blocker[]) ?? [],
            dependencies: (dependenciesRes.data as Dependency[]) ?? [],
          },
          error: null,
        };
      } catch (e) {
        return {
          data: null,
          error:
            e instanceof Error ? e.message : "Failed to load data",
        };
      }
    },

    updateStoryStatus: async (storyId, status) => {
      const { error } = await supabase
        .from("stories")
        .update({ status })
        .eq("id", storyId);
      return { error: error?.message };
    },

    onDataChange: (callback) => {
      const channel = supabase
        .channel("board-changes")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "stories" },
          () => callback(),
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "projects" },
          () => callback(),
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "blockers" },
          () => callback(),
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "dependencies" },
          () => callback(),
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    },
  };
}
