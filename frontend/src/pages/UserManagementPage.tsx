import { useState } from "react";
import { useAuthStore } from "../store/authStore";
import RightsDialog from "../components/RightsDialog";
import {
  canManage,
  emptyRights,
  isSuperadmin,
  type Rights,
  type Role,
} from "../lib/roles";

type ManagedUser = {
  id: number;
  name: string;
  email: string;
  role: Role;
  blocked: boolean;
  rights: Rights;
};

const withRights = (partial: Partial<Rights>): Rights => ({ ...emptyRights(), ...partial });

// Mock data: the back end has no users endpoint yet.
const initialUsers: ManagedUser[] = [
  { id: 1, name: "Maria Santos", email: "superadmin@hope.com", role: "superadmin", blocked: false, rights: emptyRights() },
  { id: 2, name: "Lisa Park", email: "admin@hope.com", role: "admin", blocked: false, rights: emptyRights() },
  { id: 3, name: "David Kim", email: "manager@hope.com", role: "admin", blocked: false, rights: emptyRights() },
  {
    id: 4,
    name: "Alex Rivera",
    email: "user@hope.com",
    role: "user",
    blocked: false,
    rights: withRights({
      customers: { enabled: true, actions: ["view", "create"] },
      sales: { enabled: true, actions: ["view"] },
    }),
  },
  { id: 5, name: "Jamie Cruz", email: "jamie@hope.com", role: "user", blocked: true, rights: emptyRights() },
];

const roleBadge: Record<Role, string> = {
  superadmin: "bg-dark text-white",
  admin: "bg-cream text-dark",
  user: "bg-fire-light/30 text-dark",
};

const actionButton =
  "rounded-md border border-light-grey bg-white px-3 py-1 text-sm hover:bg-light-grey";

function UserManagementPage() {
  const viewerRole = useAuthStore((s) => s.user?.role) as Role | undefined;
  const [users, setUsers] = useState(initialUsers);
  const [editingRights, setEditingRights] = useState<ManagedUser | null>(null);

  // Admins never see Superadmin accounts. Superadmins see everyone.
  const visible = users.filter((u) => isSuperadmin(viewerRole) || u.role !== "superadmin");

  const toggleBlock = (id: number) =>
    setUsers((list) => list.map((u) => (u.id === id ? { ...u, blocked: !u.blocked } : u)));

  const saveRights = (rights: Rights) => {
    if (!editingRights) return;
    setUsers((list) => list.map((u) => (u.id === editingRights.id ? { ...u, rights } : u)));
    setEditingRights(null);
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
          className="flex items-center gap-2 rounded-md bg-fire px-4 py-2 text-white shadow-lg hover:bg-fire-light"
        >
          <i className="fa-solid fa-plus" aria-hidden="true" />
          Add user
        </button>
      </header>

      <div className="overflow-x-auto rounded-xl bg-paper p-2 shadow-lg">
        <table className="w-full min-w-[40rem] text-left">
          <thead className="text-sm text-dark-grey">
            <tr>
              <th scope="col" className="px-4 py-3 font-semibold">Name</th>
              <th scope="col" className="px-4 py-3 font-semibold">Email</th>
              <th scope="col" className="px-4 py-3 font-semibold">Role</th>
              <th scope="col" className="px-4 py-3 font-semibold">Status</th>
              <th scope="col" className="px-4 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((u) => {
              const manageable = canManage(viewerRole, u.role);
              return (
                <tr key={u.id} className="border-t border-light-grey">
                  <th scope="row" className="px-4 py-3 font-semibold">{u.name}</th>
                  <td className="px-4 py-3">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-3 py-0.5 text-xs font-bold capitalize ${roleBadge[u.role]}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-3 py-0.5 text-xs font-bold ${
                        u.blocked ? "bg-red-300 text-red-800" : "bg-green-300 text-green-800"
                      }`}
                    >
                      {u.blocked ? "Blocked" : "Active"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {manageable ? (
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => toggleBlock(u.id)} className={actionButton}>
                          {u.blocked ? "Unblock" : "Block"}
                        </button>
                        <button type="button" onClick={() => setEditingRights(u)} className={actionButton}>
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
      </div>

      {editingRights && (
        <RightsDialog
          personName={editingRights.name}
          initialRights={editingRights.rights}
          onSave={saveRights}
          onClose={() => setEditingRights(null)}
        />
      )}
    </section>
  );
}

export default UserManagementPage;
