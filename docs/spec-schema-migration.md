# Spec: Schema Migration

## Problem Statement

The backlog database was migrated from one Supabase project to another with a fresh baseline schema. The new schema adds Wayfinder support (maps, tickets, ticket dependencies), GitHub sync state, story key counters, and new foreign key columns on existing tables. It also drops the `reviewed_by` column from stories.

The frontend has four problems:

1. **Wrong project.** The Supabase client points to the old project. The frontend reads from a database that no longer represents the source of truth.

2. **Stale types.** The `Story` type includes `reviewed_by` which doesn't exist in either database. It's missing `wayfinder_ticket_id` which does exist in the new database. The `Project` type is missing `github_repo_id`.

3. **Dead UI.** The Story detail overlay renders a Reviewer row that can never show data because the `reviewed_by` column doesn't exist. The code is dead weight.

4. **No Wayfinder visibility.** The new database has 33 wayfinder tickets across 1 wayfinder map with 41 ticket dependencies, but the frontend has no UI to display any of it. Users can see wayfinder maps exist but can't browse their tickets.

## Solution

A two-phase change:

**Phase 1 — Schema alignment.** Switch the Supabase client to the new project. Remove the dead `reviewed_by` field from types and all references across the codebase. Add the two missing columns (`wayfinder_ticket_id`, `github_repo_id`) to the type definitions. Delete the dead Reviewer UI from the Story detail overlay. These are pure alignment changes — the Reviewer row was already always hidden, so there's no user-visible behavior difference.

**Phase 2 — Wayfinder ticket cards.** Expose wayfinder tickets through the existing data adapter and build card-based UI so users can browse tickets within a wayfinder map. New types for wayfinder domain objects, a ticket card component matching the existing card aesthetic, a map view to list tickets, and navigation that reuses the existing project dropdown pattern.

## User Stories

### Phase 1 — Schema Alignment

1. As a Developer, I want the Supabase client to point to the new project, so that the frontend reads from the current source of truth.
2. As a Developer, I want the `Story` type to match the database columns exactly — no `reviewed_by`, with `wayfinder_ticket_id` present — so that TypeScript catches column mismatches at compile time.
3. As a Developer, I want the `Project` type to include `github_repo_id`, so that the type reflects the full database row.
4. As a Viewer, I want the Story detail overlay to only show fields that actually exist in the database, so that the UI doesn't contain dead code paths.
5. As a Developer, I want all test fixtures to match the updated types, so that the existing test suite passes without modification to test logic.

### Phase 2 — Wayfinder Ticket Cards

6. As a Viewer, I want to see wayfinder tickets as cards within a map view, so that I can browse the 33 tickets already in the database.
7. As a Viewer, I want each ticket card to show its type — research, prototype, grilling, or scaffold — as a colored badge, so that I can distinguish ticket categories at a glance.
8. As a Viewer, I want each ticket card to show whether human-in-the-loop is required, so that I know which tickets need my involvement.
9. As a Viewer, I want each ticket card to show its status — open, claimed, or closed — so that I can see where each ticket stands.
10. As a Viewer, I want closed tickets to show their resolution text, so that I can see the outcome without opening a detail view.
11. As a Viewer, I want ticket cards to show a dependency count when the ticket depends on other tickets, so that I can spot blocked or complex tickets.
12. As a Viewer, I want to select a wayfinder map to view its tickets, reusing the existing project dropdown interaction pattern, so that navigation feels familiar.
13. As a Viewer, I want ticket cards sorted by their defined sort order, so that the intentional ordering from the database is preserved.
14. As a Viewer, I want the wayfinder map view to show map metadata — destination, notes, decisions so far, not yet specified, and out of scope — so that I understand the map's context.
15. As a Viewer, I want the wayfinder map view to reuse the existing dark-themed card aesthetic, so that the UI feels cohesive with the Kanban board.
16. As a Viewer, I want to see skeleton loading cards while wayfinder data is being fetched, so that I know content is loading.
17. As a Viewer, I want an empty map to show a contextual empty state message, so that I know the map has no tickets rather than something being broken.

## Implementation Decisions

### Phase 1 — Schema alignment

**Project switch.** The Supabase client singleton is updated with the new project URL and publishable key. The new project uses the same RLS policy pattern as the old one — public read on all tables, authenticated write on all tables — so no auth model changes are needed.

**Type changes are mechanical.** Remove `reviewed_by` from the `Story` interface. Add `wayfinder_ticket_id` (nullable bigint) to `Story`. Add `github_repo_id` (nullable bigint) to `Project`. No runtime behavior changes — `reviewed_by` was always `undefined` at runtime because the column didn't exist, and the two new columns are additive (existing code that doesn't reference them continues to work).

**Dead UI removal.** The Reviewer row in the Story detail overlay's metadata section is deleted. This was a conditional render gated on `story.reviewed_by`, which was always falsy. Removing it changes no visible behavior.

**Data migration prerequisite.** The new project is empty (0 stories, 1 project). Story data must be migrated from the old project before Phase 1 is deployed, or the board will show an empty state. Data migration is out of scope for this spec. The old project should be preserved until the switch is deployed and verified.

### Phase 2 — Wayfinder ticket cards

**Types.** Three new interfaces: `WayfinderMap` (map metadata and status), `WayfinderTicket` (ticket with its type, HITL flag, status, resolution, sort order), and `WayfinderTicketDependency` (ticket-to-ticket dependency edge). Ticket type and status are constrained string unions matching the database CHECK constraints.

