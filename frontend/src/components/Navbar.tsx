import { Link, NavLink } from "react-router-dom";

function Navbar() {
  return (
    <header className="w-full bg-dark text-white shadow">
      <nav
        aria-label="Main navigation"
        className="mx-auto flex max-w-7xl items-center justify-between p-8"
      >
        <Link to="/" className="font-bold" aria-label="Hope ERP home">
          {/*to be replaced with logo next time*/}
          <span className="text-2xl font-semibold">
            Hope <span className="text-fire">ERP</span>
          </span>
        </Link>

        <ul className="flex items-center gap-6">
          <li>
            <a href="/products" className="hover:underline">
              Products
            </a>
          </li>
          <li>
            <a href="/industries" className="hover:underline">
              Industries
            </a>
          </li>
          <li>
            <a href="/pricing" className="hover:underline">
              Pricing
            </a>
          </li>
          <li>
            <NavLink
              to="/register"
              className="px-4 py-1 bg-fire text-white rounded-md shadow-lg hover:bg-fire-light"
            >
              Try for free
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/login"
              className="px-4 py-1 bg-white text-dark rounded-md shadow-lg border border-light-grey hover:bg-light-grey"
            >
              Log in
            </NavLink>
          </li>
        </ul>
      </nav>
    </header>
  );
}

export default Navbar;
