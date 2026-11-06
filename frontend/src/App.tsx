import "./App.css";
import { Navigate, Route, Routes } from "react-router-dom";
import AuthLayout from "./layouts/AuthLayout";
import DashboardLayout from "./layouts/DashboardLayout";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import SetPasswordPage from "./pages/SetPasswordPage";
import DashboardPage from "./pages/DashboardPage";
import PlaceholderPage from "./pages/PlaceholderPage";
import AccountPage from "./pages/AccountPage";
import CustomersPage from "./pages/CustomersPage";
import UserManagementPage from "./pages/UserManagementPage";
import SystemSettingsPage from "./pages/SystemSettingsPage";
import ProtectedRoute from "./components/ProtectedRoute";
import RoleRoute from "./components/RoleRoute";

function App() {
  return (
    <Routes>
      {/* Pages with the top navbar */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/set-password" element={<SetPasswordPage />} />
      </Route>

      {/* Logged-in pages with the left sidebar (no navbar) */}
      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/customers" element={<CustomersPage />} />
          <Route path="/products" element={<PlaceholderPage title="Products" />} />
          <Route path="/sales" element={<PlaceholderPage title="Sales" />} />
          <Route path="/settings" element={<PlaceholderPage title="Settings" />} />
          <Route path="/account" element={<AccountPage />} />

          {/* Admin and Superadmin */}
          <Route element={<RoleRoute allow={["admin", "superadmin"]} />}>
            <Route path="/human-resources" element={<PlaceholderPage title="Human Resources" />} />
            <Route path="/user-management" element={<UserManagementPage />} />
          </Route>

          {/* Superadmin only */}
          <Route element={<RoleRoute allow={["superadmin"]} />}>
            <Route path="/system-settings" element={<SystemSettingsPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default App;
