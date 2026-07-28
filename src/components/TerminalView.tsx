import { useState } from "react";
import type { Project, Story, StoryStatus } from "../types";
import { TERMINAL_STATUSES, COLUMN_LABELS } from "../types";

interface TerminalViewProps {
  stories: Story[];
  projects: Project[];
  isAuthenticated: boolean;
  onClose: () => void;
  onOptimisticTransition: (
    storyId: number,
    currentStatus: StoryStatus,
    newStatus: StoryStatus,
  ) => Promise<void>;
}

export function TerminalView({
  stories,
  projects,
  isAuthenticated,
  onClose,
  onOptimisticTransition,
}: TerminalViewProps) {
  const [confirmingStoryId, setConfirmingStoryId] = useState<number | null>(
    null,
  );

  const terminalStories = stories.filter((s) =>
    TERMINAL_STATUSES.includes(s.status as StoryStatus),
  );

  const getProjectName = (projectId: number): string =>
    projects.find((p) => p.id === projectId)?.name ?? `Project #${projectId}`;

  const cancelledStories = terminalStories.filter(
    (s) => s.status === "cancelled",
  );
  const failedStories = terminalStories.filter(
    (s) => s.status === "failed",
  );

  const renderStoryCard = (story: Story) => (
    <div
      key={story.id}
      className="bg-surface rounded-xl border border-border-subtle p-4 space-y-2"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-accent bg-accent/10 px-2 py-0.5 rounded-md">
            {story.key}
          </span>
          <span className="text-xs text-text-muted">
            {getProjectName(story.project_id)}
          </span>
        </div>
        <span
          className={`text-xs px-2 py-0.5 rounded-md ${
            story.status === "cancelled"
              ? "bg-text-muted/15 text-text-muted"
              : "bg-accent-danger/15 text-accent-danger"
          }`}
        >
          {COLUMN_LABELS[story.status]}
        </span>
      </div>
      <h3 className="text-sm font-semibold text-text-primary">
        {story.title}
      </h3>
      {isAuthenticated && (
        <button
          type="button"
          onClick={() => setConfirmingStoryId(story.id)}
          className="w-full mt-2 px-4 py-2 text-sm font-medium rounded-lg
                     bg-accent/15 text-accent border border-accent/30
                     hover:bg-accent/20 active:scale-[0.98]
                     transition-all duration-100"
        >
          Reactivate to Backlog
        </button>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-canvas animate-fade-in overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-canvas/95 backdrop-blur-sm border-b border-border-subtle">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="text-text-secondary hover:text-text-primary transition-colors p-1 -ml-1"
            aria-label="Close terminal view"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-bold text-text-primary">Terminal</h1>
          <span className="text-sm text-text-muted">
            {terminalStories.length}{" "}
            {terminalStories.length === 1 ? "story" : "stories"}
          </span>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {terminalStories.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-lg font-semibold text-text-muted">
              No terminal stories
            </p>
            <p className="text-sm text-text-muted/70 mt-1">
              Cancelled and failed stories appear here
            </p>
          </div>
        ) : (
          <>
            {/* Cancelled group */}
            {cancelledStories.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-3">
                  Cancelled ({cancelledStories.length})
                </h2>
                <div className="space-y-3">
                  {cancelledStories.map(renderStoryCard)}
                </div>
              </section>
            )}

            {/* Failed group */}
            {failedStories.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-3">
                  Failed ({failedStories.length})
                </h2>
                <div className="space-y-3">
                  {failedStories.map(renderStoryCard)}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      {/* Confirmation modal */}
      {confirmingStoryId !== null && (() => {
        const story = stories.find((s) => s.id === confirmingStoryId);
        if (!story) return null;
        return (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setConfirmingStoryId(null)}
            />
            {/* Dialog */}
            <div className="relative bg-surface rounded-xl border border-border-subtle shadow-2xl p-6 max-w-sm w-full animate-scale-in">
              <h2 className="text-lg font-bold text-text-primary mb-2">
                Reactivate Story
              </h2>
              <p className="text-sm text-text-secondary mb-6">
                Are you sure you want to reactivate{" "}
                <span className="font-semibold text-text-primary">
                  {story.key}
                </span>{" "}
                from{" "}
                <span className="font-semibold">
                  {COLUMN_LABELS[story.status as StoryStatus]}
                </span>{" "}
                back to Backlog?
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setConfirmingStoryId(null)}
                  className="flex-1 px-4 py-2 text-sm font-medium rounded-lg
                             bg-surface-raised text-text-secondary border border-border-subtle
                             hover:bg-surface-hover transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onOptimisticTransition(
                      story.id,
                      story.status as StoryStatus,
                      "backlog",
                    );
                    setConfirmingStoryId(null);
                  }}
                  className="flex-1 px-4 py-2 text-sm font-medium rounded-lg
                             bg-accent text-white
                             hover:opacity-90 active:scale-[0.98]
                             transition-all duration-100"
                >
                  Reactivate
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
