import { ApiError } from "./api";

// What an error banner needs: a short headline and one sentence of detail.
export type ErrorInfo = { title: string; message: string };

/**
 * Turns anything that was thrown into something a person can act on.
 * The back end sends { message, errors, code } with an HTTP status (see utils/httpError.js):
 *   0 = server not reachable, 400 = bad input, 401 = signed out, 403 = no right,
 *   404 = not found, 409 = conflict (e.g. "cannot be deleted: it still has 2 price records").
 * For 409 the server's own message is the useful part, so it is shown as is.
 */
export function describeError(err: unknown): ErrorInfo {
  if (err instanceof ApiError) {
    if (err.status === 0) {
      return {
        title: "Can't reach the server.",
        message: "Check your connection and try again.",
      };
    }
    if (err.status === 401) {
      return {
        title: "You're signed out.",
        message: "Sign in again to continue.",
      };
    }
    if (err.status === 403) {
      return { title: "You don't have permission.", message: err.message };
    }
    if (err.status === 404) {
      return { title: "Not found.", message: err.message };
    }
    if (err.status === 409) {
      return { title: "That can't be done right now.", message: err.message };
    }
    if (err.status === 400) {
      const first = err.errors && Object.values(err.errors)[0];
      return { title: "Please check the form.", message: first ?? err.message };
    }
    if (err.status >= 500) {
      return {
        title: "Server error.",
        message: "Something went wrong on our side. Please try again shortly.",
      };
    }
    return { title: "Something went wrong.", message: err.message };
  }
  return { title: "Something went wrong.", message: "Please try again." };
}
