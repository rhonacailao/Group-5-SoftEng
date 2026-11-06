export type Role = "user" | "admin" | "superadmin";

/** Modules a User can be given rights to. Admin-only areas are not listed here. */
export const modules = [
  { id: "customers", label: "Customers", icon: "fa-users" },
  { id: "products", label: "Products", icon: "fa-box" },
  { id: "sales", label: "Sales", icon: "fa-cart-shopping" },
  { id: "hr", label: "Human Resources", icon: "fa-id-badge" },
] as const;

export const actions = [
  { id: "view", label: "View" },
  { id: "create", label: "Create" },
  { id: "edit", label: "Edit" },
  { id: "delete", label: "Delete" },
] as const;

export type ModuleId = (typeof modules)[number]["id"];
export type ActionId = (typeof actions)[number]["id"];

/** For each module: is it switched on, and what may the person do in it. */
export type Rights = Record<ModuleId, { enabled: boolean; actions: ActionId[] }>;

export const emptyRights = (): Rights => {
  const rights = {} as Rights;
  for (const m of modules) rights[m.id] = { enabled: false, actions: [] };
  return rights;
};

export const isAdminOrAbove = (role?: Role) => role === "admin" || role === "superadmin";
export const isSuperadmin = (role?: Role) => role === "superadmin";

/**
 * Who can Block / Rights / Edit whom.
 * Admin: Users only. Superadmin: Users and Admins (never another Superadmin).
 */
export function canManage(viewer: Role | undefined, target: Role): boolean {
  if (viewer === "superadmin") return target !== "superadmin";
  if (viewer === "admin") return target === "user";
  return false;
}
