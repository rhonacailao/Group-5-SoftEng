import { useEffect } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "../store/authStore";

/** Only lets logged-in users through; everyone else goes to /login. */
function ProtectedRoute() {
  const status = useAuthStore((s) => s.status);
  const checkSession = useAuthStore((s) => s.checkSession);

  useEffect(() => {
    void checkSession();
  }, [checkSession]);

  if (status === "unknown") {
    return (
      <div
        role="status"
        className="flex min-h-screen items-center justify-center bg-cream text-fire"
      >
        <i className="fa-solid fa-spinner fa-spin text-3xl" aria-hidden="true" />
        <span className="sr-only">Loading...</span>
      </div>
    );
  }
  if (status === "guest") return <Navigate to="/login" replace />;
  return <Outlet />;
}

export default ProtectedRoute;
