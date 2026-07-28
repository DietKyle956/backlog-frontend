/**
 * SkeletonCard mirrors the exact shape and layout of StoryCard
 * with animated shimmer placeholders shown during data fetch.
 */
export function SkeletonCard() {
  return (
    <div
      className="w-full bg-surface rounded-xl overflow-hidden
                 border border-border-subtle shadow-lg shadow-black/20"
      aria-hidden="true"
    >
      {/* Priority stripe placeholder */}
      <div className="h-1 w-full skeleton-shimmer" />

      <div className="p-4 space-y-2">
        {/* Header row: key badge + priority badge */}
        <div className="flex items-center justify-between gap-2">
          <div className="h-5 w-16 rounded-md skeleton-shimmer" />
          <div className="flex items-center gap-1.5">
            <div className="h-5 w-14 rounded-md skeleton-shimmer" />
          </div>
        </div>

        {/* Title placeholder (2 lines) */}
        <div className="space-y-1.5">
          <div className="h-4 w-full rounded skeleton-shimmer" />
          <div className="h-4 w-3/4 rounded skeleton-shimmer" />
        </div>

        {/* Description placeholder (2 lines) */}
        <div className="space-y-1.5">
          <div className="h-3 w-full rounded skeleton-shimmer" />
          <div className="h-3 w-2/3 rounded skeleton-shimmer" />
        </div>
      </div>
    </div>
  );
}
