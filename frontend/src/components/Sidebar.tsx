import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type SyntheticEvent,
} from "react";
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

// ---------- size ----------
// Expanded width can be dragged between MIN_WIDTH and 30% of the window (never less than MIN_WIDTH).
// Dragging narrower than COLLAPSE_BELOW snaps the sidebar to icons only; dragging it back out
// expands it again.
const DEFAULT_WIDTH = 256; // same as the old w-64
const MIN_WIDTH = 224; // narrowest that still fits "Human Resources" without cutting it
const COLLAPSED_WIDTH = 80; // same as w-20: icons only
const COLLAPSE_BELOW = 176; // dragging the edge left of this collapses the sidebar
const MAX_FRACTION = 0.3;
const KEY_STEP = 16;

const maxWidth = () =>
  Math.max(MIN_WIDTH, Math.floor(window.innerWidth * MAX_FRACTION));
const clampWidth = (w: number) =>
  Math.min(maxWidth(), Math.max(MIN_WIDTH, Math.round(w)));

// Both choices are remembered in this browser, so the sidebar stays as the person left it.
const COLLAPSED_KEY = "sidebar-collapsed";
const WIDTH_KEY = "sidebar-width";

function readStored(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null; // storage can be blocked: use the defaults
  }
}

function writeStored(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // not saved, but the sidebar still changes for this visit
  }
}

const readCollapsed = () => readStored(COLLAPSED_KEY) === "true";
const readWidth = () => {
  const saved = Number(readStored(WIDTH_KEY));
  return saved > 0 ? clampWidth(saved) : DEFAULT_WIDTH;
};

type Tip = { label: string; top: number; left: number } | null;

// ---------- classes ----------
// Every row is exactly h-10, collapsed or not, so the icons stay level when the labels go away.
// Collapsed: icon only, centered. Expanded: icon and label.
const rowClass = (collapsed: boolean) =>
  `flex h-10 items-center rounded-md ${
    collapsed ? "justify-center px-0" : "gap-3 px-4"
  }`;

const linkClass =
  (collapsed: boolean) =>
  ({ isActive }: { isActive: boolean }) =>
    `${rowClass(collapsed)} ${
      isActive
        ? "bg-fire text-white shadow-lg"
        : "text-white transition-colors duration-200 ease-in-out hover:bg-dark-grey"
    }`;

// The label stays in the page for screen readers when the text is hidden
const labelClass = (collapsed: boolean) =>
  collapsed ? "sr-only" : "whitespace-nowrap";

