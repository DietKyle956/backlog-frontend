import type { Story, Blocker, Dependency, StoryStatus } from "../types";
import { COLUMN_LABELS, resolvePriority } from "../types";
import { getAllowedTargets } from "../lib/transitions";
import type { TransitionResult } from "../lib/transitions";

interface StoryDetailProps {
  story: Story;
  allStories: Story[];
  blockers: Blocker[];
  dependencies: Dependency[];
  isAuthenticated: boolean;
  onClose: () => void;
  onTransition: (
    storyId: number,
    currentStatus: StoryStatus,
    newStatus: StoryStatus,
  ) => Promise<TransitionResult>;
}

export function StoryDetail({
  story,
  allStories,
  blockers,
  dependencies,
  isAuthenticated,
  onClose,
  onTransition,
}: StoryDetailProps) {
  const storyBlockers = blockers.filter(
    (b) => b.story_id === story.id,
  );
  const storyDeps = dependencies.filter(
    (d) => d.story_id === story.id,
  );
  const unresolvedBlockers = storyBlockers.filter((b) => !b.resolved_at);
  const resolvedBlockers = storyBlockers.filter((b) => b.resolved_at);
  const { label: priorityLabel, color: priorityColor, bg: priorityBg } =
    resolvePriority(story.priority);

  const getDepStory = (id: number): Story | undefined =>
    allStories.find((s) => s.id === id);

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  return (
    <div className="fixed inset-0 z-50 bg-canvas animate-slide-in-right overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-canvas/95 backdrop-blur-sm border-b border-border-subtle">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="text-text-secondary hover:text-text-primary transition-colors p-1 -ml-1"
            aria-label="Close detail"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-xs font-mono text-accent bg-accent/10 px-2 py-0.5 rounded-md">
            {story.key}
          </span>
          <span
            className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-md"
            style={{ color: priorityColor, backgroundColor: priorityBg }}
          >
            {priorityLabel}
          </span>
          <span className="text-xs text-text-muted bg-surface-raised px-2 py-0.5 rounded-md">
            {COLUMN_LABELS[story.status]}
          </span>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Title */}
        <h2 className="text-lg font-bold text-text-primary leading-snug">
          {story.title}
        </h2>

        {/* Blockers warning */}
        {storyBlockers.length > 0 ? (
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              Blockers
            </h3>
            {/* Unresolved blockers */}
            {unresolvedBlockers.length > 0 && (
              <div className="space-y-2">
                {unresolvedBlockers.map((b) => (
                  <div
                    key={b.id}
                    className="bg-accent-danger/10 border border-accent-danger/30 rounded-xl p-3 space-y-1"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-accent-danger flex-shrink-0" />
                      <span className="text-xs font-semibold text-accent-danger uppercase tracking-wider">
                        Blocked
                      </span>
                    </div>
                    <p className="text-sm text-text-secondary">
                      {b.description || "No description provided"}
                    </p>
                    {b.blocking_story_id && (
                      <p className="text-xs text-accent">
                        Blocking:{" "}
                        {getDepStory(b.blocking_story_id)?.key ??
                          `#${b.blocking_story_id}`}
                        {getDepStory(b.blocking_story_id) &&
                          ` - ${getDepStory(b.blocking_story_id)!.title}`}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
            {/* Resolved blockers */}
            {resolvedBlockers.length > 0 && (
              <div className="space-y-1.5">
                {resolvedBlockers.map((b) => (
                  <div
                    key={b.id}
                    className="bg-surface-raised border border-border-subtle rounded-lg p-3 opacity-60"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-2 h-2 rounded-full bg-accent-success flex-shrink-0" />
                      <span className="text-xs font-medium text-accent-success">
                        Resolved
                      </span>
                    </div>
                    <p className="text-sm text-text-muted line-through">
                      {b.description || "No description provided"}
                    </p>
                    {b.blocking_story_id && (
                      <p className="text-xs text-text-muted mt-1">
                        Blocking:{" "}
                        {getDepStory(b.blocking_story_id)?.key ??
                          `#${b.blocking_story_id}`}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {/* Description */}
        {story.description && (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              Description
            </h3>
            <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">
              {story.description}
            </p>
          </div>
        )}

        {/* Acceptance Criteria */}
        {story.acceptance_criteria &&
          Array.isArray(story.acceptance_criteria) &&
          story.acceptance_criteria.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                Acceptance Criteria
              </h3>
              <ol className="list-decimal list-inside space-y-1.5">
                {story.acceptance_criteria.map((ac, i) => (
                  <li key={i} className="text-sm text-text-secondary">
                    {ac}
                  </li>
                ))}
              </ol>
            </div>
          )}

        {/* Dependencies */}
        {storyDeps.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              Dependencies
            </h3>
            <div className="space-y-1.5">
              {storyDeps.map((dep) => {
                const depStory = getDepStory(dep.depends_on_id);
                const isDone =
                  depStory?.status === "done";
                return (
                  <div
                    key={dep.depends_on_id}
                    className="flex items-center gap-2 text-sm"
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isDone
                          ? "bg-accent-success"
                          : "bg-text-muted"
                      }`}
                    />
                    <span className="text-text-secondary">
                      {depStory?.key ?? `#${dep.depends_on_id}`}
                      {depStory && ` - ${depStory.title}`}
                    </span>
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded-md ${
                        isDone
                          ? "bg-accent-success/15 text-accent-success"
                          : "bg-text-muted/15 text-text-muted"
                      }`}
                    >
                      {isDone ? "Done" : "Pending"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Transition buttons */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            Transition
          </h3>
          {isAuthenticated ? (
            <div className="flex flex-wrap gap-2">
              {getAllowedTargets(story.status).map((target) => (
                <button
                  key={target}
                  type="button"
                  onClick={() =>
                    onTransition(story.id, story.status, target)
                  }
                  className="px-4 py-2 text-sm font-medium rounded-lg
                             bg-surface-raised border border-border-subtle text-text-primary
                             hover:bg-surface-hover active:scale-95
                             transition-all duration-100"
                >
                  {COLUMN_LABELS[target]}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-text-muted italic">
              Sign in to edit
            </p>
          )}
        </div>

        {/* Metadata */}
        <div className="space-y-1.5 pt-4 border-t border-border-subtle">
          <div className="flex justify-between text-xs">
            <span className="text-text-muted">Created</span>
            <span className="text-text-secondary">{formatDate(story.created_at)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-text-muted">Updated</span>
            <span className="text-text-secondary">{formatDate(story.updated_at)}</span>
          </div>
          {story.reviewed_by && (
            <div className="flex justify-between text-xs">
              <span className="text-text-muted">Reviewer</span>
              <span className="text-text-secondary">{story.reviewed_by}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
