export type StoryStatus =
  | "backlog"
  | "ready"
  | "in_progress"
  | "in_review"
  | "done"
  | "cancelled"
  | "failed";

export const ACTIVE_STATUSES: StoryStatus[] = [
  "backlog",
  "ready",
  "in_progress",
  "in_review",
  "done",
];

export const TERMINAL_STATUSES: StoryStatus[] = ["cancelled", "failed"];

export const COLUMN_ORDER: StoryStatus[] = [
  "backlog",
  "ready",
  "in_progress",
  "in_review",
  "done",
];

export const COLUMN_LABELS: Record<StoryStatus, string> = {
  backlog: "Backlog",
  ready: "Ready",
  in_progress: "In Progress",
  in_review: "In Review",
  done: "Done",
  cancelled: "Cancelled",
  failed: "Failed",
};

export const PRIORITY_LABELS: Record<number, string> = {
  1: "Critical",
  2: "High",
  3: "Medium",
  4: "Low",
};

export interface Project {
  id: number;
  name: string;
  slug: string;
  github_repo: string | null;
}

export interface Story {
  id: number;
  project_id: number;
  key: string;
  title: string;
  description: string;
  status: StoryStatus;
  acceptance_criteria: string[];
  priority: number;
  created_at: string;
  updated_at: string;
  reviewed_by: string | null;
}

export interface Blocker {
  id: number;
  story_id: number;
  blocking_story_id: number | null;
  description: string | null;
  resolved_at: string | null;
  created_at: string;
}

export interface Dependency {
  story_id: number;
  depends_on_id: number;
}

/** Blocker with the blocking story key pre-resolved from allStories */
export interface ResolvedBlocker {
  id: number;
  description: string | null;
  resolved_at: string | null;
  blockingStoryKey: string | null;
}

/** Dependency with the target story's key, title, and completion pre-resolved */
export interface ResolvedDependency {
  depends_on_id: number;
  storyKey: string | null;
  storyTitle: string | null;
  isDone: boolean;
}

export interface AppData {
  projects: Project[];
  stories: Story[];
  blockers: Blocker[];
  dependencies: Dependency[];
}
