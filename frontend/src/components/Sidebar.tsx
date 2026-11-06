import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { isAdminOrAbove, isSuperadmin, type Role } from "../lib/roles";

// Font Awesome icons (import the CDN in index.html)
type NavItem = { to: string; label: string; icon: string };

const baseLinks: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: "fa-gauge-high" },
  { to: "/customers", label: "Customers", icon: "fa-users" },
  { to: "/products", label: "Products", icon: "fa-box" },
  { to: "/sales", label: "Sales", icon: "fa-cart-shopping" },
];

const adminLinks: NavItem[] = [
  { to: "/human-resources", label: "Human Resources", icon: "fa-id-badge" },
  { to: "/user-management", label: "User Management", icon: "fa-user-shield" },
];

const superadminLinks: NavItem[] = [
  { to: "/system-settings", label: "System Settings", icon: "fa-sliders" },
];

/** User: base modules. Admin: + HR and User Management. Superadmin: + System Settings. */
function linksFor(role?: Role): NavItem[] {
  return [
    ...baseLinks,
    ...(isAdminOrAbove(role) ? adminLinks : []),
    ...(isSuperadmin(role) ? superadminLinks : []),
  ];
}

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 rounded-md px-4 py-2 ${
    isActive ? "bg-fire text-white shadow-lg" : "text-white hover:bg-dark-grey"
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

      <nav aria-label="Main navigation" className="flex-1 overflow-y-auto px-4">
        <ul className="flex flex-col gap-2">
          {linksFor(role).map(({ to, label, icon }) => (
            <li key={to}>
              <NavLink to={to} className={linkClass}>
                <i className={`fa-solid ${icon} fa-fw`} aria-hidden="true" />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
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
          className="flex w-full items-center gap-3 rounded-md px-4 py-2 text-left hover:bg-dark-grey"
        >
          <i className="fa-solid fa-right-from-bracket fa-fw" aria-hidden="true" />
          Log out
        </button>
      </footer>
    </aside>
  );
}

export default Sidebar;
