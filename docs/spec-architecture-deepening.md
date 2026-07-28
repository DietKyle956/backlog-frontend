# Spec: Architecture Deepening — Module Consolidation

## Problem Statement

The codebase has five shallow spots where complexity is either scattered across callers or duplicated across modules. These make the code harder to test, harder for agents to navigate, and harder to modify safely:

1. **Transition-error flow spans four modules.** `App.tsx` acts as a pass-through shim between `StoryDetail`/`TerminalView` and the `TransitionRunner`. A call to transition a Story threads through `App` solely to add error-toast wiring. This puts 25 lines of shallow orchestration in the root component.

2. **StoryDetail receives unresolved reference arrays.** To display a Blocker's blocking Story key or a Dependency's target Story status, `StoryDetail` receives the full `allStories` array and runs linear `.find()` lookups at render time. Seven props, three of which are raw reference arrays.

3. **Two adapter interfaces that never vary independently.** `BoardDataAdapter` (in `lib/data.ts`) and `TransitionAdapter` (in `lib/transitions.ts`) are always satisfied by the same concrete adapter. The `updateStoryStatus` method shape appears in both. The split creates two interface declarations where one would suffice.

4. **Project-selection state machine scattered across App.tsx.** The "which project do I show?" logic spans four locations (localStorage read, useState initializer, useEffect with an `initialized` guard, handleProjectChange callback) plus a boolean flag that exists only to prevent repeated effect fires.

5. **Priority colors defined in two places.** The priority display system has CSS theme variables in `index.css` and parallel TypeScript lookup tables (`PRIORITY_COLORS`, `PRIORITY_BG`, `resolvePriority`) in `types.ts`. Adding a priority level means editing both.

## Solution

Five targeted refactors that consolidate scattered logic into deep modules, each with a small interface and substantial implementation. The existing test suite (85+ assertions) serves as the regression net. The exterior behaviour of the app is unchanged — a user sees the same board, the same transitions, the same error messages.

## User Stories

### A: useTransition hook (Strong)

1. As an Owner, I want transition error messages to appear near the button I clicked (not in a top-level toast), so that I notice failures immediately.
2. As an Owner, I want the detail overlay to close automatically after a successful transition, so that I return to the board without an extra tap.
3. As a developer, I want to test transition error handling without mounting the full App component, so that transition tests are simpler and faster.
4. As a developer, I want StoryDetail and TerminalView to call the same transition hook, so that transition logic has locality in one module instead of being threaded through App.tsx.

### B: Pre-resolved detail props (Worth exploring)

5. As a developer, I want to test StoryDetail with pre-resolved Blocker and Dependency data, so that I don't need to construct matching allStories arrays in every test.
6. As a developer, I want cross-reference resolution to happen where the data lives (Board), not in the render layer (StoryDetail), so that the resolution logic can be tested independently.
7. As a developer, I want StoryDetail's props to shrink from 7 to 5, with raw reference arrays replaced by resolved objects, so that the interface is smaller than the implementation.

### C: Unified adapter interface (Worth exploring)

8. As a developer, I want one adapter interface to learn instead of two, so that I can understand the data-access seam in one place.
9. As a developer, I want the adapter interface and its two implementations (Supabase, Memory) colocated, so that adding a method to the interface shows me both adapters that need updating.
10. As a developer, I want the `TransitionAdapter` type to be derivable from the unified interface (`Pick<BacklogAdapter, 'updateStoryStatus'>`), so that the TransitionRunner doesn't import from a separate interface file.

### D: useProjectSelection hook (Worth exploring)

11. As a developer, I want project-selection logic (localStorage restore, fallback, persistence) in one hook, so that I can test it without mounting App or mocking localStorage.
12. As a developer, I want the `initialized` boolean guard to disappear behind a hook interface, so that the hand-rolled state machine is encapsulated.
13. As a Viewer, I want project selection to work identically to before, so that my last-viewed project still restores on page load.

### E: Priority consolidation (Speculative)

14. As a developer, I want to add a new priority level by editing one CSS block, so that I don't need to synchronize changes across CSS and TypeScript.
15. As a developer, I want the three Priority lookup tables (`PRIORITY_COLORS`, `PRIORITY_BG`, `resolvePriority`) deleted, so that priority display has a single source of truth.

## Implementation Decisions

### Candidate A: useTransition hook

