import { useState, useMemo, useCallback, useRef } from "react";
import type {
  Story,
  Blocker,
  Dependency,
  StoryStatus,
} from "../types";
import { COLUMN_ORDER, COLUMN_LABELS } from "../types";
import type { TransitionResult } from "../lib/transitions";
import { computeColumns } from "../lib/columns";
import { StoryCard } from "./StoryCard";
import { StoryDetail } from "./StoryDetail";

interface BoardProps {
  stories: Story[];
  blockers: Blocker[];
  dependencies: Dependency[];
  isAuthenticated: boolean;
  onTransition: (
    storyId: number,
    currentStatus: StoryStatus,
    newStatus: StoryStatus,
  ) => Promise<TransitionResult>;
}

export function Board({
  stories,
  blockers,
  dependencies,
  isAuthenticated,
  onTransition,
}: BoardProps) {
  const [currentColumnIndex, setCurrentColumnIndex] = useState(0);
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<Set<number>>(
    new Set(),
  );
  const [animationDir, setAnimationDir] = useState<"right" | "left">(
    "right",
  );
  const [animationKey, setAnimationKey] = useState(0);

  const columns = useMemo(
    () => computeColumns(stories, { searchTerm, priorityFilter }),
    [stories, searchTerm, priorityFilter],
  );

  const currentColumn = columns[currentColumnIndex];

  const navigateColumn = useCallback(
    (dir: "left" | "right") => {
      const nextIndex =
        dir === "left"
          ? Math.max(0, currentColumnIndex - 1)
          : Math.min(columns.length - 1, currentColumnIndex + 1);
      if (nextIndex !== currentColumnIndex) {
        setAnimationDir(dir);
        setAnimationKey((k) => k + 1);
        setCurrentColumnIndex(nextIndex);
      }
    },
    [columns.length, currentColumnIndex],
  );

  const getDependencyCount = (storyId: number): number => {
    return dependencies.filter((d) => d.story_id === storyId).length;
  };

  // Touch swipe handling
  const touchStartRef = useRef<number | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartRef.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartRef.current;
    if (Math.abs(delta) > 60) {
      navigateColumn(delta > 0 ? "left" : "right");
    }
    touchStartRef.current = null;
  };

  if (!currentColumn) return null;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header: Column title + dot indicators */}
      <div className="px-4 pt-4 pb-2 space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-text-primary">
            {COLUMN_LABELS[currentColumn.status]}
          </h1>
          <span className="text-sm text-text-muted">
            {currentColumn.stories.length}{" "}
            {currentColumn.stories.length === 1 ? "story" : "stories"}
          </span>
        </div>

        {/* Dot indicators */}
        <div className="flex items-center justify-center gap-1.5">
          {columns.map((col, i) => (
            <button
              key={col.status}
              type="button"
              onClick={() => {
                if (i !== currentColumnIndex) {
                  setAnimationDir(
                    i > currentColumnIndex ? "right" : "left",
                  );
                  setAnimationKey((k) => k + 1);
                  setCurrentColumnIndex(i);
                }
              }}
              className={`rounded-full transition-all duration-200 ${
                i === currentColumnIndex
                  ? "w-6 h-1.5 bg-accent"
                  : "w-1.5 h-1.5 bg-text-muted/40"
              }`}
              aria-label={COLUMN_LABELS[col.status]}
            />
          ))}
        </div>

        {/* Search and filter */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by title or key..."
            className="flex-1 text-sm bg-surface-raised border border-border-subtle rounded-lg
                       px-3 py-2 text-text-primary placeholder:text-text-muted
                       focus:outline-none focus:ring-2 focus:ring-accent/50"
          />
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4].map((p) => {
              const isActive = priorityFilter.size === 0 || priorityFilter.has(p);
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    setPriorityFilter((prev) => {
                      const next = new Set(prev);
                      if (next.has(p)) {
                        next.delete(p);
                      } else {
                        next.add(p);
                      }
                      return next;
                    });
                  }}
                  className={`w-3 h-3 rounded-full transition-opacity ${
                    isActive ? "opacity-100" : "opacity-20"
                  }`}
                  style={{
                    backgroundColor: ["#F87171", "#FB923C", "#FBBF24", "#9CA3AF"][
                      p - 1
                    ],
                  }}
                  aria-label={`Priority ${p}`}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Column content */}
      <div
        key={animationKey}
        className={`flex-1 overflow-y-auto px-4 pb-4 space-y-3 ${
          animationDir === "right"
            ? "animate-spring-in-right"
            : "animate-spring-in-left"
        }`}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {currentColumn.stories.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-lg font-semibold text-text-muted">
              Nothing here yet
            </p>
            <p className="text-sm text-text-muted/70 mt-1">
              No stories in {COLUMN_LABELS[currentColumn.status].toLowerCase()}
            </p>
          </div>
        ) : (
          currentColumn.stories.map((story) => (
            <StoryCard
              key={story.id}
              story={story}
              blockers={blockers}
              dependencyCount={getDependencyCount(story.id)}
              onClick={() => setSelectedStory(story)}
            />
          ))
        )}
      </div>

      {/* Navigation arrows */}
      <div className="flex items-center justify-between px-2 py-3 border-t border-border-subtle">
        <button
          type="button"
          onClick={() => navigateColumn("left")}
          disabled={currentColumnIndex === 0}
          className="w-10 h-10 flex items-center justify-center rounded-full
                     bg-surface-raised border border-border-subtle text-text-secondary
                     hover:bg-surface-hover disabled:opacity-30 disabled:cursor-not-allowed
                     transition-colors"
          aria-label="Previous column"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => navigateColumn("right")}
          disabled={currentColumnIndex === columns.length - 1}
          className="w-10 h-10 flex items-center justify-center rounded-full
                     bg-surface-raised border border-border-subtle text-text-secondary
                     hover:bg-surface-hover disabled:opacity-30 disabled:cursor-not-allowed
                     transition-colors"
          aria-label="Next column"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>

      {/* Story detail overlay */}
      {selectedStory && (
        <StoryDetail
          story={selectedStory}
          allStories={stories}
          blockers={blockers}
          dependencies={dependencies}
          isAuthenticated={isAuthenticated}
          onClose={() => setSelectedStory(null)}
          onTransition={onTransition}
        />
      )}
    </div>
  );
}
