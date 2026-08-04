import { supabase } from "../supabase";
import type { BacklogAdapter } from "../lib/adapter";
import type { Project, Story, Blocker, Dependency, WayfinderMap, WayfinderTicket, WayfinderTicketDependency } from "../types";

export function createSupabaseAdapter(): BacklogAdapter {
  return {
    fetchAll: async () => {
      try {
        const [
          projectsRes,
          storiesRes,
          blockersRes,
          dependenciesRes,
          wayfinderMapsRes,
          wayfinderTicketsRes,
          wayfinderTicketDepsRes,
        ] = await Promise.all([
          supabase.from("projects").select("*").order("name"),
          supabase.from("stories").select("*"),
          supabase.from("blockers").select("*"),
          supabase.from("dependencies").select("*"),
          supabase.from("wayfinder_maps").select("*").order("title"),
          supabase.from("wayfinder_tickets").select("*").order("sort_order"),
          supabase.from("wayfinder_ticket_dependencies").select("*"),
        ]);

        if (projectsRes.error) throw projectsRes.error;
        if (storiesRes.error) throw storiesRes.error;
        if (blockersRes.error) throw blockersRes.error;
        if (dependenciesRes.error) throw dependenciesRes.error;
        if (wayfinderMapsRes.error) throw wayfinderMapsRes.error;
        if (wayfinderTicketsRes.error) throw wayfinderTicketsRes.error;
        if (wayfinderTicketDepsRes.error) throw wayfinderTicketDepsRes.error;

        return {
          data: {
            projects: (projectsRes.data as Project[]) ?? [],
            stories: (storiesRes.data as Story[]) ?? [],
            blockers: (blockersRes.data as Blocker[]) ?? [],
            dependencies: (dependenciesRes.data as Dependency[]) ?? [],
            wayfinderMaps: (wayfinderMapsRes.data as WayfinderMap[]) ?? [],
            wayfinderTickets: (wayfinderTicketsRes.data as WayfinderTicket[]) ?? [],
            wayfinderTicketDependencies: (wayfinderTicketDepsRes.data as WayfinderTicketDependency[]) ?? [],
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
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "wayfinder_maps" },
          () => callback(),
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "wayfinder_tickets" },
          () => callback(),
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "wayfinder_ticket_dependencies" },
          () => callback(),
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    },
  };
}