**Adapter extension.** The unified `BacklogAdapter` interface already fetches all tables in parallel and subscribes to Realtime changes on all of them. Wayfinder data follows the same pattern: `fetchAll` gains three additional parallel queries, and `AppData` gains three additional arrays. The Realtime channel already listens for `*` events on the schema; adding wayfinder tables to the subscription is mechanical.

This is the simpler path over a separate hook — the dataset is small (33 tickets, 1 map), and the existing "fetch everything, refetch on any change" pattern is proven and simple. A separate hook would duplicate the pattern for no benefit at this scale.

**WayfinderTicketCard component.** A card matching the existing `StoryCard` aesthetic: elevated background, rounded corners, priority-like colored stripe for ticket type. Displays the ticket title, a type badge (using the existing priority color slots mapped to ticket types — research uses the critical red slot, prototype uses high orange, grilling uses medium yellow, scaffold uses low gray), a HITL indicator (accent blue with a person icon, shown only when HITL is true), a status pill (matching the existing status label pattern but with ticket-specific labels), resolution text (shown only for closed tickets with non-null resolution), and a dependency count badge (using the existing `🔗 N` pattern from story cards).

**WayfinderMapView component.** A view that shows a single wayfinder map's tickets. Header with map title, destination, and status. Collapsible metadata sections for notes, decisions so far, not yet specified, and out of scope. Ticket list below, sorted by `sort_order`, rendered as `WayfinderTicketCard` components. Reuses the existing column-list scroll container and card gap styling from the Kanban board.

**Navigation.** Wayfinder maps belong to projects. Map selection is gated by project selection — the user picks a project first (using the existing project switcher), then picks a map from a secondary dropdown or segmented control below it. Selecting a map navigates to the `WayfinderMapView`. A back button returns to the Kanban board. This reuses the existing view-switching pattern already used for the Terminal view.

**Realtime.** Wayfinder tables are added to the existing Realtime subscription. Any insert, update, or delete on wayfinder maps, tickets, or ticket dependencies triggers a full refetch, matching the existing behavior for stories, projects, blockers, and dependencies.

## Testing Decisions

### What makes a good test

Tests verify external behavior — what the user sees and can do — not implementation details. They mock at the highest seam (the `BacklogAdapter` factory). Empty states, loading states, and error states are tested explicitly; these are the most common failure modes in data-driven UIs.

### Seams

The existing `BacklogAdapter` interface is the sole seam. No new seams are introduced. For Phase 1, no behavioral tests are needed — the TypeScript compiler and existing test suite serve as the regression net. For Phase 2, the memory adapter is extended to accept optional wayfinder arrays in its constructor, matching the existing pattern for stories, projects, blockers, and dependencies.

### Test scenarios — Phase 1

- `npx tsc --noEmit` passes with zero errors after all type changes
- The existing 52+ tests pass without modification to test logic (fixture updates only)
- Story detail overlay no longer references `reviewed_by` in its rendered output

### Test scenarios — Phase 2

- `WayfinderTicketCard` renders all four ticket types with correct badge colors
- `WayfinderTicketCard` shows HITL indicator when HITL is true, hides it when false
- `WayfinderTicketCard` shows resolution text for closed tickets, hides it for open or claimed
- `WayfinderTicketCard` shows dependency count badge when the ticket has dependencies
- `WayfinderTicketCard` hides dependency count badge when the ticket has no dependencies
- `WayfinderMapView` lists tickets sorted by `sort_order`
- `WayfinderMapView` displays map metadata — destination, notes, decisions so far, not yet specified, out of scope
- `WayfinderMapView` collapses and expands metadata sections on interaction
- Map selector dropdown filters maps by the selected project
- Map with no tickets shows a contextual empty state message
- Loading state shows skeleton cards matching `WayfinderTicketCard` shape
- Selecting a map navigates to the wayfinder map view
- Back button from wayfinder map view returns to the Kanban board

### Prior art

The existing 52+ tests follow this pattern: mock the adapter factory, construct a memory adapter with fixture data, render the component, assert on rendered output and user interactions. The `App.test.tsx` integration tests demonstrate the full pattern. Component-level tests for `WayfinderTicketCard` and `WayfinderMapView` follow the same approach.

## Out of Scope

- **Data migration from old to new project.** Migrating story data between Supabase projects is a separate operational task. This spec assumes it happens before Phase 1 deployment.
- **Wayfinder ticket CRUD.** Ticket cards are read-only display, same as story cards. Agents create and update tickets programmatically.
- **Wayfinder ticket status transitions.** Ticket status is displayed but not modifiable from the UI. Unlike stories, tickets don't have a transition UI in this spec.
- **Wayfinder ticket detail overlay.** Card-level display only. A full detail overlay for tickets (like StoryDetail for stories) is a separate feature.
- **Ticket dependency resolution.** Dependencies between tickets are displayed as a count only. Resolving dependency target details (ticket titles, statuses) requires a follow-up feature.
- **GitHub Sync UI.** The `github_sync_state` table exists but no sync status is displayed on the board. This was out of scope in the original spec and remains so.
- **Story key counters UI.** The `story_key_counters` table is backend-only infrastructure. No frontend integration.
- **Desktop multi-column layout.** The board remains mobile-first single-column, same as the original spec.

## Further Notes

- The new project uses the same RLS policy pattern as the old one. ADR 0001 (public-read, owner-write auth) still applies unchanged.
- The `wayfinder_ticket_id` foreign key on stories creates a bidirectional link — a story can reference the wayfinder ticket that spawned it. When a ticket detail overlay is built later, this enables cross-navigation.
- The prototype code on the `prototype/kanban-variants` branch demonstrates the card aesthetic that `WayfinderTicketCard` should match.
- The domain model vocabulary should be updated with Wayfinder terms (Map, Ticket, Ticket Type, HITL) after implementation.
