import type { Story, StoryStatus } from "../types";
import { COLUMN_ORDER, ACTIVE_STATUSES } from "../types";

export interface ColumnFilters {
  searchTerm: string;
  priorityFilter: Set<number>;
}

export interface Column {
  status: StoryStatus;
  stories: Story[];
}

export function computeColumns(
  stories: Story[],
  filters: ColumnFilters,
): Column[] {
  const activeStories = stories.filter((s) =>
    ACTIVE_STATUSES.includes(s.status as StoryStatus),
  );

  return COLUMN_ORDER.map((status) => {
    let columnStories = activeStories.filter((s) => s.status === status);

    // Apply search filter
    if (filters.searchTerm.trim()) {
      const term = filters.searchTerm.toLowerCase().trim();
      columnStories = columnStories.filter(
        (s) =>
          s.title.toLowerCase().includes(term) ||
          s.key.toLowerCase().includes(term),
      );
    }

    // Apply priority filter
    if (filters.priorityFilter.size > 0) {
      columnStories = columnStories.filter((s) =>
        filters.priorityFilter.has(s.priority),
      );
    }

    // Sort: priority ascending (highest first), then created_at ascending (oldest first)
    columnStories.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return (
        new Date(a.created_at).getTime() -
        new Date(b.created_at).getTime()
      );
    });

    return { status, stories: columnStories };
  });
}
