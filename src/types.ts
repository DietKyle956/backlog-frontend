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
  github_repo_id: number | null;
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
  wayfinder_ticket_id: number | null;
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

// ── Wayfinder domain types ──────────────────────────────────────────────

export type WayfinderMapStatus = "active" | "completed" | "archived";

export type WayfinderTicketType =
  | "research"
  | "prototype"
  | "grilling"
  | "scaffold";

export type WayfinderTicketStatus = "open" | "claimed" | "closed";

export interface WayfinderMap {
  id: number;
  project_id: number;
  title: string;
  destination: string;
  notes: string;
  decisions_so_far: string;
  not_yet_specified: string;
  out_of_scope: string;
  status: WayfinderMapStatus;
  created_at: string;
  updated_at: string;
}

export interface WayfinderTicket {
  id: number;
  map_id: number;
  title: string;
  question: string;
  ticket_type: WayfinderTicketType;
  hitl: boolean;
  status: WayfinderTicketStatus;
  resolution: string | null;
  spec_file: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
}

export interface WayfinderTicketDependency {
  ticket_id: number;
  depends_on_id: number;
}

// ── App data ────────────────────────────────────────────────────────────

export interface AppData {
  projects: Project[];
  stories: Story[];
  blockers: Blocker[];
  dependencies: Dependency[];
  wayfinderMaps: WayfinderMap[];
  wayfinderTickets: WayfinderTicket[];
  wayfinderTicketDependencies: WayfinderTicketDependency[];
}
