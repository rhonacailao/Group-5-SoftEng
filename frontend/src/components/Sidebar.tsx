import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { isAdminOrAbove, isSuperadmin, type Role } from "../lib/roles";

// Font Awesome icons (import the CDN in index.html)
type NavItem = { to: string; label: string; icon: string };
// A group of links. Groups with a label get a divider and a small heading above them.
type NavSection = { id: string; label?: string; items: NavItem[] };

const dashboardLink: NavItem = {
  to: "/dashboard",
  label: "Dashboard",
  icon: "fa-gauge-high",
};

const customersLink: NavItem = {
  to: "/customers",
  label: "Customers",
  icon: "fa-users",
};
const productsLink: NavItem = {
  to: "/products",
  label: "Products",
  icon: "fa-box",
};
const hrLink: NavItem = {
  to: "/human-resources",
  label: "Human Resources",
  icon: "fa-id-badge",
};
const salesLink: NavItem = {
  to: "/sales",
  label: "Sales",
  icon: "fa-cart-shopping",
};

const adminLinks: NavItem[] = [
  { to: "/user-management", label: "User Management", icon: "fa-user-shield" },
];

const superadminLinks: NavItem[] = [
  { to: "/system-settings", label: "System Settings", icon: "fa-sliders" },
];

/**
 * Dashboard on its own, then "Modules", then "Administration".
 * User: Customers, Products, Sales. Admin: + Human Resources, and the Administration group
 * (User Management). Superadmin: + System Settings in Administration.
 */
function sectionsFor(role?: Role): NavSection[] {
  const admin = isAdminOrAbove(role);
  const modules = [
    customersLink,
    productsLink,
    ...(admin ? [hrLink] : []),
    salesLink,
  ];
  const administration = [
    ...(admin ? adminLinks : []),
    ...(isSuperadmin(role) ? superadminLinks : []),
  ];

  return [
    { id: "main", items: [dashboardLink] },
    { id: "modules", label: "Modules", items: modules },
    // Only people who can administer see this group at all
    ...(administration.length > 0
      ? [
          {
            id: "administration",
            label: "Administration",
            items: administration,
          },
        ]
      : []),
  ];
}

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 rounded-md px-4 py-2 ${
    isActive
      ? "bg-fire text-white shadow-lg"
      : "text-white transition-colors duration-200 ease-in-out hover:bg-dark-grey"
  }`;

function Sidebar() {
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const role = useAuthStore((s) => s.user?.role) as Role | undefined;

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col bg-dark text-white shadow">
      <div className="p-8">
        <Link to="/dashboard" className="font-bold" aria-label="Hope ERP home">
          {/*to be replaced with logo next time*/}
          <span className="text-2xl font-semibold">
            Hope <span className="text-fire">ERP</span>
          </span>
        </Link>
      </div>

      <nav
        aria-label="Main navigation"
        className="flex flex-1 flex-col gap-4 overflow-y-auto px-4"
      >
        {sectionsFor(role).map(({ id, label, items }) => (
          <div
            key={id}
            // The divider and heading sit above every group except the first
            className={label ? "border-t border-dark-grey pt-4" : undefined}
          >
            {label && (
              <h2
                id={`nav-${id}`}
                className="mb-2 px-4 text-sm font-semibold text-white/60"
              >
                {label}
              </h2>
            )}
            <ul
              aria-labelledby={label ? `nav-${id}` : undefined}
              className="flex flex-col gap-2"
            >
              {items.map(({ to, label: itemLabel, icon }) => (
                <li key={to}>
                  <NavLink to={to} className={linkClass}>
                    <i
                      className={`fa-solid ${icon} fa-fw`}
                      aria-hidden="true"
                    />
                    {itemLabel}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <footer className="flex flex-col gap-2 border-t border-dark-grey p-4">
        {/* General website settings, same for everyone */}
        <NavLink to="/settings" className={linkClass}>
          <i className="fa-solid fa-gear fa-fw" aria-hidden="true" />
          Settings
        </NavLink>
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-md px-4 py-2 text-left transition-colors duration-200 ease-in-out hover:bg-dark-grey"
        >
          <i
            className="fa-solid fa-right-from-bracket fa-fw"
            aria-hidden="true"
          />
          Log out
        </button>
      </footer>
    </aside>
  );
}

export default Sidebar;
