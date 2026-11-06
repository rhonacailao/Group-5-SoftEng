import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";

function AccountPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  if (!user) return null;

  const details = [
    { label: "First name", value: user.firstName, icon: "fa-user" },
    { label: "Last name", value: user.lastName, icon: "fa-user" },
    { label: "Email address", value: user.email, icon: "fa-envelope" },
    {
      label: "Role",
      value: user.role.charAt(0).toUpperCase() + user.role.slice(1),
      icon: "fa-id-badge",
    },
  ];

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-5xl font-bold leading-none">My account</h1>
      </header>

      <section
        aria-labelledby="profile-heading"
        className="flex flex-col gap-6 rounded-xl bg-paper p-6"
      >
        <header className="flex items-center gap-4">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-fire text-2xl font-bold text-white">
            {`${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase()}
          </span>
          <div>
            <h2 id="profile-heading" className="text-2xl font-bold">
              {user.firstName} {user.lastName}
            </h2>
            <p className="text-dark-grey">{user.email}</p>
          </div>
        </header>

        {user.id === 0 && (
          <p className="text-sm text-dark-grey">
            You are signed in with the demo account.
          </p>
        )}

        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {details.map(({ label, value, icon }) => (
            <div key={label} className="rounded-lg bg-cream p-4">
              <dt className="flex items-center gap-2 text-sm font-semibold text-dark-grey">
                <i
                  className={`fa-solid ${icon} fa-fw text-fire`}
                  aria-hidden="true"
                />
                {label}
              </dt>
              <dd className="mt-1 text-lg font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section
        aria-labelledby="security-heading"
        className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-paper p-6"
      >
        <div>
          <h2 id="security-heading" className="text-2xl font-bold">
            Security
          </h2>
          <p className="text-sm text-dark-grey">
            Need a new password? We will email you a reset link.
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            to="/forgot-password"
            className="px-4 py-2 bg-fire text-white rounded-md shadow-lg hover:bg-fire-light"
          >
            Change password
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="px-4 py-2 bg-white text-dark rounded-md shadow-lg border border-light-grey hover:bg-light-grey"
          >
            Log out
          </button>
        </div>
      </section>
    </div>
  );
}

export default AccountPage;
