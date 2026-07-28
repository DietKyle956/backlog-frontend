export type TransitionErrorType =
  | "auth"
  | "validation"
  | "network"
  | "concurrent"
  | "unknown";

export interface ErrorAction {
  label: string;
  handler: "sign-in" | "retry";
}

export interface ClassifiedError {
  type: TransitionErrorType;
  message: string;
  raw: string;
  action?: ErrorAction;
}

const AUTH_PATTERNS = [
  /row.level security/i,
  /permission denied/i,
  /jwt expired/i,
  /invalid jwt/i,
  /unauthorized/i,
  /forbidden/i,
  /not authorized/i,
  /insufficient privilege/i,
  /must be logged in/i,
  /auth.*required/i,
];

const NETWORK_PATTERNS = [
  /failed to fetch/i,
  /networkerror/i,
  /network error/i,
  /timedout/i,
  /timeout/i,
  /econnrefused/i,
  /enotfound/i,
  /enetunreach/i,
  /request timed out/i,
  /connection.*refused/i,
  /unable to reach/i,
];

const CONCURRENT_PATTERNS = [/already in progress/i];

const VALIDATION_PATTERNS = [/invalid transition/i];

function matchesAny(input: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(input));
}

export function classifyTransitionError(raw: string): ClassifiedError {
  if (!raw) {
    return {
      type: "unknown",
      message: "An unexpected error occurred. Please try again.",
      raw,
    };
  }

  if (matchesAny(raw, AUTH_PATTERNS)) {
    return {
      type: "auth",
      message: "Your session has expired or you don't have permission to make this change. Please sign in again.",
      raw,
      action: { label: "Sign In", handler: "sign-in" },
    };
  }

  if (matchesAny(raw, NETWORK_PATTERNS)) {
    return {
      type: "network",
      message: "A network error occurred. Please check your connection and try again.",
      raw,
      action: { label: "Retry", handler: "retry" },
    };
  }

  if (matchesAny(raw, CONCURRENT_PATTERNS)) {
    return {
      type: "concurrent",
      message: "A transition is already in progress. Please wait for it to complete.",
      raw,
    };
  }

  if (matchesAny(raw, VALIDATION_PATTERNS)) {
    return {
      type: "validation",
      message: raw,
      raw,
    };
  }

  return {
    type: "unknown",
    message: raw,
    raw,
  };
}
