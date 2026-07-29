import type { Story, Blocker } from "../types";
import { PRIORITY_LABELS } from "../types";

/** Strip markdown formatting so the card preview is clean, predictable plain text. */
function cleanDescription(raw: string): string {
  return raw
    // Strip ATX headings (## ..., ### ..., etc.)
    .replace(/^#{1,6}\s.*$/gm, "")
    // Strip bold (**text**) and italic (*text* or _text_)
    .replace(/\*{1,2}([^*]+)\*{1,2}/g, "$1")
    .replace(/\b_{1,2}([^_]+)_{1,2}\b/g, "$1")
    // Strip list markers at line start (- item, * item)
    .replace(/^[-*]\s/gm, "")
    // Strip inline code backticks
    .replace(/`([^`]+)`/g, "$1")
    // Collapse 2+ newlines into a single space, then collapse 2+ spaces
    .replace(/\n{2,}/g, " ")
    .replace(/[ \t]{2,}/g, " ")
    // Normalize remaining newlines to spaces
    .replace(/\n/g, " ")
    .trim();
}

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
    (b) => b.story_id === story.id && !b.resolved_at,
  );
  const p = story.priority in PRIORITY_LABELS ? story.priority : 4;
  const priorityLabel = PRIORITY_LABELS[p];
  const priorityColor = `var(--color-priority-${p})`;
  const priorityBg = `var(--color-priority-${p}-bg)`;

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
            {cleanDescription(story.description)}
          </p>
        )}
      </div>
    </button>
  );
}
