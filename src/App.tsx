import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "./supabase";
import { useBoardData } from "./hooks/useBoardData";
import { Board } from "./components/Board";
import { TerminalView } from "./components/TerminalView";
import { ProjectSwitcher } from "./components/ProjectSwitcher";
import type { Project, StoryStatus } from "./types";

const PROJECT_STORAGE_KEY = "backlog-last-project-id";

function getSavedProjectId(): number | null {
  try {
    const stored = localStorage.getItem(PROJECT_STORAGE_KEY);
    if (stored) return Number(stored);
  } catch {
    // localStorage unavailable
  }
  return null;
}

function saveProjectId(id: number) {
  try {
    localStorage.setItem(PROJECT_STORAGE_KEY, String(id));
  } catch {
    // localStorage unavailable
  }
}

export function App() {
  const { data, loading, error, refetch } = useBoardData();
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(
    () => getSavedProjectId(),
  );
  const [showTerminal, setShowTerminal] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [transitionError, setTransitionError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  // Restore project or default to first alphabetically
  useEffect(() => {
    if (data && !initialized) {
      const savedId = getSavedProjectId();
      if (savedId && data.projects.some((p) => p.id === savedId)) {
        setSelectedProjectId(savedId);
      } else if (data.projects.length > 0) {
        setSelectedProjectId(data.projects[0].id);
      }
      setInitialized(true);
    }
  }, [data, initialized]);

  const handleProjectChange = useCallback((project: Project) => {
    setSelectedProjectId(project.id);
    saveProjectId(project.id);
  }, []);

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

  const handleTransition = useCallback(
    async (storyId: number, newStatus: StoryStatus) => {
      setTransitionError(null);
      const { error: updateError } = await supabase
        .from("stories")
        .update({ status: newStatus })
        .eq("id", storyId);

      if (updateError) {
        setTransitionError(updateError.message);
        return;
      }

      // Optimistic update handled by Realtime refetch
    },
    [],
  );

  const handleReactivate = useCallback(
    async (storyId: number) => {
      setTransitionError(null);
      const { error: updateError } = await supabase
        .from("stories")
        .update({ status: "backlog" as StoryStatus })
        .eq("id", storyId);

      if (updateError) {
        setTransitionError(updateError.message);
        return;
      }

      setShowTerminal(false);
    },
    [],
  );

  const selectedProject = useMemo(
    () =>
      data?.projects.find((p) => p.id === selectedProjectId) ?? null,
    [data, selectedProjectId],
  );

  const filteredStories = useMemo(() => {
    if (!data || !selectedProjectId) return [];
    if (showTerminal) return data.stories;
    return data.stories.filter(
      (s) => s.project_id === selectedProjectId,
    );
  }, [data, selectedProjectId, showTerminal]);

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
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-32 bg-surface rounded-xl animate-pulse"
            />
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
          <p className="text-lg font-semibold text-text-primary">
            Something went wrong
          </p>
          <p className="text-sm text-text-secondary">{error}</p>
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
            selectedId={selectedProjectId}
            onChange={handleProjectChange}
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

      {/* Transition error toast */}
      {transitionError && (
        <div className="mx-4 mt-2 px-4 py-2 bg-accent-danger/15 border border-accent-danger/30 rounded-lg text-sm text-accent-danger">
          {transitionError}
          <button
            type="button"
            onClick={() => setTransitionError(null)}
            className="ml-2 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Pull-to-refresh indicator */}
      <div className="flex justify-center py-1">
        <button
          type="button"
          onClick={() => refetch()}
          className="text-[10px] text-text-muted/50 hover:text-text-muted transition-colors"
          aria-label="Refresh board"
        >
          pull to refresh
        </button>
      </div>

      {/* Board or Terminal view */}
      {showTerminal ? (
        <TerminalView
          stories={filteredStories}
          onReactivate={handleReactivate}
          isAuthenticated={isAuthenticated}
          onClose={() => setShowTerminal(false)}
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
            onTransition={handleTransition}
          />
        )
      )}
    </div>
  );
}
