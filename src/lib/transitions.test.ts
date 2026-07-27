import { describe, it, expect } from "vitest";
import {
  getAllowedTargets,
  createTransitionRunner,
  type TransitionAdapter,
} from "./transitions";
import type { StoryStatus } from "../types";

describe("getAllowedTargets", () => {
  it("returns correct targets for backlog status", () => {
    expect(getAllowedTargets("backlog")).toEqual(["ready", "cancelled"]);
  });

  it("returns correct targets for ready status", () => {
    expect(getAllowedTargets("ready")).toEqual([
      "in_progress",
      "backlog",
      "cancelled",
    ]);
  });

  it("returns correct targets for in_progress status", () => {
    expect(getAllowedTargets("in_progress")).toEqual([
      "in_review",
      "ready",
      "failed",
    ]);
  });

  it("returns correct targets for in_review status", () => {
    expect(getAllowedTargets("in_review")).toEqual([
      "done",
      "in_progress",
      "failed",
    ]);
  });

  it("returns correct targets for done status", () => {
    expect(getAllowedTargets("done")).toEqual(["in_review"]);
  });

  it("returns correct targets for cancelled status", () => {
    expect(getAllowedTargets("cancelled")).toEqual(["backlog", "failed"]);
  });

  it("returns correct targets for failed status", () => {
    expect(getAllowedTargets("failed")).toEqual(["backlog", "cancelled"]);
  });

  it("returns empty array for unknown status", () => {
    expect(getAllowedTargets("unknown" as StoryStatus)).toEqual([]);
  });
});

describe("createTransitionRunner", () => {
  function createStubAdapter(
    behavior?: "success" | "error",
  ): TransitionAdapter {
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
    adapter: TransitionAdapter;
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

  it("calls adapter with correct arguments on valid transition", async () => {
    const { adapter, calls } = createSpyAdapter();
    const runner = createTransitionRunner(adapter);

    const result = await runner.performTransition(1, "backlog", "ready");

    expect(result.success).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({ storyId: 1, status: "ready" });
  });

  it("returns error for invalid transition", async () => {
    const { adapter, calls } = createSpyAdapter();
    const runner = createTransitionRunner(adapter);

    const result = await runner.performTransition(1, "done", "backlog");

    expect(result.success).toBe(false);
    expect(result.error).toContain("Invalid transition");
    expect(calls).toHaveLength(0);
  });

  it("returns error from adapter", async () => {
    const adapter = createStubAdapter("error");
    const runner = createTransitionRunner(adapter);

    const result = await runner.performTransition(1, "backlog", "ready");

    expect(result.success).toBe(false);
    expect(result.error).toBe("Database error");
  });

  it("guards against concurrent transitions", async () => {
    // Use a deferred promise so the first transition never completes during the test
    let resolveFirst: (value: { error?: string }) => void;
    const firstPromise = new Promise<{ error?: string }>((resolve) => {
      resolveFirst = resolve;
    });

    const adapter: TransitionAdapter = {
      updateStoryStatus: async (_storyId, _status) => firstPromise,
    };
    const runner = createTransitionRunner(adapter);

    // Start first transition (doesn't complete yet)
    const firstResult = runner.performTransition(1, "backlog", "ready");

    // Attempt second transition while first is in flight
    const secondResult = await runner.performTransition(
      2,
      "backlog",
      "cancelled",
    );

    expect(secondResult.success).toBe(false);
    expect(secondResult.error).toBe("A transition is already in progress");

    // Resolve the first transition
    resolveFirst!({});
    const first = await firstResult;
    expect(first.success).toBe(true);
  });

  it("allows transitions after a failed one completes", async () => {
    let shouldFail = true;
    const adapter: TransitionAdapter = {
      updateStoryStatus: async (_storyId, _status) => {
        if (shouldFail) {
          shouldFail = false;
          return { error: "Database error" };
        }
        return {};
      },
    };
    const runner = createTransitionRunner(adapter);

    // First transition fails
    const first = await runner.performTransition(1, "backlog", "ready");
    expect(first.success).toBe(false);

    // Same runner's guard is released, so second attempt succeeds
    const second = await runner.performTransition(1, "backlog", "ready");
    expect(second.success).toBe(true);
  });
});
