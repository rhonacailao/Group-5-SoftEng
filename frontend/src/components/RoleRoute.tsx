import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import type { Role } from "../lib/roles";

type RoleRouteProps = { allow: Role[] };

/** Use inside ProtectedRoute. Sends anyone without one of the allowed roles back to the dashboard. */
function RoleRoute({ allow }: RoleRouteProps) {
  const role = useAuthStore((s) => s.user?.role) as Role | undefined;
  if (!role || !allow.includes(role)) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}

export default RoleRoute;
