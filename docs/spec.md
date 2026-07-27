# Spec: Mobile Kanban Board for Backlog Management

## Problem Statement

The backlog management system stores stories, projects, dependencies, and blockers in a Supabase database. This data is managed by agents (Claude Code instances) that create and update stories programmatically. However, there is no human-facing visual interface. As the owner, I need to browse the backlog on my phone, see what's in progress across projects, inspect story details (dependencies, blockers, acceptance criteria), and occasionally change a story's status to prevent agents from picking up work I don't want them to touch yet.

## Solution

A mobile-first, dark-themed Kanban board single-page web app hosted on GitHub Pages. It connects to the Supabase backlog database using the anon key for public reads and GitHub OAuth for authenticated status transitions. The board shows one Column at a time with swipe navigation (Tinder-style). It uses the Magazine Layout design (Variant C) from the UI prototype with OLED-optimized dark design tokens. Stories update live via Supabase Realtime.

## User Stories

1. As a Viewer, I want to open the board on my iPhone and immediately see stories in the first Column (Backlog) for the last project I viewed, so that I can check the backlog without any login friction.
2. As a Viewer, I want to swipe left and right to move between Columns (Backlog → Ready → In Progress → In Review → Done), so that I can see stories at each stage of the workflow.
3. As a Viewer, I want to see dot indicators showing my current Column position among the five, so that I know where I am in the workflow at a glance.
4. As a Viewer, I want to see each Story as a card with its Key, Title, Priority badge (Critical/High/Medium/Low), Blocked indicator (🔒), and Dependency count (🔗), so that I can scan the column efficiently.
5. As a Viewer, I want each card to show a colored top stripe and Priority badge matching the priority level, so that I can visually prioritize at a glance.
6. As a Viewer, I want an empty Column to show a contextual message ("Nothing here yet" with the column name), so that I know the column is empty rather than broken.
7. As a Viewer, I want to tap a Story card to open a full-screen detail overlay, so that I can see all story information.
8. As a Viewer, I want the detail overlay to show the Story's full Description, Acceptance Criteria as a numbered checklist, Dependencies with their current status (Done/Pending), and Blockers in a red warning section, so that I understand everything about the story.
9. As a Viewer, I want the detail overlay to show metadata (created date, updated date, reviewer), so that I know the story's history.
10. As a Viewer, I want to switch between Projects using a dropdown at the top of the board, so that I can view each project's board independently.
11. As a Viewer, I want to access a Terminal view showing all cancelled and failed stories across all projects, so that I can review stories that didn't complete.
12. As a Viewer, I want to search stories by title or key within the current Column, so that I can find specific stories quickly.
13. As a Viewer, I want to filter stories by priority level, so that I can focus on high-priority work.
14. As a Viewer, I want cards to update in real time when an agent changes a story's status, so that I see the board reflect reality without refreshing.
15. As a Viewer, I want to pull down to refresh the board, so that I can manually sync if Realtime misses an update.
16. As a Viewer, I want skeleton loading cards to appear while data is being fetched, so that I know content is loading.
17. As a Viewer, I want to see an error message if the data fails to load, so that I know something went wrong.
18. As an Owner, I want to sign in via GitHub OAuth from the board, so that I can unlock the ability to transition stories.
19. As an Owner, I want to see "Sign in to edit" in the detail overlay when I'm not authenticated, so that I know I need to sign in to make changes.
20. As an Owner, I want to see status transition buttons in the detail overlay after signing in, so that I can move stories between statuses.
21. As an Owner, I want to transition a Story to any valid next status (following the status transition map), so that I can control what agents pick up.
22. As an Owner, I want the transition to update optimistically in the UI (the card moves immediately), so that the board feels responsive.
23. As an Owner, I want the transition to be rejected if my session is invalid, with a clear error message, so that I know the update failed.
24. As an Owner, I want to reactivate a Terminal Story (move it from cancelled/failed to backlog) from the Terminal view, so that I can revive stories that should be worked on.
25. As an Owner, I want my authentication session to persist across page visits (via localStorage), so that I don't have to sign in every time I open the board.