- Create `src/hooks/useTransition.ts` exporting `useTransition(adapter)` that returns `{ performTransition, error, clearError }`.
- The hook calls `createTransitionRunner(adapter)` internally and manages `error` state via `useState`.
- `performTransition` accepts `(storyId, currentStatus, newStatus)` and calls the runner. On success it returns the result. On failure it sets the `error` state.
- `clearError` resets the error to `null`.
- `StoryDetail` and `TerminalView` import `useTransition` directly instead of receiving `onTransition`/`onReactivate` as props.
- `App.tsx` drops `handleTransition`, `handleReactivate`, `transitionError`, and the toast markup (~25 lines).
- The detail overlay closes on successful transition (a UX win that comes for free once the hook owns the flow).

### Candidate B: Pre-resolved detail props

- Define `ResolvedBlocker` type: `Blocker` fields plus `blockingStoryKey?: string` (resolved from `allStories`).
- Define `ResolvedDependency` type: `Dependency` fields plus `dependsOnStory?: { key, title, status }`.
- `Board.tsx` resolves these when `selectedStory` is set, before passing to `StoryDetail`. The linear `.find()` calls move from StoryDetail's render to Board's click handler.
- `StoryDetail` drops the `allStories`, `blockers`, and `dependencies` props. It receives `resolvedBlockers: ResolvedBlocker[]` and `resolvedDeps: ResolvedDependency[]` instead.
- `StoryDetail` drops `isAuthenticated` — it's only used to gate transition buttons, which moves to the `useTransition` hook.
- `StoryDetail` drops `onTransition` — also moves to the hook.

### Candidate C: Unified adapter interface

- Merge `BoardDataAdapter` (from `lib/data.ts`) and `TransitionAdapter` (from `lib/transitions.ts`) into a single `BacklogAdapter` interface in a new file `lib/adapter.ts`.
- The interface has three methods: `fetchAll`, `updateStoryStatus`, `onDataChange`.
- `createTransitionRunner` accepts `Pick<BacklogAdapter, 'updateStoryStatus'>` instead of the separate `TransitionAdapter`.
- `useBoardData` accepts `BacklogAdapter` instead of `BoardDataAdapter`.
- Both adapter implementations (`supabase-adapter.ts`, `memory-adapter.ts`) implement `BacklogAdapter` instead of the two separate interfaces.
- Delete the interface declarations from `lib/data.ts` and `lib/transitions.ts`. The `TransitionResult` and `TransitionRunner` types stay in `lib/transitions.ts` since they're runner concepts, not adapter concepts.
- `lib/data.ts` is removed (its only export was the interface).

### Candidate D: useProjectSelection hook

- Create `src/hooks/useProjectSelection.ts` exporting `useProjectSelection(data, adapter?)`.
- The hook returns `{ selectedProject, selectProject, filteredStories }`.
- Internally: reads localStorage on init, falls back to first project alphabetically, saves to localStorage on `selectProject`, filters stories by `project_id`.
- The `initialized` boolean becomes an internal `useRef` gate — callers never see it.
- `App.tsx` replaces `selectedProjectId`, `handleProjectChange`, `filteredStories`, `initialized`, and the restore-useEffect with one call to `useProjectSelection`.

### Candidate E: Priority consolidation

- Delete `PRIORITY_COLORS`, `PRIORITY_BG`, and `resolvePriority` from `types.ts`.
- Components that currently call `resolvePriority(priority)` instead read CSS custom properties inline: `style={{ backgroundColor: `var(--priority-${priority}-bg)`, color: `var(--priority-${priority}-color)` }}`.
- The priority labels (`PRIORITY_LABELS`) stay — they're data, not presentation.
- `index.css` already defines `--color-priority-1` through `--color-priority-4`. Add matching background variants as `--color-priority-1-bg` through `--color-priority-4-bg` so the inline `var()` references work.

### Implementation order

The candidates are designed to compose without conflicts, but the recommended order is:

1. **Candidate C first** (unified adapter) — it changes the interface that A, B, and D depend on. Land this first so subsequent candidates import from one place.
2. **Candidate A** (useTransition hook) — highest leverage, directly improves UX (auto-close overlay on success).
3. **Candidate D** (useProjectSelection hook) — further shrinks App.tsx.
4. **Candidate B** (pre-resolved detail props) — shrinks StoryDetail's interface. Depends on A (the hook removes `onTransition` and `isAuthenticated` from the interface anyway).
5. **Candidate E** (priority consolidation) — independent cleanup, can land any time.

## Testing Decisions

### What makes a good test

