import type { Story, Blocker } from "../types";
import { resolvePriority } from "../types";

interface StoryCardProps {
  story: Story;
  blockers: Blocker[];
  dependencyCount: number;
  onClick: () => void;
}

export function StoryCard({
  story,
  blockers,
  dependencyCount,
  onClick,
}: StoryCardProps) {
  const hasUnresolvedBlockers = blockers.some(
    (b) => b.story_id === story.id,
  );
  const { label: priorityLabel, color: priorityColor, bg: priorityBg } =
    resolvePriority(story.priority);

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left bg-surface rounded-xl overflow-hidden
                 border border-border-subtle shadow-lg shadow-black/20
                 active:scale-[0.98] transition-transform duration-100
                 focus:outline-none focus:ring-2 focus:ring-accent/50"
    >
      {/* Priority stripe */}
      <div
        className="h-1 w-full"
        style={{ backgroundColor: priorityColor }}
      />

      <div className="p-4 space-y-2">
        {/* Header row: key + priority badge */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-mono text-accent bg-accent/10 px-2 py-0.5 rounded-md">
            {story.key}
          </span>
          <div className="flex items-center gap-1.5">
            {hasUnresolvedBlockers && (
              <span
                className="text-xs"
                title="Blocked"
                aria-label="Blocked"
              >
                &#128274;
              </span>
            )}
            {dependencyCount > 0 && (
              <span
                className="text-xs text-text-muted"
                title={`${dependencyCount} dependencies`}
                aria-label={`${dependencyCount} dependencies`}
              >
                &#128279;{dependencyCount}
              </span>
            )}
            <span
              className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-md"
              style={{
                color: priorityColor,
                backgroundColor: priorityBg,
              }}
            >
              {priorityLabel}
            </span>
          </div>
        </div>

        {/* Title */}
        <h3 className="text-sm font-semibold text-text-primary leading-snug line-clamp-2">
          {story.title}
        </h3>

        {/* Description preview */}
        {story.description && (
          <p className="text-xs text-text-secondary line-clamp-2 leading-relaxed">
            {story.description.replace(/^#+\s.*$/gm, "").trim()}
          </p>
        )}
      </div>
    </button>
  );
}
