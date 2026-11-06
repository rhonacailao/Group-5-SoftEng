import { useMemo, useState } from "react";
import { useAuthStore } from "../store/authStore";
import { isAdminOrAbove, type Role } from "../lib/roles";
import CustomerDialog, {
  payTermLabels,
  type CustomerValues,
  type PayTerm,
} from "../components/CustomerDialog";

type Customer = {
  custno: string;
  custname: string;
  address: string;
  payterm: PayTerm;
  isDeleted: boolean;
  /** e.g. "EDIT user1 2026-10-12 11:18 AM" (built by the system, like the database trigger) */
  stamp: string;
};

type Tab = "active" | "inactive" | "all";

// Mock data taken from the Hope, Inc. database. The back end has no customers endpoint yet.
const seed = (
  custno: string,
  custname: string,
  address: string,
  payterm: PayTerm,
  isDeleted = false,
): Customer => ({
  custno,
  custname,
  address,
  payterm,
  isDeleted,
  stamp: `${isDeleted ? "DELETE" : "ADD"} admin 2026-10-12 11:18 AM`,
});

const initialCustomers: Customer[] = [
  seed("C0001", "Globus Medical, Inc", "2560 Gen Armistead Ave Audubon CA 94031", "30D"),
  seed("C0002", "RF Industries, Inc", "7610 Miramar Rd San Diego, CA 92602", "45D"),
  seed("C0003", "Trisha Macdowell", "7642 Clairemont Mesa Blvd San Diego CA 90321", "COD"),
  seed("C0004", "HMS Holdings, Inc", "1000 So Fremont Ave, Suite 225 Alhambara CA 91303", "45D", true),
  seed("C0005", "Christian Andersen", "1120 Lincoln St Suite 809 Sacramento CA 95815", "COD"),
  seed("C0006", "Astronics, Inc", "2 Orion Aliso Viejo, CA 92656", "30D"),
  seed("C0007", "Morgan Alegore", "2 Goodyear Irvine, CA 92618", "COD"),
  seed("C0008", "Abaxis, Inc", "3240 Whipple Rd, Union City, CA 94587", "30D"),
  seed("C0009", "Landec Corp.", "3603 Haven Avenue Menlo Park, CA 94025", "30D"),
  seed("C0010", "SMP Corp.", "3718 Northern Long Island NY 12528", "45D"),
];

/** Same look as the database stamp: "EDIT user1 2026-10-12 11:18 AM" */
function makeStamp(action: "ADD" | "EDIT" | "DELETE" | "RESTORE", who: string) {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const h = d.getHours() % 12 || 12;
  const ampm = d.getHours() < 12 ? "AM" : "PM";
  return `${action} ${who} ${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(h)}:${pad(d.getMinutes())} ${ampm}`;
}

const nextCustno = (list: Customer[]) => {
  const max = list.reduce((m, c) => Math.max(m, Number(c.custno.slice(1))), 0);
  return `C${String(max + 1).padStart(4, "0")}`;
};

const actionButton =
  "rounded-md border border-light-grey bg-white px-3 py-1 text-sm hover:bg-light-grey";

type DialogState = { mode: "add" } | { mode: "edit"; customer: Customer } | null;

