import type { ApiStamp } from "./products";

// The back end sends { action, user, date }. The demo data still uses one line of text like
// "EDITED user1 2026-10-13 1:01 PM", so that form is understood too.
export function toStamp(
  value: ApiStamp | string | null | undefined,
): ApiStamp | null {
  if (!value) return null;
  if (typeof value !== "string") return value;
  const match = value.match(/^(CREATED|EDITED|DELETED|RESTORED)\s+(\S+)\s*(.*)$/i);
  if (!match) return { action: "CREATED", user: "system", date: value || null };
  return { action: match[1].toUpperCase(), user: match[2], date: match[3] || null };
}
