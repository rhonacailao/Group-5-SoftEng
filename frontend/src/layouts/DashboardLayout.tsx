import { Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import TopbarActions from "../components/TopbarActions";

/** Left sidebar only (no top navbar). Notifications + account sit in the top right. */
function DashboardLayout() {
  return (
    <div className="flex min-h-screen bg-cream">
      <Sidebar />
      <main className="min-w-0 flex-1 p-10">
        <div className="relative mx-auto max-w-7xl">
          <div className="absolute right-0 top-0 z-20">
            <TopbarActions />
          </div>
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export default DashboardLayout;
