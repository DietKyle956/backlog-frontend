import { useState, useMemo, useCallback, useRef } from "react";
import type {
  Story,
  Blocker,
  Dependency,
  ResolvedBlocker,
  ResolvedDependency,
} from "../types";
import { COLUMN_LABELS, PRIORITY_LABELS } from "../types";
import type { BacklogAdapter } from "../lib/adapter";
import { computeColumns } from "../lib/columns";
import { StoryCard } from "./StoryCard";
import { StoryDetail } from "./StoryDetail";

interface BoardProps {
  stories: Story[];
  blockers: Blocker[];
  dependencies: Dependency[];
  isAuthenticated: boolean;
  adapter: Pick<BacklogAdapter, "updateStoryStatus">;
  onRefresh: () => Promise<void>;
}

export function Board({
  stories,
  blockers,
  dependencies,
  isAuthenticated,
  adapter,
  onRefresh,
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

  // Pull-to-refresh state
  const [pullState, setPullState] = useState<
    "idle" | "pulling" | "refreshing"
  >("idle");
  const [pullDistance, setPullDistance] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pullStartRef = useRef<{ x: number; y: number } | null>(null);
  const PULL_THRESHOLD = 60;

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

  // Touch handling: horizontal swipe for columns + vertical pull-to-refresh
  const handleTouchStart = (e: React.TouchEvent) => {
    pullStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!pullStartRef.current || pullState === "refreshing") return;
    const el = scrollRef.current;
    if (!el || el.scrollTop > 0) {
      // Not at top of scroll, reset pull state
      if (pullState !== "idle") {
        setPullState("idle");
        setPullDistance(0);
      }
      return;
    }

    const deltaY = e.touches[0].clientY - pullStartRef.current.y;
    if (deltaY > 5) {
      // Apply damping so the pull feels heavier the further you go
      const damped = Math.min(deltaY * 0.5, 120);
      setPullDistance(damped);
      setPullState("pulling");
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!pullStartRef.current) return;
    const deltaX = e.changedTouches[0].clientX - pullStartRef.current.x;
    const deltaY = e.changedTouches[0].clientY - pullStartRef.current.y;

    // Only horizontal swipe if horizontal movement dominates
    if (
      Math.abs(deltaX) > Math.abs(deltaY) &&
      Math.abs(deltaX) > 60
    ) {
      navigateColumn(deltaX > 0 ? "left" : "right");
      setPullState("idle");
      setPullDistance(0);
    } else if (pullState === "pulling") {
      const dampedY = Math.min(deltaY * 0.5, 120);
      if (dampedY >= PULL_THRESHOLD) {
        setPullState("refreshing");
        onRefresh().finally(() => {
          setPullState("idle");
          setPullDistance(0);
        });
      } else {
        setPullState("idle");
        setPullDistance(0);
      }
    }
    pullStartRef.current = null;
  };

  const resolvedBlockers = useMemo<ResolvedBlocker[]>(() => {
    if (!selectedStory) return [];
    return blockers
      .filter((b) => b.story_id === selectedStory.id)
      .map((b) => ({
        id: b.id,
        description: b.description,
        resolved_at: b.resolved_at,
        blockingStoryKey:
          b.blocking_story_id
            ? stories.find((s) => s.id === b.blocking_story_id)?.key ?? null
            : null,
      }));
  }, [selectedStory, blockers, stories]);

  const resolvedDependencies = useMemo<ResolvedDependency[]>(() => {
    if (!selectedStory) return [];
    return dependencies
      .filter((d) => d.story_id === selectedStory.id)
      .map((d) => {
        const depStory = stories.find((s) => s.id === d.depends_on_id);
        return {
          depends_on_id: d.depends_on_id,
          storyKey: depStory?.key ?? null,
          storyTitle: depStory?.title ?? null,
          isDone: depStory?.status === "done",
        };
      });
  }, [selectedStory, dependencies, stories]);

  if (!currentColumn) return null;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header: Column title + dash indicators */}
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

        {/* Dash indicators */}
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
                  : "w-6 h-1 bg-text-muted/30"
              }`}
              aria-label={COLUMN_LABELS[col.status]}
            />
          ))}
        </div>

        {/* Search and filter */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by title or key..."
              className="w-full text-sm bg-surface-raised border border-border-subtle rounded-lg
                         px-3 py-2 pr-8 text-text-primary placeholder:text-text-muted
                         focus:outline-none focus:ring-2 focus:ring-accent/50"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center
                           rounded-full text-text-muted hover:text-text-primary hover:bg-surface-hover
                           transition-colors"
                aria-label="Clear search"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            {[1, 2, 3, 4].map((p) => {
              const isActive = priorityFilter.size === 0 || priorityFilter.has(p);
              const label = PRIORITY_LABELS[p];
              const colorVar = `var(--color-priority-${p})`;
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
                  className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-md transition-all duration-150 border ${
                    isActive
                      ? "border-transparent text-white"
                      : "border-border-subtle text-text-muted hover:opacity-70"
                  }`}
                  style={{
                    backgroundColor: isActive ? colorVar : "transparent",
                  }}
                  aria-label={`Filter ${label} priority`}
                  aria-pressed={priorityFilter.size > 0 && priorityFilter.has(p)}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Pull-to-refresh indicator */}
      <div
        className="flex justify-center overflow-hidden transition-[height] duration-200"
        style={{
          height:
            pullState === "refreshing"
              ? "40px"
              : pullState === "pulling"
                ? `${pullDistance}px`
                : "0px",
          opacity: pullState === "idle" ? 0 : 1,
        }}
        aria-live="polite"
      >
        {pullState === "refreshing" ? (
          <div className="flex items-center gap-2 py-2">
            <svg
              className="animate-spin h-4 w-4 text-accent"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            <span className="text-xs text-text-muted">Refreshing...</span>
          </div>
        ) : pullState === "pulling" ? (
          <div className="flex items-center gap-1.5 py-1">
            <svg
              className={`h-3.5 w-3.5 text-text-muted transition-transform duration-200 ${
                pullDistance >= PULL_THRESHOLD ? "rotate-180" : ""
              }`}
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
            <span className="text-[10px] text-text-muted">
              {pullDistance >= PULL_THRESHOLD
                ? "Release to refresh"
                : "Pull to refresh"}
            </span>
          </div>
        ) : null}
      </div>

      {/* Column content */}
      <div
        ref={scrollRef}
        key={animationKey}
        className={`flex-1 overflow-y-auto px-4 pb-4 space-y-3 ${
          animationDir === "right"
            ? "animate-spring-in-right"
            : "animate-spring-in-left"
        }`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {currentColumn.stories.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm text-text-muted/70">
              Nothing in {COLUMN_LABELS[currentColumn.status]} yet
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
          resolvedBlockers={resolvedBlockers}
          resolvedDependencies={resolvedDependencies}
          isAuthenticated={isAuthenticated}
          onClose={() => setSelectedStory(null)}
          adapter={adapter}
        />
      )}
    </div>
  );
}