## Implementation Decisions

### Tech stack
- Vite + React + TypeScript + Tailwind CSS v4
- Supabase JS client (`@supabase/supabase-js`) for data access and Realtime subscriptions
- Hosted on GitHub Pages from a public repository
- No router library (single-page app with conditional views)
- No state management library (React state + Supabase Realtime is sufficient)

### Design foundation
- Magazine Layout (Variant C from the UI prototype on branch `prototype/kanban-variants`)
- One Column visible at a time, swipe left/right to navigate between Columns
- Slide animation with spring physics on Column transitions
- Hero header with Column title, story count, and dash-style dot indicators
- Cards with elevated shadows, rounded corners, and a colored top stripe for priority
- Full-screen detail overlay (not a bottom sheet) with back navigation

### Design tokens (OLED-optimized dark theme)
- Canvas: `#0B0E14`, Surface: `#151A22`, Raised: `#1C2330`, Hover: `#222B3A`
- Borders: `#2A3344`
- Text primary: `#E8ECF1`, secondary: `#8896A6`, muted: `#556170`
- Accent: `#60A5FA` (blue), Success: `#34D399` (green), Danger: `#F87171` (red)
- Priority colors: Critical `#F87171`, High `#FB923C`, Medium `#FBBF24`, Low `#9CA3AF`

### Component architecture
- `App` — top-level: project switcher, Terminal view toggle, Board or Terminal view rendering
- `Board` — Column navigation (swipe + buttons), renders current Column's Story cards, search/filter bar
- `StoryCard` — card in the Column list: key badge, priority badge, blocked/dependency indicators, title, description preview, priority stripe
- `StoryDetail` — full-screen overlay: back button, description, acceptance criteria checklist, dependencies with status pills, blockers with red warnings, transition buttons (gated by auth), metadata footer
- `TerminalView` — cancelled/failed story list across all projects, with Reactivate action
- `useBoardData` — data fetching hook: fetches all tables, subscribes to Realtime changes, exposes refetch for pull-to-refresh

### Data flow
- On mount, fetch all projects, stories, dependencies, and unresolved blockers in parallel
- Subscribe to Supabase Realtime channel for `stories`, `projects`, and `blockers` table changes
- On any change event, refetch all data (simple and correct; the dataset is small)
- Pull-to-refresh triggers a manual refetch
- Status transitions validate the target against the allowed-transition map and guard against concurrent transitions, then delegate the status update to the `BoardDataAdapter.updateStoryStatus` interface (implemented by the Supabase adapter with the authenticated session)

### Auth model
- Supabase anon key embedded in the client bundle for public reads
- GitHub OAuth provider configured in Supabase Auth
- RLS policies: `SELECT` allowed for `anon` role on all tables; `UPDATE` on `stories.status` requires `auth.uid()` matching the owner's user ID
- Auth state tracked via `supabase.auth.getSession()` and `onAuthStateChange`
- Session persisted in localStorage by Supabase SDK
- Transition UI shows lock icon + "Sign in to edit" when unauthenticated, status pills when authenticated

### Status transition map (from domain model)
```
backlog → ready, cancelled
ready → in_progress, backlog, cancelled
in_progress → in_review, ready, failed
in_review → done, in_progress, failed
done → in_review
cancelled → backlog, failed
failed → backlog, cancelled
```

### Search and filter
- Text input filters stories in the current Column by title or key match (case-insensitive substring)
- Priority filter toggles: show/hide specific priority levels via small toggle chips
- Search term persists when switching Columns so you can sweep through with the filter active

### Column sort order
- Within each Column, stories sorted by Priority ascending (highest first), then by creation date ascending (oldest first)

### Pull-to-refresh
- Detect overscroll at the top of the card list
- Trigger `refetch()` from `useBoardData`
- Visual feedback: a subtle spinner or refresh indicator