- Test external behaviour at the hook or component interface, not internal state transitions.
- Mock at the highest seam. For hooks, the seam is the adapter parameter. For components, the seam is the hook return value.
- Existing tests must continue to pass unmodified for candidates C, D, and E (these are pure refactors). Candidates A and B touch component interfaces, so some test adaptation is expected.

### Candidate A tests

- **Seam**: The `adapter` parameter to `useTransition`. Tests pass a stub adapter that returns success or error.
- Test: `performTransition` calls adapter with correct args and returns success.
- Test: `performTransition` sets `error` state on adapter failure.
- Test: `clearError` resets error to null.
- Test: concurrent transition guard is inherited from TransitionRunner (already tested in `transitions.test.ts`).
- **Integration**: StoryDetail and TerminalView tests adapt to receive `useTransition` result instead of `onTransition` prop.

### Candidate B tests

- **Seam**: `StoryDetail` receives `resolvedBlockers` and `resolvedDeps` props instead of raw arrays.
- Test: StoryDetail renders resolved blocker with `blockingStoryKey` displayed.
- Test: StoryDetail renders resolved dependency with story key and status.
- Test: Resolution logic (in Board) testable as a pure function: `resolveBlockers(blockers, storyMap)`.
- **Prior art**: Existing StoryDetail tests in `App.test.tsx` that verify blocker and dependency rendering. These tests adapt by providing resolved props instead of raw arrays.

### Candidate C tests

- **Seam**: The unified `BacklogAdapter` interface — already tested implicitly by `data.test.ts` (memory adapter) and `App.test.tsx` (mocked supabase adapter).
- Test: `data.test.ts` imports from `lib/adapter.ts` instead of `lib/data.ts`.
- Test: `transitions.test.ts` uses `Pick<BacklogAdapter, 'updateStoryStatus'>` stub.
- No behavioural changes — existing tests serve as the regression net.

### Candidate D tests

- **Seam**: The `useProjectSelection` hook interface. Tests mount the hook with mock project data.
- Test: Restores saved project from localStorage.
- Test: Falls back to first project alphabetically when no localStorage value.
- Test: `selectProject` updates selected project and persists to localStorage.
- Test: `filteredStories` filters by selected project ID.
- **Prior art**: Existing App.test.tsx tests for project persistence (BLF-002). These become hook-level tests.

### Candidate E tests

- No new tests needed. Existing tests that verify priority badge colours in StoryCard and StoryDetail serve as the regression net. If colours change, the screenshot E2E tests catch visual drift.

### Prior art

- The adapter mock pattern in `App.test.tsx` (mocking `createSupabaseAdapter` at the module level) is the canonical test seam for this codebase. Hooks and components that take an adapter parameter follow the same pattern.
- Hook tests can use `@testing-library/react`'s `renderHook` for pure hook tests, or mount a wrapper component for hooks that need context.
- The pure-function tests in `columns.test.ts`, `transitions.test.ts`, and `data.test.ts` are the model for new unit-level tests on resolved types and consolidated logic.

## Out of Scope

- **Optimistic updates**: The transition UX improvement (auto-close overlay on success) is in scope as a side-effect of candidate A. Full optimistic update with rollback is out of scope — it requires coordination between the hook and the realtime subscription to avoid double-renders.
- **Progressive data loading**: Splitting `useBoardData` into independent hooks per table is out of scope. The current all-or-nothing fetch is appropriate for the dataset size.
- **Error Boundary**: Adding a React Error Boundary is out of scope for this deepening. It's a separate concern from module consolidation.
- **Environment-based Supabase config**: Moving Supabase credentials to Vite env vars is out of scope. The hardcoded publishable key is safe for the public-repo use case per ADR-0001.
- **Desktop multi-column layout**: The board remains single-column-at-a-time. This deepening does not add a desktop layout.
- **New features beyond the five candidates**: No new UI features. No new data tables. No schema changes.

## Further Notes

- The domain model in `CONTEXT.md` is the canonical vocabulary. All new modules, types, and tests use the terms Story, Transition, Board, Column, Blocker, Dependency, Project, Priority, Owner, and Viewer.
- ADR-0001 (public-read, owner-write auth model) is unaffected. Candidates A and D move auth-gated behaviour into hooks but do not change the auth mechanism.
- The existing test suite (85+ assertions across 6 suites) must pass at every step. No candidate should require skipping or deleting tests to land.
- Candidate A is the top recommendation because it has the highest leverage: two call sites (StoryDetail + TerminalView) get the same transition + error capability through one hook interface, and the UX improves as a side-effect (overlay auto-closes on success).
