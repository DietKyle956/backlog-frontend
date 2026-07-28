/**
 * Visual evidence test for BLF-024: Classified error messages for status transitions.
 * Renders the TransitionErrorBanner component with each error type and captures
 * the resulting HTML for visual review on the PR.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TransitionErrorBanner } from "../../../../src/components/TransitionErrorBanner";
import { classifyTransitionError } from "../../../../src/lib/error-classification";
import * as fs from "node:fs";
import * as path from "node:path";

const EVIDENCE_DIR = path.resolve(
  __dirname,
);

function writeEvidence(filename: string, html: string) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  fs.writeFileSync(path.join(EVIDENCE_DIR, filename), html, "utf-8");
}

// Small CSS to make evidence files readable standalone
const WRAPPER_STYLE = `
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0d1117; color: #e6edf3; padding: 24px; max-width: 600px; margin: 0 auto; }
  h2 { font-size: 16px; color: #8b949e; margin: 0 0 12px 0; font-weight: 500; }
  .specimen { margin-bottom: 32px; }
  .raw { font-size: 11px; color: #6e7681; margin: 8px 0 0 0; background: #161b22; padding: 6px 10px; border-radius: 4px; font-family: monospace; }
  .raw-label { font-size: 10px; color: #484f58; text-transform: uppercase; }
</style>
`;

describe("BLF-024: Error Banner Visual Evidence", () => {
  const onDismiss = () => {};
  const onSignIn = () => {};

  it("renders auth error banner (JWT expired) with Sign In button", () => {
    const error = classifyTransitionError("JWT expired");
    const { container } = render(
      <TransitionErrorBanner error={error} onDismiss={onDismiss} onSignIn={onSignIn} />
    );
    expect(screen.getByText(/session has expired/i)).toBeInTheDocument();
    expect(screen.getByText("Sign In to retry")).toBeInTheDocument();
    expect(screen.getByText("Dismiss")).toBeInTheDocument();
    writeEvidence("auth-jwt-expired.html",
      `<html>${WRAPPER_STYLE}<body><h2>Auth Error — JWT Expired</h2><div class="specimen">${container.innerHTML}</div><p class="raw"><span class="raw-label">Raw error: </span>JWT expired</p></body></html>`
    );
  });

  it("renders auth error banner (RLS violation) with Sign In button", () => {
    const error = classifyTransitionError(
      'new row violates row-level security policy for table "stories"'
    );
    const { container } = render(
      <TransitionErrorBanner error={error} onDismiss={onDismiss} onSignIn={onSignIn} />
    );
    expect(screen.getByText(/session has expired/i)).toBeInTheDocument();
    expect(screen.getByText("Sign In to retry")).toBeInTheDocument();
    writeEvidence("auth-rls-violation.html",
      `<html>${WRAPPER_STYLE}<body><h2>Auth Error — RLS Violation (Supabase raw error)</h2><div class="specimen">${container.innerHTML}</div><p class="raw"><span class="raw-label">Raw error: </span>new row violates row-level security policy for table "stories"</p></body></html>`
    );
  });

  it("renders network error banner with Dismiss button", () => {
    const error = classifyTransitionError("Failed to fetch");
    const { container } = render(
      <TransitionErrorBanner error={error} onDismiss={onDismiss} onSignIn={onSignIn} />
    );
    expect(screen.getByText(/network error occurred/i)).toBeInTheDocument();
    expect(screen.getAllByText("Dismiss").length).toBeGreaterThanOrEqual(1);
    // No Sign In button for network errors
    expect(screen.queryByText("Sign In to retry")).not.toBeInTheDocument();
    writeEvidence("network-failed-to-fetch.html",
      `<html>${WRAPPER_STYLE}<body><h2>Network Error — Failed to Fetch</h2><div class="specimen">${container.innerHTML}</div><p class="raw"><span class="raw-label">Raw error: </span>Failed to fetch</p></body></html>`
    );
  });

  it("renders validation error banner (no action buttons)", () => {
    const error = classifyTransitionError(
      "Invalid transition from done to backlog"
    );
    const { container } = render(
      <TransitionErrorBanner error={error} onDismiss={onDismiss} onSignIn={onSignIn} />
    );
    expect(screen.getByText("Invalid transition from done to backlog")).toBeInTheDocument();
    // No action section for validation errors
    expect(screen.queryByText("Sign In to retry")).not.toBeInTheDocument();
    writeEvidence("validation-invalid-transition.html",
      `<html>${WRAPPER_STYLE}<body><h2>Validation Error — Invalid Transition</h2><div class="specimen">${container.innerHTML}</div><p class="raw"><span class="raw-label">Raw error: </span>Invalid transition from done to backlog</p></body></html>`
    );
  });

  it("renders concurrent error banner (no action buttons)", () => {
    const error = classifyTransitionError("A transition is already in progress");
    const { container } = render(
      <TransitionErrorBanner error={error} onDismiss={onDismiss} onSignIn={onSignIn} />
    );
    expect(screen.getByText(/already in progress/i)).toBeInTheDocument();
    // No action section
    expect(screen.queryByText("Sign In to retry")).not.toBeInTheDocument();
    writeEvidence("concurrent-in-progress.html",
      `<html>${WRAPPER_STYLE}<body><h2>Concurrent Error — Already in Progress</h2><div class="specimen">${container.innerHTML}</div><p class="raw"><span class="raw-label">Raw error: </span>A transition is already in progress</p></body></html>`
    );
  });

  it("renders unknown error banner (raw message shown)", () => {
    const error = classifyTransitionError("Something unexpected happened");
    const { container } = render(
      <TransitionErrorBanner error={error} onDismiss={onDismiss} onSignIn={onSignIn} />
    );
    expect(screen.getByText("Something unexpected happened")).toBeInTheDocument();
    expect(screen.queryByText("Sign In to retry")).not.toBeInTheDocument();
    writeEvidence("unknown-error.html",
      `<html>${WRAPPER_STYLE}<body><h2>Unknown Error — Raw Message Shown</h2><div class="specimen">${container.innerHTML}</div><p class="raw"><span class="raw-label">Raw error: </span>Something unexpected happened</p></body></html>`
    );
  });

  it("renders empty error as unknown with fallback message", () => {
    const error = classifyTransitionError("");
    render(
      <TransitionErrorBanner error={error} onDismiss={onDismiss} onSignIn={onSignIn} />
    );
    expect(screen.getByText(/unexpected error occurred/i)).toBeInTheDocument();
  });
});
