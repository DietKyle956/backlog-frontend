import type { ClassifiedError } from "../lib/error-classification";

interface TransitionErrorBannerProps {
  error: ClassifiedError;
  onDismiss: () => void;
  onSignIn: () => void;
}

export function TransitionErrorBanner({
  error,
  onDismiss,
  onSignIn,
}: TransitionErrorBannerProps) {
  return (
    <div className="mx-4 mt-3 px-3 py-2.5 bg-accent-danger/15 border border-accent-danger/30 rounded-lg text-sm text-accent-danger">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm leading-snug">{error.message}</p>
        <button
          type="button"
          onClick={onDismiss}
          className="ml-2 underline text-xs flex-shrink-0 hover:text-accent-danger/80 transition-colors"
        >
          Dismiss
        </button>
      </div>
      {error.action && (
        <div className="mt-2 pt-2 border-t border-accent-danger/20">
          {error.action.handler === "sign-in" ? (
            <button
              type="button"
              onClick={() => {
                onDismiss();
                onSignIn();
              }}
              className="text-xs font-medium px-3 py-1 rounded-md
                         bg-accent-danger/20 text-accent-danger
                         hover:bg-accent-danger/30 active:scale-95
                         transition-all duration-100"
            >
              Sign In to retry
            </button>
          ) : error.action.handler === "retry" ? (
            <button
              type="button"
              onClick={onDismiss}
              className="text-xs font-medium px-3 py-1 rounded-md
                         bg-accent-danger/20 text-accent-danger
                         hover:bg-accent-danger/30 active:scale-95
                         transition-all duration-100"
            >
              Dismiss
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
