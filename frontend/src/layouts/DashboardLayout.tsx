import { Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar";

/** Left sidebar only (no top navbar). Used by every in-app page. */
function DashboardLayout() {
  return (
    <div className="flex min-h-screen bg-cream">
      <Sidebar />
      <main className="min-w-0 flex-1 p-10">
        <Outlet />
      </main>
    </div>
  );
}

export default DashboardLayout;
