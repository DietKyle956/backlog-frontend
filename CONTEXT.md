# Domain Glossary

## Story

A Story is the primary unit of work. It has a project-scoped Key (e.g. CIQ-018), a Title, a Description, Acceptance Criteria, a Priority, and a Status. A Story appears as a card on the Board. A Story may have Dependencies on other Stories and may be blocked by Blockers.

A Story is either **Active** (its status is one of `backlog`, `ready`, `in_progress`, `in_review`, or `done`) or **Terminal** (its status is `cancelled` or `failed`).

A Story may optionally be synced to a GitHub Issue via GitHub Sync state.

## Project

A Project scopes a Board. Each Project has a name, a unique slug (used as the prefix for Story Keys, e.g. `CIQ` for Contract IQ), and an optional GitHub repository. The Board always shows exactly one Project at a time. There is no cross-project aggregate view.

## Board

The Board is the Kanban surface for one Project. It consists of five Columns, navigated one at a time via swipe or arrow buttons. The Board shows only Active Stories. Terminal Stories appear on the separate Terminal view.

## Column

A Column is one vertical lane on the Board, corresponding to a single Status value. Only one Column is visible at a time on mobile. The five Columns, in left-to-right order, are: Backlog, Ready, In Progress, In Review, Done.

## Key

A Key is a project-scoped human-readable identifier for a Story, formed from the Project slug and an auto-incrementing counter (e.g. `CIQ-018`). Keys are unique across the system. Users think in terms of Keys when referencing stories (e.g. "move CIQ-018 to in_progress").

## Status

A Story's Status represents its position in the workflow. The seven statuses are:

| Status | Active / Terminal | Column position |
|---|---|---|
| `backlog` | Active | Column 1 |
| `ready` | Active | Column 2 |
| `in_progress` | Active | Column 3 |
| `in_review` | Active | Column 4 |
| `done` | Active | Column 5 |
| `cancelled` | Terminal | Terminal view |
| `failed` | Terminal | Terminal view |

## Priority

Priority indicates the importance of a Story. 1 is highest, 4+ is lowest.

| Value | Label | Color |
|---|---|---|
| 1 | Critical | Red |
| 2 | High | Orange |
| 3 | Medium | Yellow |
| 4+ | Low | Gray |

Active Stories within each Column are sorted by Priority (highest first), then by creation date (oldest first).

## Transition

A Transition is the action of changing a Story's Status. Only an Owner can perform a Transition. Each Transition must be one of the valid moves:

```
backlog → ready, cancelled
ready → in_progress, backlog, cancelled
in_progress → in_review, ready, failed
in_review → done, in_progress, failed
done → in_review
cancelled → backlog, failed
failed → backlog, cancelled
```

## Reactivate

Reactivating a Terminal Story moves it from `cancelled` or `failed` back to `backlog`, making it an Active Story that appears on the Board again.

## Dependency

A Dependency is a structural ordering relationship: Story A depends on Story B. B must be completed before A can reasonably be started. Dependencies are shown in the Story detail as a list with each dependency's current status (Done or Pending). A Story can have multiple Dependencies.

## Blocker

A Blocker is an active impediment preventing a Story from progressing. Unlike a Dependency (which is about work ordering), a Blocker signals that something is actively stopping work. A Blocker has a human-written description and may reference another Story via `blocking_story_id`. A Blocker can be Resolved (when `resolved_at` is set).

In the detail overlay, unresolved Blockers display as red warning cards with a "Blocked" label, a red dot indicator, and danger-colored styling. Resolved Blockers display muted (opacity-60) with line-through text and a green "Resolved" label. On the StoryCard, only unresolved Blockers trigger a lock icon (🔒).

## Acceptance Criteria

Acceptance Criteria are human-readable conditions of satisfaction for a Story. They are stored as a list of strings and rendered as a numbered checklist in the Story detail view.

## Behavior

A Behavior is an agent-generated testable verification step derived from Acceptance Criteria. Behaviors are tracked in a separate table with individual validation status. This concept is currently dormant and not surfaced on the Board. It will be revisited in future work.

## GitHub Sync

A Story may be linked to a GitHub Issue. The linkage is tracked via `github_sync_state` which records the GitHub issue number, last-synced timestamps, sync direction, and any sync errors. This is backend infrastructure — the Board does not display GitHub sync state.

## Viewer

A Viewer is an unauthenticated visitor to the Board. Viewers can see everything: the Board, all Stories, all detail views. Viewers cannot Transition stories. Where the Transition UI would appear, a Viewer sees a clickable "Sign in to edit" button with a lock icon. Clicking it triggers the GitHub OAuth sign-in flow.

## Owner

An Owner is an authenticated user (via GitHub OAuth) who has all Viewer capabilities plus the ability to Transition Stories between statuses. The Owner is identified by their Supabase Auth user ID, matched against RLS policies.

## Terminal View

The Terminal view shows all Terminal Stories (cancelled and failed) across all Projects. It is accessed via a button on the Board. Terminal Stories can be Reactivated from this view.
