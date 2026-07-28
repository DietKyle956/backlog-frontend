import { useState, useEffect, useCallback, useMemo } from "react";
import type { StoryStatus } from "./types";
import { supabase } from "./supabase";
import { useBoardData } from "./hooks/useBoardData";
import { useTransition } from "./hooks/useTransition";
import { useProjectSelection } from "./hooks/useProjectSelection";
import { Board } from "./components/Board";
import { SkeletonCard } from "./components/SkeletonCard";
import { TerminalView } from "./components/TerminalView";
import { ProjectSwitcher } from "./components/ProjectSwitcher";
import { createSupabaseAdapter } from "./adapters/supabase-adapter";

export function App() {
  // Data-access adapter (stable reference)
  const adapter = useMemo(() => createSupabaseAdapter(), []);

  const { data, loading, error, refetch, applyOptimisticUpdate } =
    useBoardData(adapter);
  const { performTransition, error: transitionError, clearError: clearTransitionError } = useTransition(adapter);
  const [showTerminal, setShowTerminal] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const { selectedProject, selectProject, filteredStories } =
    useProjectSelection(data);

  // Check auth state
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAuthenticated(!!session);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setIsAuthenticated(!!session);
      },
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleSignIn = useCallback(async () => {
    await supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        redirectTo: window.location.origin + "/backlog-frontend/",
      },
    });
  }, []);

  const handleSignOut = useCallback(async () => {
    await supabase.auth.signOut();
    setIsAuthenticated(false);
  }, []);

  const handleTerminalOptimisticTransition = useCallback(
    async (
      storyId: number,
      currentStatus: StoryStatus,
      newStatus: StoryStatus,
    ) => {
      const revert = applyOptimisticUpdate(storyId, newStatus);
      const result = await performTransition(storyId, currentStatus, newStatus);
      if (!result.success) {
        revert();
      }
    },
    [applyOptimisticUpdate, performTransition],
  );

  // Loading state
  if (loading) {
    return (
      <div className="min-h-dvh bg-canvas flex flex-col">
        <header className="px-4 pt-6 pb-4 space-y-4">
          <div className="h-9 w-32 bg-surface animate-pulse rounded-lg" />
          <div className="flex justify-center gap-1.5">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className={`rounded-full ${
                  i === 0 ? "w-6 h-1.5" : "w-1.5 h-1.5"
                } bg-surface-raised animate-pulse`}
              />
            ))}
          </div>
        </header>
        <div className="flex-1 px-4 space-y-3">
          {[...Array(5)].map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-dvh bg-canvas flex flex-col items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-sm">
          {/* Error icon */}
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-red-500"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
          </div>
          <div>
            <p className="text-lg font-semibold text-text-primary">
              Failed to load data
            </p>
            <p className="text-sm text-text-secondary mt-1">
              Could not load board data from the server. Please check your
              connection and try again.
            </p>
          </div>
          {error && (
            <p className="text-xs text-text-muted font-mono bg-surface-raised rounded-lg px-3 py-2 break-all">
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={() => refetch()}
            className="px-6 py-2.5 text-sm font-medium rounded-lg
                       bg-accent text-white hover:opacity-90 active:scale-95
                       transition-all duration-100"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Empty state (no projects at all)
  if (data && data.projects.length === 0) {
    return (
      <div className="min-h-dvh bg-canvas flex flex-col items-center justify-center p-4">
        <div className="text-center space-y-2">
          <p className="text-lg font-semibold text-text-primary">
            No projects found
          </p>
          <p className="text-sm text-text-secondary">
            Create a project in the backlog database to get started.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-canvas flex flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 pt-6 pb-1">
        {data && (
          <ProjectSwitcher
            projects={data.projects}
            selectedId={selectedProject?.id ?? null}
            onChange={selectProject}
          />
        )}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowTerminal((prev) => !prev)}
            className={`text-xs font-medium px-3 py-2 rounded-lg border transition-colors ${
              showTerminal
                ? "bg-accent/15 text-accent border-accent/30"
                : "bg-surface-raised text-text-secondary border-border-subtle hover:bg-surface-hover"
            }`}
          >
            Terminal
          </button>
          {isAuthenticated ? (
            <button
              type="button"
              onClick={handleSignOut}
              className="text-xs font-medium px-3 py-2 rounded-lg
                         bg-surface-raised text-text-secondary border border-border-subtle
                         hover:bg-surface-hover transition-colors"
            >
              Sign Out
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSignIn}
              className="text-xs font-medium px-3 py-2 rounded-lg
                         bg-accent/15 text-accent border border-accent/30
                         hover:bg-accent/20 transition-colors"
            >
              Sign In
            </button>
          )}
        </div>
      </header>

      {/* Transition error banner */}
      {transitionError && (
        <div className="mx-4 mt-3 px-3 py-2.5 bg-accent-danger/15 border border-accent-danger/30 rounded-lg text-sm text-accent-danger">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm leading-snug">{transitionError.message}</p>
            <button
              type="button"
              onClick={clearTransitionError}
              className="ml-2 underline text-xs flex-shrink-0 hover:text-accent-danger/80 transition-colors"
            >
              Dismiss
            </button>
          </div>
          {transitionError.action && (
            <div className="mt-2 pt-2 border-t border-accent-danger/20">
              {transitionError.action.handler === "sign-in" ? (
                <button
                  type="button"
                  onClick={() => {
                    clearTransitionError();
                    handleSignIn();
                  }}
                  className="text-xs font-medium px-3 py-1 rounded-md
                             bg-accent-danger/20 text-accent-danger
                             hover:bg-accent-danger/30 active:scale-95
                             transition-all duration-100"
                >
                  Sign In to retry
                </button>
              ) : transitionError.action.handler === "retry" ? (
                <button
                  type="button"
                  onClick={clearTransitionError}
                  className="text-xs font-medium px-3 py-1 rounded-md
                             bg-accent-danger/20 text-accent-danger
                             hover:bg-accent-danger/30 active:scale-95
                             transition-all duration-100"
                >
                  Dismiss and retry
                </button>
              ) : null}
            </div>
          )}
        </div>
      )}

      {/* Board or Terminal view */}
      {showTerminal && data ? (
        <TerminalView
          stories={data.stories}
          projects={data.projects}
          isAuthenticated={isAuthenticated}
          onClose={() => setShowTerminal(false)}
          onOptimisticTransition={handleTerminalOptimisticTransition}
        />
      ) : (
        data &&
        selectedProject && (
          <Board
            key={selectedProject.id}
            stories={filteredStories}
            blockers={data.blockers}
            dependencies={data.dependencies}
            isAuthenticated={isAuthenticated}
            adapter={adapter}
            onRefresh={refetch}
            onSignIn={handleSignIn}
            applyOptimisticUpdate={applyOptimisticUpdate}
          />
        )
      )}
    </div>
  );
}
