import { ApiError, errorMessage } from "./api";
import type { Role } from "./roles";
import type { Unit } from "./units";

// Shared types, constants and helpers for the Products and Price History screens.

export type Status = "Active" | "Inactive";

// One product row as the back end sends it (GET /api/products).
export type ApiProduct = {
  prodCode: string;
  description: string;
  unit: Unit;
  status: Status;
  /** Price in force today, from PRICEHIST. null / missing = no price yet. Postgres may send a string. */
  currentPrice?: number | string | null;
  /** Last action on the row. Only Admin and Superadmin get it; the demo data uses one line of text. */
  stamp?: ApiStamp | string;
};

// Who did the last thing to a row (from the audit log). date is null for sample data nobody touched.
export type ApiStamp = {
  action: "CREATED" | "EDITED" | "DELETED" | "RESTORED" | string;
  user: string;
  date: string | null;
};

// Where a price sits in time, worked out by the server (price.repository.js):
// Current = in effect today, Upcoming = starts later, Past = replaced by a newer one.
export type PriceState = "Current" | "Upcoming" | "Past";

// One price row. The price history table has no soft delete, so a price has no status or
// stamp: deleting one really removes it (price.repository.js).
export type ApiPrice = {
  effDate: string; // YYYY-MM-DD
  unitPrice: number | string;
  state?: PriceState;
};

export type Tab = "active" | "inactive" | "all";
export type Counts = Record<Tab, number>;

export type ListResponse = {
  ok: true;
  products: ApiProduct[];
  total: number;
  counts: Counts;
  page: number;
  pageSize: number;
};

export type PriceListResponse = {
  ok: true;
  prices: ApiPrice[];
};

export type MenuResponse = {
  ok: true;
  tiles: { code: string; rights: string[] }[];
};

export type ListParams = {
  status: Tab;
  search: string;
  unit: Unit | "";
  page: number;
  pageSize: number;
};

export const PAGE_SIZE = 20;
export const DEMO_USER_ID = 0; // the offline demo account has no server session (see authStore.ts)

export const ALL_PRODUCT_RIGHTS = [
  "PRODUCT_ADD",
  "PRODUCT_EDIT",
  "PRODUCT_DELETE",
  "PRICE_ADD",
  "PRICE_EDIT",
  "PRICE_DELETE",
];

// ---------- small helpers ----------

export const actionButton =
  "rounded-md border border-light-grey bg-white px-3 py-1 text-sm transition-colors duration-200 ease-in-out hover:bg-light-grey disabled:opacity-60";
export const dangerButton =
  "rounded-md border border-red-900 bg-white px-3 py-1 text-sm text-red-800 transition-colors duration-200 ease-in-out hover:bg-red-200 disabled:opacity-60";

export const tabs: { id: Tab; label: string }[] = [
  { id: "active", label: "Active" },
  { id: "inactive", label: "Inactive" },
  { id: "all", label: "All" },
];

export const roleLabel: Record<Role, string> = {
  user: "User",
  admin: "Admin",
  superadmin: "Superadmin",
};
export const roleChip: Record<Role, string> = {
  superadmin: "bg-dark text-white",
  admin: "border border-dark-grey bg-cream text-dark",
  user: "border border-light-grey bg-white text-dark-grey",
};
export const roleIntro: Record<Role, string> = {
  superadmin:
    "Full access. You see every product, including deleted ones, and can use every action.",
  admin:
    "You see every product, including deleted ones, with Status and Stamp. Actions follow the rights granted to you.",
  user: "Search products and see their prices. Actions follow the rights an Admin granted you.",
};

export const asRole = (value?: string): Role =>
  value === "superadmin" || value === "admin" ? value : "user";

export const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});
export const money = (value: number | string | null | undefined) =>
  value === null || value === undefined || value === ""
    ? "—"
    : usd.format(Number(value));

// Today as YYYY-MM-DD in the browser's time zone (dates compare correctly as plain text)
export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// The current price is derived, never stored: the row with the latest effective date that is
// not in the future (Student Guide, section 3.4). The server does this for real data; the demo
// data uses this helper so it behaves the same way.
export const withStates = (
  rows: { effDate: string; unitPrice: number | string }[],
): ApiPrice[] => {
  const now = today();
  const currentDate = rows
    .map((r) => r.effDate)
    .filter((d) => d <= now)
    .sort()
    .at(-1);
  return [...rows]
    .sort((a, b) => b.effDate.localeCompare(a.effDate))
    .map((r) => ({
      ...r,
      state:
        r.effDate > now
          ? "Upcoming"
          : r.effDate === currentDate
            ? "Current"
            : "Past",
    }));
};

// First error the server found, field messages first (e.g. "Description is required.")
export const saveMessage = (err: unknown) => {
  if (err instanceof ApiError && err.errors) {
    const first = Object.values(err.errors)[0];
    if (first) return first;
  }
  return errorMessage(err);
};