function Sidebar() {
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const role = useAuthStore((s) => s.user?.role) as Role | undefined;
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [width, setWidth] = useState(readWidth);
  const [dragging, setDragging] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<Tip>(null);

  // Tooltip next to the hovered or focused icon. It is drawn with position: fixed outside the
  // aside, because the aside and the nav clip anything that sticks out of them.
  const showTip = (label: string) => (e: SyntheticEvent<HTMLElement>) => {
    const target = e.currentTarget.getBoundingClientRect();
    const edge = wrapRef.current?.getBoundingClientRect().right ?? target.right;
    // Every tooltip starts at the sidebar's right edge, so they line up in one column
    setTip({ label, top: target.top + target.height / 2, left: edge + 8 });
  };
  const hideTip = () => setTip(null);
  const tipHandlers = (label: string) => ({
    onMouseEnter: showTip(label),
    onMouseLeave: hideTip,
    onFocus: showTip(label),
    onBlur: hideTip,
  });

  // Saves the size and whether it is collapsed, so both come back after a refresh
  const commit = (nextCollapsed: boolean, nextWidth: number) => {
    setTip(null);
    setCollapsed(nextCollapsed);
    setWidth(nextWidth);
    writeStored(COLLAPSED_KEY, String(nextCollapsed));
    writeStored(WIDTH_KEY, String(nextWidth));
  };

  // A smaller window can make the saved width too wide: pull it back to 30%
  useEffect(() => {
    const onResize = () => setWidth((w) => clampWidth(w));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // While dragging: keep the resize cursor and do not select text on the page
  useEffect(() => {
    if (!dragging) return;
    const { cursor, userSelect } = document.body.style;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    return () => {
      document.body.style.cursor = cursor;
      document.body.style.userSelect = userSelect;
    };
  }, [dragging]);

  const startDrag = (e: PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
  };
  const drag = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    const left = wrapRef.current?.getBoundingClientRect().left ?? 0;
    const raw = e.clientX - left;
    if (raw < COLLAPSE_BELOW) {
      setTip(null);
      setCollapsed(true);
    } else {
      setCollapsed(false);
      setWidth(clampWidth(raw));
    }
  };
  const endDrag = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    setDragging(false);
    commit(collapsed, width);
  };
  // Keyboard: left and right arrows resize (past the narrowest width, left collapses and
  // right expands again). Double click or Home goes back to the default width.
  const onHandleKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowLeft") {
      if (collapsed) return;
      if (width - KEY_STEP < MIN_WIDTH) commit(true, width);
      else commit(false, clampWidth(width - KEY_STEP));
    } else if (e.key === "ArrowRight") {
      commit(false, collapsed ? width : clampWidth(width + KEY_STEP));
    } else if (e.key === "Home") commit(false, DEFAULT_WIDTH);
    else if (e.key === "End") commit(false, maxWidth());
    else return;
    e.preventDefault();
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    // The wrapper holds the width and does not clip, so the resize handle and tooltips can stick out
    <div
      ref={wrapRef}
      style={{ width: collapsed ? COLLAPSED_WIDTH : width }}
      className={`sticky top-0 z-40 h-screen shrink-0 ${
        dragging
          ? ""
          : "transition-[width] duration-200 ease-in-out motion-reduce:transition-none"
      }`}
    >
      <aside className="flex h-full w-full flex-col overflow-hidden bg-dark text-white shadow">
        <div className={collapsed ? "px-4 py-8 text-center" : "p-8"}>
          <Link
            to="/dashboard"
            className="font-bold"
            aria-label="Hope ERP home"
          >
            {/*to be replaced with logo next time*/}
            <span className="text-2xl font-semibold">
              {collapsed ? (
                <span className="text-fire">H</span>
              ) : (
                <>
                  Hope <span className="text-fire">ERP</span>
                </>
              )}
            </span>
          </Link>
        </div>

        <nav
          aria-label="Main navigation"
          onScroll={hideTip}
          className="flex flex-1 flex-col gap-4 overflow-y-auto overflow-x-hidden px-4"
        >
          {sectionsFor(role).map(({ id, label, items }) => (
            <div
              key={id}
              // The divider and heading sit above every group except the first
              className={label ? "border-t border-dark-grey pt-4" : undefined}
            >
              {label && (
                // Collapsed: the text is invisible but the heading keeps its height,
                // so the links below stay level with the expanded sidebar
                <h2
                  id={`nav-${id}`}
                  className={`mb-2 h-5 overflow-hidden whitespace-nowrap px-4 text-sm font-semibold leading-5 text-white/60 ${
                    collapsed ? "invisible" : ""
                  }`}
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
                    <NavLink
                      to={to}
                      className={linkClass(collapsed)}
                      {...(collapsed ? tipHandlers(itemLabel) : {})}
                    >
                      <i
                        className={`fa-solid ${icon} fa-fw`}
                        aria-hidden="true"
                      />
                      <span className={labelClass(collapsed)}>{itemLabel}</span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <footer className="flex flex-col gap-2 border-t border-dark-grey p-4">
          {/* General website settings, same for everyone */}
          <NavLink
            to="/settings"
            className={linkClass(collapsed)}
            {...(collapsed ? tipHandlers("Settings") : {})}
          >
            <i className="fa-solid fa-gear fa-fw" aria-hidden="true" />
            <span className={labelClass(collapsed)}>Settings</span>
          </NavLink>
          <button
            type="button"
            onClick={handleLogout}
            {...(collapsed ? tipHandlers("Log out") : {})}
            className={`${rowClass(collapsed)} w-full text-left transition-colors duration-200 ease-in-out hover:bg-dark-grey`}
          >
            <i
              className="fa-solid fa-right-from-bracket fa-fw"
              aria-hidden="true"
            />
            <span className={labelClass(collapsed)}>Log out</span>
          </button>
        </footer>
      </aside>

      {/* Drag the right edge to resize. Dragging far left collapses to icons; dragging out expands. */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize sidebar"
        aria-valuemin={COLLAPSED_WIDTH}
        aria-valuemax={maxWidth()}
        aria-valuenow={collapsed ? COLLAPSED_WIDTH : width}
        tabIndex={0}
        onPointerDown={startDrag}
        onPointerMove={drag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onHandleKey}
        onDoubleClick={() => commit(false, DEFAULT_WIDTH)}
        className={`absolute inset-y-0 -right-1 z-20 w-2 cursor-col-resize touch-none transition-colors duration-200 ease-in-out hover:bg-fire/60 focus-visible:bg-fire focus-visible:outline-none ${
          dragging ? "bg-fire/60" : ""
        }`}
      />

      {/* Tooltip: only the icon-only sidebar needs it. The labels are already read by screen
          readers, so this is for the eye only. */}
      {tip && (
        <div
          aria-hidden="true"
          style={{ top: tip.top, left: tip.left }}
          className="pointer-events-none fixed z-50 -translate-y-1/2 whitespace-nowrap rounded-md border border-dark-grey bg-dark px-3 py-1.5 text-sm text-white shadow-lg"
        >
          {tip.label}
        </div>
      )}
    </div>
  );
}

export default Sidebar;
