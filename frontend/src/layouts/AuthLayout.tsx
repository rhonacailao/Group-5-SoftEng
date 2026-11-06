import { Outlet } from "react-router-dom";
import Navbar from "../components/Navbar";

/** Top navbar + page. Used by log in, register and password pages. */
function AuthLayout() {
  return (
    <>
      <Navbar />
      <main>
        <Outlet />
      </main>
    </>
  );
}

export default AuthLayout;
