import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTransition } from "./useTransition";
import type { BacklogAdapter } from "../lib/adapter";
import type { StoryStatus } from "../types";

function createStubAdapter(
  behavior?: "success" | "error",
): Pick<BacklogAdapter, "updateStoryStatus"> {
  return {
    updateStoryStatus: async (_storyId, _status) => {
      if (behavior === "error") {
        return { error: "Database error" };
      }
      return {};
    },
  };
}

function createSpyAdapter(): {
  adapter: Pick<BacklogAdapter, "updateStoryStatus">;
  calls: Array<{ storyId: number; status: StoryStatus }>;
} {
  const calls: Array<{ storyId: number; status: StoryStatus }> = [];
  return {
    calls,
    adapter: {
      updateStoryStatus: async (storyId, status) => {
        calls.push({ storyId, status });
        return {};
      },
    },
  };
}

describe("useTransition", () => {
  it("returns stable performTransition and clearError across re-renders", () => {
    const adapter = createStubAdapter("success");
    const { result, rerender } = renderHook(() => useTransition(adapter));

    const firstPerform = result.current.performTransition;
    const firstClearError = result.current.clearError;

    rerender();

    expect(result.current.performTransition).toBe(firstPerform);
    expect(result.current.clearError).toBe(firstClearError);
  });

  it("initializes with null error", () => {
    const adapter = createStubAdapter("success");
    const { result } = renderHook(() => useTransition(adapter));

    expect(result.current.error).toBeNull();
  });

  it("calls adapter with correct arguments on valid transition", async () => {
    const { adapter, calls } = createSpyAdapter();
    const { result } = renderHook(() => useTransition(adapter));

    let transitionResult;
    await act(async () => {
      transitionResult = await result.current.performTransition(
        1,
        "backlog",
        "ready",
      );
    });

    expect(transitionResult!.success).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({ storyId: 1, status: "ready" });
    expect(result.current.error).toBeNull();
  });

  it("sets error state when transition fails", async () => {
    const adapter = createStubAdapter("error");
    const { result } = renderHook(() => useTransition(adapter));

    await act(async () => {
      await result.current.performTransition(1, "backlog", "ready");
    });

    expect(result.current.error).toBe("Database error");
  });

  it("returns error result for invalid transition", async () => {
    const { adapter } = createSpyAdapter();
    const { result } = renderHook(() => useTransition(adapter));

    let transitionResult;
    await act(async () => {
      transitionResult = await result.current.performTransition(
        1,
        "done",
        "backlog",
      );
    });

    expect(transitionResult!.success).toBe(false);
    expect(transitionResult!.error).toContain("Invalid transition");
    expect(result.current.error).toContain("Invalid transition");
  });

  it("clearError resets error to null", async () => {
    const adapter = createStubAdapter("error");
    const { result } = renderHook(() => useTransition(adapter));

    await act(async () => {
      await result.current.performTransition(1, "backlog", "ready");
    });

    expect(result.current.error).toBe("Database error");

    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();
  });

  it("clears previous error before starting a new transition", async () => {
    let shouldFail = true;
    const adapter: Pick<BacklogAdapter, "updateStoryStatus"> = {
      updateStoryStatus: async (_storyId, _status) => {
        if (shouldFail) {
          return { error: "Database error" };
        }
        return {};
      },
    };
    const { result } = renderHook(() => useTransition(adapter));

    // First transition fails
    await act(async () => {
      await result.current.performTransition(1, "backlog", "ready");
    });
    expect(result.current.error).toBe("Database error");

    // Second transition succeeds on the same hook instance
    shouldFail = false;
    await act(async () => {
      await result.current.performTransition(2, "backlog", "ready");
    });

    expect(result.current.error).toBeNull();
  });

  it("returns success for valid transition and keeps error null", async () => {
    const adapter = createStubAdapter("success");
    const { result } = renderHook(() => useTransition(adapter));

    let transitionResult;
    await act(async () => {
      transitionResult = await result.current.performTransition(
        2,
        "in_progress",
        "in_review",
      );
    });

    expect(transitionResult!.success).toBe(true);
    expect(result.current.error).toBeNull();
  });
});
