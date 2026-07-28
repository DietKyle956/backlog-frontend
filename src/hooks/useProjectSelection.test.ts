import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useProjectSelection } from "./useProjectSelection";
import { mockProjects, mockStories } from "../test/fixtures";
import type { AppData } from "../types";

function makeData(overrides?: Partial<AppData>): AppData {
  return {
    projects: mockProjects.map((p) => ({ ...p })),
    stories: mockStories.map((s) => ({ ...s, acceptance_criteria: [...s.acceptance_criteria] })),
    blockers: [],
    dependencies: [],
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe("useProjectSelection", () => {
  describe("initialization", () => {
    it("restores the last viewed project from localStorage", () => {
      localStorage.setItem("backlog-last-project-id", "3");
      const data = makeData();

      const { result } = renderHook(() => useProjectSelection(data));

      expect(result.current.selectedProject).toEqual(
        expect.objectContaining({ id: 3, name: "Contract IQ" }),
      );
    });

    it("defaults to first project when no saved project exists", () => {
      const data = makeData();

      const { result } = renderHook(() => useProjectSelection(data));

      // First project in fixtures is Alpha Project (id: 1), projects are in
      // insertion order so first is id=1 (Alpha Project)
      expect(result.current.selectedProject).toEqual(
        expect.objectContaining({ id: 1, name: "Alpha Project" }),
      );
    });

    it("falls back to first project when saved project ID is not in data", () => {
      localStorage.setItem("backlog-last-project-id", "999");
      const data = makeData();

      const { result } = renderHook(() => useProjectSelection(data));

      expect(result.current.selectedProject).toEqual(
        expect.objectContaining({ id: 1, name: "Alpha Project" }),
      );
    });

    it("returns null selectedProject when data is null", () => {
      const { result } = renderHook(() => useProjectSelection(null));

      expect(result.current.selectedProject).toBeNull();
    });
  });

  describe("selectProject", () => {
    it("updates selectedProject and persists to localStorage", () => {
      const data = makeData();
      const { result } = renderHook(() => useProjectSelection(data));

      act(() => {
        result.current.selectProject(
          data.projects.find((p) => p.id === 3)!,
        );
      });

      expect(result.current.selectedProject).toEqual(
        expect.objectContaining({ id: 3, name: "Contract IQ" }),
      );
      expect(localStorage.getItem("backlog-last-project-id")).toBe("3");
    });

    it("handles localStorage errors gracefully", () => {
      // Make localStorage.setItem throw
      const originalSetItem = localStorage.setItem;
      localStorage.setItem = () => {
        throw new Error("quota exceeded");
      };

      const data = makeData();
      const { result } = renderHook(() => useProjectSelection(data));

      act(() => {
        result.current.selectProject(
          data.projects.find((p) => p.id === 2)!,
        );
      });

      // Should still update state even if localStorage fails
      expect(result.current.selectedProject).toEqual(
        expect.objectContaining({ id: 2, name: "Beta Project" }),
      );

      localStorage.setItem = originalSetItem;
    });
  });

  describe("filteredStories", () => {
    it("returns only stories for the selected project", () => {
      localStorage.setItem("backlog-last-project-id", "3");
      const data = makeData();

      const { result } = renderHook(() => useProjectSelection(data));

      // Contract IQ stories: CIQ-001, CIQ-002, CIQ-003, CIQ-004
      expect(result.current.filteredStories).toHaveLength(4);
      result.current.filteredStories.forEach((s) => {
        expect(s.project_id).toBe(3);
      });
    });

    it("returns empty array when data is null", () => {
      const { result } = renderHook(() => useProjectSelection(null));

      expect(result.current.filteredStories).toEqual([]);
    });

    it("returns empty array when selectedProject is null", () => {
      const data = makeData({ projects: [] });

      const { result } = renderHook(() => useProjectSelection(data));

      expect(result.current.filteredStories).toEqual([]);
    });
  });

  describe("re-initialization guard", () => {
    it("does not reset project selection when data reference changes", () => {
      localStorage.setItem("backlog-last-project-id", "3");
      const data1 = makeData();

      const { result, rerender } = renderHook(
        (d) => useProjectSelection(d),
        { initialProps: data1 },
      );

      expect(result.current.selectedProject).toEqual(
        expect.objectContaining({ id: 3 }),
      );

      // Switch to Beta Project
      act(() => {
        result.current.selectProject(
          data1.projects.find((p) => p.id === 2)!,
        );
      });

      expect(result.current.selectedProject).toEqual(
        expect.objectContaining({ id: 2 }),
      );

      // Simulate a realtime data refresh (new data reference)
      const data2 = makeData();
      rerender(data2);

      // Should stay on Beta Project, not revert to saved project (id=3)
      expect(result.current.selectedProject).toEqual(
        expect.objectContaining({ id: 2 }),
      );
    });
  });

  describe("invalid localStorage value", () => {
    it("falls back to first project when localStorage has non-numeric value", () => {
      localStorage.setItem("backlog-last-project-id", "not-a-number");
      const data = makeData();

      const { result } = renderHook(() => useProjectSelection(data));

      expect(result.current.selectedProject).toEqual(
        expect.objectContaining({ id: 1, name: "Alpha Project" }),
      );
    });
  });
});
