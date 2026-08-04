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

## Wayfinder Map

A Wayfinder Map is a structured design document for a Project. It has a title, a destination (the end state the map aims to reach), and metadata sections: notes, decisions so far, not yet specified, and out of scope. Each map belongs to exactly one Project. A Map has a status (active, completed, or archived). Maps are browsed via the Map Selector dropdown next to the Project switcher.

## Wayfinder Ticket

A Wayfinder Ticket is a unit of design work within a Wayfinder Map. Each Ticket has a title, a question (what the ticket aims to answer), a Ticket Type, a sort order, an optional resolution (filled when the ticket is closed), and a HITL flag. Tickets are displayed as cards in the Wayfinder Map View, sorted by their sort order.

## Ticket Type

A Ticket's type classifies the nature of the work. The four types, mapped to the existing priority color slots, are:

| Type | Priority slot | Color |
|---|---|---|
| `research` | Critical (1) | Red |
| `prototype` | High (2) | Orange |
| `grilling` | Medium (3) | Yellow |
| `scaffold` | Low (4) | Gray |

## HITL

Human-in-the-loop. A boolean flag on a Wayfinder Ticket indicating that the ticket requires human involvement. When true, a HITL badge (accent blue with a person icon) appears on the ticket card.

## Wayfinder Ticket Dependency

A directional dependency between two Wayfinder Tickets: one ticket depends on another. Displayed as a count badge (🔗N) on the ticket card. Resolution of dependency target details (ticket titles, statuses) is not yet implemented.

## Wayfinder Map View

The view shown when a Wayfinder Map is selected from the Map Selector. Displays the map's destination, collapsible metadata sections, and a scrollable list of Wayfinder Ticket Cards. A back button returns to the Kanban Board.

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
