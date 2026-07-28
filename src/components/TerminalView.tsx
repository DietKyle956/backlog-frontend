import type { Project, Story, StoryStatus } from "../types";
import { TERMINAL_STATUSES, COLUMN_LABELS } from "../types";
import type { BacklogAdapter } from "../lib/adapter";
import { useTransition } from "../hooks/useTransition";

interface TerminalViewProps {
  stories: Story[];
  projects: Project[];
  adapter: Pick<BacklogAdapter, "updateStoryStatus">;
  isAuthenticated: boolean;
  onClose: () => void;
}

export function TerminalView({
  stories,
  projects,
  adapter,
  isAuthenticated,
  onClose,
}: TerminalViewProps) {
  const { performTransition, error, clearError } = useTransition(adapter);
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
        <>
          {error && (
            <div className="px-3 py-2 bg-accent-danger/15 border border-accent-danger/30 rounded-lg text-sm text-accent-danger">
              {error}
              <button
                type="button"
                onClick={clearError}
                className="ml-2 underline"
              >
                Dismiss
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={async () => {
              const result = await performTransition(
                story.id,
                story.status as StoryStatus,
                "backlog",
              );
              if (result.success) {
                onClose();
              }
            }}
            className="w-full mt-2 px-4 py-2 text-sm font-medium rounded-lg
                       bg-accent/15 text-accent border border-accent/30
                       hover:bg-accent/20 active:scale-[0.98]
                       transition-all duration-100"
          >
            Reactivate to Backlog
          </button>
        </>
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
    </div>
  );
}
