import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import type { Project, Story, AppData } from "../types";

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

export interface UseProjectSelectionReturn {
  selectedProject: Project | null;
  selectProject: (project: Project) => void;
  filteredStories: Story[];
}

export function useProjectSelection(
  data: AppData | null,
): UseProjectSelectionReturn {
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(
    () => getSavedProjectId(),
  );
  const initialized = useRef(false);

  // Restore saved project or default to first when data first arrives.
  // The initialized ref prevents re-initialization on subsequent data
  // refreshes (e.g. realtime updates).
  useEffect(() => {
    if (data && !initialized.current) {
      const savedId = getSavedProjectId();
      if (savedId && data.projects.some((p) => p.id === savedId)) {
        setSelectedProjectId(savedId);
      } else if (data.projects.length > 0) {
        setSelectedProjectId(data.projects[0].id);
      }
      initialized.current = true;
    }
  }, [data]);

  const selectProject = useCallback((project: Project) => {
    setSelectedProjectId(project.id);
    saveProjectId(project.id);
  }, []);

  const selectedProject = useMemo(
    () =>
      data?.projects.find((p) => p.id === selectedProjectId) ?? null,
    [data, selectedProjectId],
  );

  const filteredStories = useMemo(() => {
    if (!data || selectedProjectId === null) return [];
    return data.stories.filter(
      (s) => s.project_id === selectedProjectId,
    );
  }, [data, selectedProjectId]);

  return { selectedProject, selectProject, filteredStories };
}
