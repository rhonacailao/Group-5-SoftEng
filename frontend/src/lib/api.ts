// Talks to the Express back end (backend/src). The login cookie (hope_sid) is httpOnly,
// so we only need `credentials: "include"` and the browser does the rest.
const API_URL = (import.meta.env.VITE_API_URL ?? "http://localhost:3000").replace(/\/$/, "");

export type User = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
};

/** Error shape returned by the back end: { ok:false, message, errors?, code? } */
export class ApiError extends Error {
  status: number;
  code?: string;
  errors?: Record<string, string>;

  constructor(message: string, status: number, code?: string, errors?: Record<string, string>) {
    super(message);
    this.status = status;
    this.code = code;
    this.errors = errors;
  }
}

type ApiOptions = { method?: "GET" | "POST" | "PATCH"; body?: unknown };

export async function api<T = { ok: true }>(path: string, options: ApiOptions = {}): Promise<T> {
  const hasBody = options.body !== undefined;
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: options.method ?? (hasBody ? "POST" : "GET"),
      headers: hasBody ? { "Content-Type": "application/json" } : undefined,
      body: hasBody ? JSON.stringify(options.body) : undefined,
      credentials: "include",
    });
  } catch {
    throw new ApiError("Cannot reach the server. Please try again.", 0);
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(
      data?.message ?? "Something went wrong. Please try again.",
      res.status,
      data?.code,
      data?.errors,
    );
  }
  return data as T;
}

export function errorMessage(err: unknown): string {
  return err instanceof ApiError ? err.message : "Something went wrong. Please try again.";
}
