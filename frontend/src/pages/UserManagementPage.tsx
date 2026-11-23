import { useCallback, useEffect, useState } from "react";
import { useAuthStore } from "../store/authStore";
import RightsDialog from "../components/RightsDialog";
import Card from "../components/Card";
import Badge, { type BadgeVariant } from "../components/Badge";
import { api, errorMessage } from "../lib/api";
import { canManage, isSuperadmin, type Role } from "../lib/roles";

// One row as the back end sends it (GET /api/users).
type ApiUser = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
  status: "Pending" | "Active" | "Inactive" | "Rejected";
  isBlocked: boolean;
  awaitingApproval: boolean;
};

type ManagedUser = {
  id: number;
  name: string;
  email: string;
  role: Role;
  status: ApiUser["status"];
  blocked: boolean;
  awaitingApproval: boolean;
};

const toManaged = (u: ApiUser): ManagedUser => ({
  id: u.id,
  name: `${u.firstName} ${u.lastName}`.trim(),
  email: u.email,
  role: u.role,
  status: u.status,
  blocked: u.isBlocked,
  awaitingApproval: u.awaitingApproval,
});

const roleVariant: Record<Role, BadgeVariant> = {
  superadmin: "dark",
  admin: "neutral",
  user: "accent",
};

const actionButton =
  "rounded-md border border-light-grey bg-white px-3 py-1 text-sm transition-colors duration-200 ease-in-out hover:bg-light-grey";

function UserManagementPage() {
  const viewerRole = useAuthStore((s) => s.user?.role) as Role | undefined;
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editingRights, setEditingRights] = useState<ManagedUser | null>(null);

  // Ask the back end for the list. Admins never receive Superadmin rows from the server.
  const load = useCallback(async () => {
    try {
      const data = await api<{ ok: true; users: ApiUser[] }>(
        "/api/users?pageSize=100",
      );
      setUsers(data.users.map(toManaged));
      setError("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  // First load: same request as load(), written as a promise chain so the page state is only
  // set after the answer arrives (the lint rule does not allow setState straight in an effect).
  useEffect(() => {
    api<{ ok: true; users: ApiUser[] }>("/api/users?pageSize=100")
      .then((data) => setUsers(data.users.map(toManaged)))
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  // Admins never see Superadmin accounts. Superadmins see everyone.
  const visible = users.filter(
    (u) => isSuperadmin(viewerRole) || u.role !== "superadmin",
  );

  // Real calls: PATCH /api/users/:id/block or /unblock, then reload the list.
  const toggleBlock = async (u: ManagedUser) => {
    try {
      await api(`/api/users/${u.id}/${u.blocked ? "unblock" : "block"}`, {
        method: "PATCH",
      });
      await load();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  // Superadmin only: PATCH /api/users/:id/approve (the person gets an email to set a password).
  const approve = async (u: ManagedUser) => {
    try {
      await api(`/api/users/${u.id}/approve`, { method: "PATCH" });
      await load();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  // Superadmin only: PATCH /api/users/:id/role. The back end saves it in the database (and the audit
  // log) and refuses people who are not Active yet, so those errors show in the red banner.
  const changeRole = async (u: ManagedUser, role: "admin" | "user") => {
    const label = role === "admin" ? "an Admin" : "a plain User";
    if (!window.confirm(`Make ${u.name} ${label}?`)) return;
    try {
      await api(`/api/users/${u.id}/role`, { method: "PATCH", body: { role } });
      await load();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  // The dialog already saved the rights on the server (PUT /api/users/:id/rights)
  const rightsSaved = () => {
    const name = editingRights?.name ?? "the user";
    setEditingRights(null);
    setNotice(`Saved the rights of ${name}. They apply on their next click.`);
  };

  const description = isSuperadmin(viewerRole)
    ? "Superadmin: manage Users and Admins. Other Superadmin accounts cannot be modified."
    : "Admin: manage Users only. Superadmin accounts are hidden and cannot be modified.";

  return (
    <section aria-labelledby="um-title" className="p-8">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 id="um-title" className="text-3xl font-bold">
            User Management
          </h1>
          <p className="mt-1 text-sm text-dark-grey">{description}</p>
        </div>
        <button
          type="button"
          className="flex items-center gap-2 rounded-md bg-fire px-4 py-2 text-white shadow-lg transition-colors duration-200 ease-in-out hover:bg-fire-light"
        >
          <i className="fa-solid fa-plus" aria-hidden="true" />
          Add user
        </button>
      </header>

      {error && (
        <p
          role="alert"
          className="mb-4 rounded-md bg-red-200 px-4 py-2 text-red-800"
        >
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="mb-4 rounded-md bg-green-200 px-4 py-2 text-green-800">
          {notice}
        </p>
      )}
      {loading && <p className="mb-4 text-dark-grey">Loading users...</p>}

      <Card className="overflow-x-auto p-2">
        <table className="w-full min-w-[40rem] text-left">
          <thead className="text-sm text-dark-grey">
            <tr>
              <th scope="col" className="px-4 py-3 font-semibold">
                Name
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                Email
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                Role
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                Status
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((u) => {
              const manageable = canManage(viewerRole, u.role);
              return (
                <tr key={u.id} className="border-t border-light-grey">
                  <th scope="row" className="px-4 py-3 font-semibold">
                    {u.name}
                  </th>
                  <td className="px-4 py-3">{u.email}</td>
                  <td className="px-4 py-3">
                    <Badge variant={roleVariant[u.role]} className="capitalize">
                      {u.role}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={
                        u.blocked
                          ? "danger"
                          : u.status === "Active"
                            ? "success"
                            : "warning"
                      }
                    >
                      {u.blocked
                        ? "Blocked"
                        : u.awaitingApproval
                          ? "Awaiting approval"
                          : u.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    {manageable ? (
                      <div className="flex flex-wrap gap-2">
                        {u.awaitingApproval && isSuperadmin(viewerRole) && (
                          <button
                            type="button"
                            onClick={() => approve(u)}
                            className={actionButton}
                          >
                            Approve
                          </button>
                        )}
                        {isSuperadmin(viewerRole) &&
                          u.status === "Active" &&
                          !u.awaitingApproval &&
                          (u.role === "user" || u.role === "admin") && (
                            <button
                              type="button"
                              onClick={() =>
                                changeRole(
                                  u,
                                  u.role === "user" ? "admin" : "user",
                                )
                              }
                              className={actionButton}
                            >
                              {u.role === "user" ? "Make admin" : "Make user"}
                            </button>
                          )}
                        <button
                          type="button"
                          onClick={() => toggleBlock(u)}
                          className={actionButton}
                        >
                          {u.blocked ? "Unblock" : "Block"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setNotice("");
                            setEditingRights(u);
                          }}
                          className={actionButton}
                        >
                          Rights
                        </button>
                        <button type="button" className={actionButton}>
                          Edit
                        </button>
                      </div>
                    ) : (
                      <span aria-label="No actions available">&mdash;</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {editingRights && (
        <RightsDialog
          userId={editingRights.id}
          personName={editingRights.name}
          onSaved={rightsSaved}
          onClose={() => setEditingRights(null)}
        />
      )}
    </section>
  );
}

export default UserManagementPage;
