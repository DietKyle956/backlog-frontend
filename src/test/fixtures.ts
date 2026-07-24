import type { Project, Story, Blocker, Dependency } from "../types";

export const mockProjects: Project[] = [
  { id: 1, name: "Alpha Project", slug: "AP", github_repo: null },
  { id: 2, name: "Beta Project", slug: "BP", github_repo: null },
  { id: 3, name: "Contract IQ", slug: "CIQ", github_repo: "DietKyle956/contract-iq" },
];

export const mockStories: Story[] = [
  {
    id: 1,
    project_id: 3,
    key: "CIQ-001",
    title: "Set up project scaffolding",
    description: "Initial project setup with Vite and React",
    status: "done",
    acceptance_criteria: ["Project builds", "Tests run"],
    priority: 1,
    created_at: "2026-07-01T00:00:00Z",
    updated_at: "2026-07-02T00:00:00Z",
    reviewed_by: "Tyler",
  },
  {
    id: 2,
    project_id: 3,
    key: "CIQ-002",
    title: "Add authentication",
    description: "Implement GitHub OAuth login",
    status: "backlog",
    acceptance_criteria: ["Login works", "Session persists"],
    priority: 2,
    created_at: "2026-07-03T00:00:00Z",
    updated_at: "2026-07-03T00:00:00Z",
    reviewed_by: null,
  },
  {
    id: 3,
    project_id: 3,
    key: "CIQ-003",
    title: "Build Kanban board",
    description: "Create the mobile-first board UI",
    status: "backlog",
    acceptance_criteria: ["Columns render", "Swiping works"],
    priority: 3,
    created_at: "2026-07-04T00:00:00Z",
    updated_at: "2026-07-04T00:00:00Z",
    reviewed_by: null,
  },
  {
    id: 4,
    project_id: 3,
    key: "CIQ-004",
    title: "Cancelled story",
    description: "This one was cancelled",
    status: "cancelled",
    acceptance_criteria: [],
    priority: 4,
    created_at: "2026-07-05T00:00:00Z",
    updated_at: "2026-07-05T00:00:00Z",
    reviewed_by: null,
  },
  {
    id: 5,
    project_id: 1,
    key: "AP-001",
    title: "Alpha story",
    description: "A story in another project",
    status: "backlog",
    acceptance_criteria: [],
    priority: 1,
    created_at: "2026-07-06T00:00:00Z",
    updated_at: "2026-07-06T00:00:00Z",
    reviewed_by: null,
  },
];

export const mockBlockers: Blocker[] = [
  {
    id: 1,
    story_id: 2,
    blocking_story_id: 1,
    description: "Waiting on CIQ-001 completion",
    resolved_at: null,
    created_at: "2026-07-03T00:00:00Z",
  },
];

export const mockDependencies: Dependency[] = [
  { story_id: 2, depends_on_id: 1 },
  { story_id: 3, depends_on_id: 1 },
  { story_id: 3, depends_on_id: 2 },
];
