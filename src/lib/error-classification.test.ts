import { describe, it, expect } from "vitest";
import { classifyTransitionError, type ClassifiedError } from "./error-classification";

describe("classifyTransitionError", () => {
  it("classifies Supabase RLS errors as auth type", () => {
    const result = classifyTransitionError(
      "new row violates row-level security policy for table \"stories\"",
    );
    expect(result.type).toBe("auth");
    expect(result.message).toContain("sign in");
  });

  it("classifies JWT expired errors as auth type", () => {
    const result = classifyTransitionError("JWT expired");
    expect(result.type).toBe("auth");
    expect(result.message).toContain("session");
  });

  it("classifies invalid JWT errors as auth type", () => {
    const result = classifyTransitionError("invalid JWT");
    expect(result.type).toBe("auth");
    expect(result.message).toContain("session");
  });

  it("classifies permission denied errors as auth type", () => {
    const result = classifyTransitionError("permission denied for table stories");
    expect(result.type).toBe("auth");
    expect(result.message).toContain("permission");
  });

  it("classifies 401/unauthorized errors as auth type", () => {
    const result = classifyTransitionError("Unauthorized");
    expect(result.type).toBe("auth");
    expect(result.message).toContain("sign in");
  });

  it("classifies 403/forbidden errors as auth type", () => {
    const result = classifyTransitionError("Forbidden");
    expect(result.type).toBe("auth");
    expect(result.message).toContain("permission");
  });

  it("classifies network errors as network type", () => {
    const result = classifyTransitionError("Failed to fetch");
    expect(result.type).toBe("network");
    expect(result.message).toContain("network");
  });

  it("classifies fetch errors as network type", () => {
    const result = classifyTransitionError("NetworkError: request timed out");
    expect(result.type).toBe("network");
    expect(result.message).toContain("network");
  });

  it("classifies timeout errors as network type", () => {
    const result = classifyTransitionError("ETIMEDOUT");
    expect(result.type).toBe("network");
    expect(result.message).toContain("network");
  });

  it("classifies invalid transition errors as validation type", () => {
    const result = classifyTransitionError(
      "Invalid transition from done to backlog",
    );
    expect(result.type).toBe("validation");
    expect(result.message).toContain("Invalid transition");
  });

  it("classifies concurrent transition errors as concurrent type", () => {
    const result = classifyTransitionError(
      "A transition is already in progress",
    );
    expect(result.type).toBe("concurrent");
    expect(result.message).toContain("already in progress");
  });

  it("classifies unknown errors as unknown type", () => {
    const result = classifyTransitionError("Something unexpected happened");
    expect(result.type).toBe("unknown");
    expect(result.message).toContain("Something unexpected happened");
  });

  it("preserves the original raw error", () => {
    const result = classifyTransitionError("JWT expired");
    expect(result.raw).toBe("JWT expired");
  });

  it("includes sign-in action for auth errors", () => {
    const result = classifyTransitionError("JWT expired");
    expect(result.action).toEqual({
      label: "Sign In",
      handler: "sign-in",
    });
  });

  it("includes retry action for network errors", () => {
    const result = classifyTransitionError("Failed to fetch");
    expect(result.action).toEqual({
      label: "Retry",
      handler: "retry",
    });
  });

  it("includes no action for validation errors", () => {
    const result = classifyTransitionError(
      "Invalid transition from done to backlog",
    );
    expect(result.action).toBeUndefined();
  });

  it("includes no action for concurrent errors", () => {
    const result = classifyTransitionError(
      "A transition is already in progress",
    );
    expect(result.action).toBeUndefined();
  });

  it("handles empty string", () => {
    const result = classifyTransitionError("");
    expect(result.type).toBe("unknown");
    expect(result.message).toContain("unexpected");
  });

  it("is case-insensitive for auth patterns", () => {
    const result = classifyTransitionError(
      "NEW ROW VIOLATES ROW-LEVEL SECURITY POLICY",
    );
    expect(result.type).toBe("auth");
  });
});
