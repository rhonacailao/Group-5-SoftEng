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
  /** "CREATED system 2026-10-01 9:00 AM". Only needed for Admin and Superadmin. */
  stamp?: string;
};

// One price row (GET /api/products/:prodCode/prices).
export type ApiPrice = {
  effDate: string; // YYYY-MM-DD
  unitPrice: number | string;
  status: Status;
  stamp?: string;
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
  counts: Counts;
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

// The current price is derived, never stored: the active row with the latest effective date
// that is not in the future (Student Guide, section 3.4).
export const currentEffDate = (prices: ApiPrice[]) =>
  prices
    .filter((p) => p.status === "Active" && p.effDate <= today())
    .map((p) => p.effDate)
    .sort()
    .at(-1) ?? null;

// First error the server found, field messages first (e.g. "Description is required.")
export const saveMessage = (err: unknown) => {
  if (err instanceof ApiError && err.errors) {
    const first = Object.values(err.errors)[0];
    if (first) return first;
  }
  return errorMessage(err);
};
