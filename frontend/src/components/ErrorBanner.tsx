import Alert from "./Alert";

type ErrorBannerProps = {
  /** Short headline, e.g. "Can't reach the server." (see describeError in lib/errorInfo.ts) */
  title: string;
  /** One sentence of detail */
  message?: string;
  /** Adds a "Try again" button, for errors that may go away on a second attempt (a failed load) */
  onRetry?: () => void;
  /** Adds a "Dismiss" button, for errors about one action (a refused delete) */
  onDismiss?: () => void;
};

const linkButton =
  "font-semibold underline underline-offset-2 transition-colors duration-200 ease-in-out hover:no-underline";

/**
 * The error state: says what went wrong and, where it helps, offers a way out.
 * Built on the shared Alert, so it looks like every other error in the app.
 */
function ErrorBanner({ title, message, onRetry, onDismiss }: ErrorBannerProps) {
  return (
    <Alert type="error" title={title}>
      {message}
      {(onRetry || onDismiss) && (
        <span className="ml-3 inline-flex gap-3">
          {onRetry && (
            <button type="button" onClick={onRetry} className={linkButton}>
              Try again
            </button>
          )}
          {onDismiss && (
            <button type="button" onClick={onDismiss} className={linkButton}>
              Dismiss
            </button>
          )}
        </span>
      )}
    </Alert>
  );
}

export default ErrorBanner;
