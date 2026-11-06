import { useCallback, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useDismiss } from "../lib/useDismiss";
import { useAuthStore } from "../store/authStore";

type Notification = {
  id: number;
  icon: string;
  title: string;
  detail: string;
  time: string;
  unread: boolean;
};

// Mock data: the back end has no notifications endpoint yet.
const initialNotifications: Notification[] = [
  { id: 1, icon: "fa-triangle-exclamation", title: "Order TR000125 is overdue", detail: "Globus Medical, Inc", time: "2h ago", unread: true },
  { id: 2, icon: "fa-user-plus", title: "New registration waiting for approval", detail: "User Management", time: "5h ago", unread: true },
  { id: 3, icon: "fa-truck", title: "Order TR000126 ships tomorrow", detail: "Astronics, Inc", time: "Yesterday", unread: true },
  { id: 4, icon: "fa-circle-check", title: "Official receipt OR000165 issued", detail: "Landec Corp.", time: "2 days ago", unread: false },
];

const iconButton =
  "relative flex h-11 w-11 items-center justify-center rounded-full bg-paper text-lg text-dark hover:bg-white";

type MenuName = "notifications" | "account";

/** Top right corner of the dashboard: notifications dropdown + account dropdown. */
function TopbarActions() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const [open, setOpen] = useState<MenuName | null>(null);
  const [notifications, setNotifications] = useState(initialNotifications);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(null), []);
  useDismiss(wrapperRef, open !== null, close);

  const toggle = (name: MenuName) => setOpen((cur) => (cur === name ? null : name));
  const unread = notifications.filter((n) => n.unread).length;
  const markAllRead = () => setNotifications((list) => list.map((n) => ({ ...n, unread: false })));

  const fullName = user ? `${user.firstName} ${user.lastName}` : "Account";
  const initials = user ? `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase() : "?";

  const handleLogout = async () => {
    close();
    await logout();
    navigate("/login");
  };

  return (
    <div ref={wrapperRef} className="flex items-center gap-3">
      {/*----------Notifications----------*/}
      <div className="relative">
        <button
          type="button"
          className={iconButton}
          aria-label={`Notifications, ${unread} unread`}
          aria-expanded={open === "notifications"}
          aria-controls="notifications-panel"
          onClick={() => toggle("notifications")}
        >
          <i className="fa-solid fa-bell" aria-hidden="true" />
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-fire px-1 text-xs font-bold text-white">
              {unread}
            </span>
          )}
        </button>

        {open === "notifications" && (
          <div
            id="notifications-panel"
            className="absolute right-0 z-30 mt-2 w-96 max-w-[90vw] rounded-xl bg-paper p-2 shadow-lg"
          >
            <header className="flex items-center justify-between px-3 py-2">
              <h2 className="text-lg font-bold">Notifications</h2>
              <button
                type="button"
                onClick={markAllRead}
                disabled={unread === 0}
                className="text-sm text-fire underline disabled:text-dark-grey disabled:no-underline"
              >
                Mark all as read
              </button>
            </header>
            <ul className="flex flex-col">
              {notifications.map((n) => (
                <li
                  key={n.id}
                  className={`flex items-start gap-3 rounded-md px-3 py-3 ${n.unread ? "bg-white" : ""}`}
                >
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cream text-fire">
                    <i className={`fa-solid ${n.icon}`} aria-hidden="true" />
                  </span>
                  <span className="flex-1">
                    <span className={`block text-sm ${n.unread ? "font-bold" : "font-semibold"}`}>
                      {n.title}
                    </span>
                    <span className="block text-xs text-dark-grey">
                      {n.detail} &middot; {n.time}
                    </span>
                  </span>
                  {n.unread && (
                    <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-fire">
                      <span className="sr-only">Unread</span>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/*----------Account----------*/}
      <div className="relative">
        <button
          type="button"
          className="flex h-11 items-center gap-2 rounded-full bg-paper pl-1.5 pr-4 hover:bg-white"
          aria-label="Account menu"
          aria-expanded={open === "account"}
          aria-controls="account-panel"
          onClick={() => toggle("account")}
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-fire text-sm font-bold text-white">
            {initials}
          </span>
          <span className="hidden text-sm font-semibold sm:inline">{fullName}</span>
          <i
            className={`fa-solid fa-chevron-down text-xs ${open === "account" ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </button>

        {open === "account" && (
          <div
            id="account-panel"
            className="absolute right-0 z-30 mt-2 w-64 rounded-xl bg-paper p-2 shadow-lg"
          >
            <header className="border-b border-light-grey px-3 py-2">
              <p className="font-bold">{fullName}</p>
              <p className="truncate text-sm text-dark-grey">{user?.email}</p>
            </header>
            <ul className="flex flex-col py-1">
              <li>
                <Link
                  to="/account"
                  onClick={close}
                  className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-white"
                >
                  <i className="fa-solid fa-user fa-fw text-fire" aria-hidden="true" />
                  My account
                </Link>
              </li>
              <li>
                <Link
                  to="/settings"
                  onClick={close}
                  className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-white"
                >
                  <i className="fa-solid fa-gear fa-fw text-fire" aria-hidden="true" />
                  Settings
                </Link>
              </li>
            </ul>
            <div className="border-t border-light-grey pt-1">
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-white"
              >
                <i className="fa-solid fa-right-from-bracket fa-fw text-fire" aria-hidden="true" />
                Log out
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default TopbarActions;