### Real time updates
- Supabase Realtime channel for `stories` table (INSERT, UPDATE, DELETE)
- Also subscribe to `projects` and `blockers` changes
- On any event, refetch all data (full refresh; dataset is small enough that incremental updates add complexity without benefit)

### Project persistence
- Last viewed project ID saved to localStorage
- On load, restore the last project; default to the first project alphabetically if none saved

## Testing Decisions

### What makes a good test
- Test external behavior, not implementation details. A test should verify what the user sees and can do, not how components manage internal state.
- Prefer integration tests over unit tests. Mock at the highest seam possible (the `BoardDataAdapter` factory).
- Test empty states, loading states, and error states explicitly — these are the most common failure modes in data-driven UIs.

### Seams
- **Data seam**: Mock the `createSupabaseAdapter` factory (in `src/adapters/supabase-adapter.ts`) to return an in-memory adapter backed by a mutable data store. Tests control the store contents to simulate different data scenarios (empty project, project with stories in various statuses, project with dependencies and blockers) without hitting Supabase internals.
- **Auth seam**: Mock `supabase.auth.getSession()` to simulate Viewer (no session) and Owner (valid session) states.
- **Mutation seam**: The adapter mock's `updateStoryStatus` mutates the in-memory store directly, which allows tests to verify transitions by inspecting the store after the call, or to inject errors by returning `{ error: "…" }`.

### Test scenarios
- Board renders all 5 Columns with correct story counts
- Swiping left/right navigates between Columns
- Dot indicators reflect current Column position
- Empty Column shows contextual empty state
- Story cards display correct priority badge color for each level
- Blocked stories show 🔒 indicator
- Stories with dependencies show 🔗 count
- Tapping a card opens the detail overlay with all sections populated
- Detail overlay shows "Sign in to edit" when unauthenticated
- Detail overlay shows transition buttons when authenticated
- Transitioning a story calls the update function with correct status
- Failed transition shows error message
- Search filters stories by title and key
- Priority filter toggles show/hide correct priority levels
- Project switcher changes the displayed project
- Terminal view shows all cancelled and failed stories
- Reactivate moves a Terminal story to backlog
- Loading state shows skeleton cards
- Error state shows error message with retry option

### Prior art
- The `prototype/kanban-variants` branch contains working prototype code with real Supabase data fetching. The Variant C component demonstrates the data flow pattern (props-in, render cards, detail overlay) that the real implementation follows.
- The domain model in `CONTEXT.md` defines the canonical vocabulary for test descriptions.

## Out of Scope

- **Behaviors table integration** — the Behaviors concept is dormant; no UI for it in this spec.
- **GitHub Sync UI** — the `github_sync_state` table exists but no sync status is displayed on the board.
- **Desktop layout** — the board is mobile-first and optimized for a phone viewport. Desktop will work but won't get a multi-column layout.
- **Creating, editing, or deleting stories** — the board is read-only except for status transitions. Stories are created by agents.
- **Editing acceptance criteria, dependencies, or blockers** — read-only display of these fields.
- **User management or multi-owner support** — single owner only.
- **Offline support** — requires an internet connection.
- **Push notifications** — no notification system for status changes.

## Further Notes

- The prototype code (Variants A, B, C) is preserved on the `prototype/kanban-variants` branch. Variant C is the design winner and should inform but not constrain the implementation — rewrite it properly, don't copy-paste prototype code.
- The domain model in `CONTEXT.md` is the canonical vocabulary for this spec. All code, tests, and UI labels should use these terms.
- ADR 0001 documents the auth model decision. The implementation must respect the public-read, owner-write split.
- The board will be deployed to GitHub Pages at `https://<username>.github.io/backlog-frontend/`. The `base` path in `vite.config.ts` must match the repository name.
- RLS policies on the Supabase project must be configured before the board can read data in production. The `prototype/kanban-variants` branch worked against the existing RLS configuration, confirming the anon key approach is viable.