function CustomersPage() {
  const user = useAuthStore((s) => s.user);
  const role = user?.role as Role | undefined;
  const isAdmin = isAdminOrAbove(role);
  const who = user?.email.split("@")[0] ?? "user";

  const [customers, setCustomers] = useState(initialCustomers);
  const [tab, setTab] = useState<Tab>("active");
  const [query, setQuery] = useState("");
  const [dialog, setDialog] = useState<DialogState>(null);

  const counts = useMemo(
    () => ({
      active: customers.filter((c) => !c.isDeleted).length,
      inactive: customers.filter((c) => c.isDeleted).length,
      all: customers.length,
    }),
    [customers],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return customers
      // Users only ever see active customers. Admins pick with the tabs.
      .filter((c) => {
        if (!isAdmin) return !c.isDeleted;
        if (tab === "active") return !c.isDeleted;
        if (tab === "inactive") return c.isDeleted;
        return true;
      })
      .filter(
        (c) =>
          !q ||
          c.custno.toLowerCase().includes(q) ||
          c.custname.toLowerCase().includes(q) ||
          c.address.toLowerCase().includes(q),
      );
  }, [customers, tab, query, isAdmin]);

  const update = (custno: string, patch: Partial<Customer>) =>
    setCustomers((list) => list.map((c) => (c.custno === custno ? { ...c, ...patch } : c)));

  const softDelete = (c: Customer) =>
    update(c.custno, { isDeleted: true, stamp: makeStamp("DELETE", who) });
  const restore = (c: Customer) =>
    update(c.custno, { isDeleted: false, stamp: makeStamp("RESTORE", who) });

  const save = (values: CustomerValues) => {
    if (dialog?.mode === "edit") {
      update(dialog.customer.custno, { ...values, stamp: makeStamp("EDIT", who) });
    } else {
      setCustomers((list) => [
        ...list,
        { custno: nextCustno(list), ...values, isDeleted: false, stamp: makeStamp("ADD", who) },
      ]);
    }
    setDialog(null);
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: "active", label: "Active" },
    { id: "inactive", label: "Inactive" },
    { id: "all", label: "All" },
  ];

  const colCount = isAdmin ? 7 : 5;

  return (
    <section aria-labelledby="customers-title" className="flex flex-col gap-6">
      <header>
        <h1 id="customers-title" className="text-5xl font-bold leading-none">
          Customers
        </h1>
        <p className="mt-3 text-sm text-dark-grey">
          {isAdmin
            ? "Add, edit, delete and restore customers. Deleted customers stay here as Inactive."
            : "Search, add and edit customers."}
        </p>
      </header>

      {/*----------Toolbar: status tabs, search, add----------*/}
      <div className="flex flex-wrap items-center justify-between gap-4">
        {isAdmin ? (
          <div role="tablist" aria-label="Customer status" className="flex gap-2">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={`rounded-md px-4 py-1.5 text-sm font-semibold ${
                  tab === t.id
                    ? "bg-fire text-white shadow-lg"
                    : "border border-light-grey bg-white hover:bg-light-grey"
                }`}
              >
                {t.label} ({counts[t.id]})
              </button>
            ))}
          </div>
        ) : (
          <span />
        )}

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <i
              className="fa-solid fa-magnifying-glass pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-dark-grey"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search customers..."
              aria-label="Search customers"
              className="w-64 rounded-md border border-dark-grey bg-white py-2 pl-9 pr-3 shadow-lg placeholder:text-dark-grey focus:outline-none focus:ring-2 focus:ring-fire-light"
            />
          </div>
          <button
            type="button"
            onClick={() => setDialog({ mode: "add" })}
            className="flex items-center gap-2 rounded-md bg-fire px-4 py-2 text-white shadow-lg hover:bg-fire-light"
          >
            <i className="fa-solid fa-plus" aria-hidden="true" />
            Add customer
          </button>
        </div>
      </div>

      {/*----------Table----------*/}
      <div className="overflow-x-auto rounded-xl bg-paper p-2 shadow-lg">
        <table className="w-full min-w-[48rem] text-left">
          <caption className="sr-only">Customers</caption>
          <thead className="text-sm text-dark-grey">
            <tr>
              <th scope="col" className="px-4 py-3 font-semibold">Cust no</th>
              <th scope="col" className="px-4 py-3 font-semibold">Customer name</th>
              <th scope="col" className="px-4 py-3 font-semibold">Address</th>
              <th scope="col" className="px-4 py-3 font-semibold">Pay terms</th>
              {isAdmin && (
                <>
                  <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Stamp</th>
                </>
              )}
              <th scope="col" className="px-4 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr className="border-t border-light-grey">
                <td colSpan={colCount} className="px-4 py-8 text-center text-dark-grey">
                  No customers found.
                </td>
              </tr>
            )}
            {visible.map((c) => (
              <tr
                key={c.custno}
                // Shaded row: a soft-deleted record that only Admins can see
                className={`border-t border-light-grey ${c.isDeleted ? "bg-cream" : ""}`}
              >
                <td className="px-4 py-3 font-semibold">{c.custno}</td>
                <td className="px-4 py-3">{c.custname}</td>
                <td className="px-4 py-3">{c.address}</td>
                <td className="px-4 py-3">{payTermLabels[c.payterm]}</td>
                {isAdmin && (
                  <>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                          c.isDeleted
                            ? "border-red-900 bg-red-300 text-red-800"
                            : "border-green-900 bg-green-300 text-green-800"
                        }`}
                      >
                        {c.isDeleted ? "Inactive" : "Active"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-dark-grey">{c.stamp}</td>
                  </>
                )}
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    {c.isDeleted ? (
                      <button type="button" onClick={() => restore(c)} className={actionButton}>
                        Restore
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => setDialog({ mode: "edit", customer: c })}
                          className={actionButton}
                        >
                          Edit
                        </button>
                        <button type="button" onClick={() => softDelete(c)} className={actionButton}>
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {dialog && (
        <CustomerDialog
          custno={dialog.mode === "edit" ? dialog.customer.custno : nextCustno(customers)}
          initial={
            dialog.mode === "edit"
              ? {
                  custname: dialog.customer.custname,
                  address: dialog.customer.address,
                  payterm: dialog.customer.payterm,
                }
              : undefined
          }
          onSave={save}
          onClose={() => setDialog(null)}
        />
      )}
    </section>
  );
}

export default CustomersPage;
