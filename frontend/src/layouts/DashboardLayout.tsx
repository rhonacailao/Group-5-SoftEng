import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import TopbarActions from "../components/TopbarActions";

// Pages that don't show the notifications + account icons in the top right.
const hideTopbarOn = ["/user-management"];

/** Left sidebar only (no top navbar). Notifications + account sit in the top right. */
function DashboardLayout() {
  const { pathname } = useLocation();
  const showTopbar = !hideTopbarOn.includes(pathname);

  return (
    <div className="flex min-h-screen bg-cream">
      <Sidebar />
      <main className="min-w-0 flex-1 p-10">
        <div className="relative mx-auto max-w-7xl">
          {showTopbar && (
            <div className="absolute right-0 top-0 z-20">
              <TopbarActions />
            </div>
          )}
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export default DashboardLayout;
