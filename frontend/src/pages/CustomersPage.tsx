import { useCallback, useEffect, useState } from "react";
import { useAuthStore } from "../store/authStore";
import { api, ApiError, errorMessage } from "../lib/api";
import CustomerDialog, { type CustomerValues } from "../components/CustomerDialog";
import { payTermLabels, type PayTerm } from "../lib/payTerms";

// One row as the back end sends it (GET /api/customers).
type ApiCustomer = {
  custNo: string;
  custName: string;
  address: string;
  payTerm: PayTerm;
  status: "Active" | "Inactive";
};

type Tab = "active" | "inactive" | "all";
type Counts = Record<Tab, number>;

type ListResponse = {
  ok: true;
  customers: ApiCustomer[];
  total: number;
  counts: Counts;
  page: number;
  pageSize: number;
};

type MenuResponse = { ok: true; tiles: { code: string; rights: string[] }[] };

type DialogState = { mode: "add"; custNo: string } | { mode: "edit"; customer: ApiCustomer } | null;

const PAGE_SIZE = 20;
const DEMO_USER_ID = 0; // the offline demo account has no server session (see authStore.ts)

const actionButton =
  "rounded-md border border-light-grey bg-white px-3 py-1 text-sm hover:bg-light-grey disabled:opacity-60";

const tabs: { id: Tab; label: string }[] = [
  { id: "active", label: "Active" },
  { id: "inactive", label: "Inactive" },
  { id: "all", label: "All" },
];

// First error the server found, field messages first (e.g. "Customer name is required.")
const saveMessage = (err: unknown) => {
  if (err instanceof ApiError && err.errors) {
    const first = Object.values(err.errors)[0];
    if (first) return first;
  }
  return errorMessage(err);
};

function CustomersPage() {
  const user = useAuthStore((s) => s.user);
  const isDemo = user?.id === DEMO_USER_ID;

  // What this person may do comes from the Rights dialog, through GET /api/menu.
  // The server checks every request again, so hiding a button is only a convenience.
  const [rights, setRights] = useState<string[]>([]);
  const canAdd = rights.includes("CUSTOMER_ADD");
  const canEdit = rights.includes("CUSTOMER_EDIT");
  const canDelete = rights.includes("CUSTOMER_DELETE"); // Delete right = delete AND restore

  const [data, setData] = useState<ListResponse | null>(null);
  const [tab, setTab] = useState<Tab>("active");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  // Two kinds of message, so a reload of the list can never wipe out why an action was refused:
  //   actionError = a delete / restore / add was refused (stays until the next action)
  //   listError   = the list itself could not be loaded (clears when a load works)
  const [actionError, setActionError] = useState("");
  const [listError, setListError] = useState("");
  const error = actionError || listError;
  const [busyNo, setBusyNo] = useState<string | null>(null); // customer whose delete/restore is running
  const [dialog, setDialog] = useState<DialogState>(null);
  const [dialogError, setDialogError] = useState("");
  const [saving, setSaving] = useState(false);

  // Rights, once
  useEffect(() => {
    if (isDemo) return;
    api<MenuResponse>("/api/menu")
      .then((menu) => setRights(menu.tiles.find((t) => t.code === "CUSTOMER")?.rights ?? []))
      .catch((err) => setActionError(errorMessage(err)));
  }, [isDemo]);

  // The list: asks the server again whenever the tab, the search, the page or reloadKey changes.
  // Typing in the search box waits a moment so we do not send a request for every key.
  useEffect(() => {
    if (isDemo) return;
    let stale = false;
    const params = new URLSearchParams({ status: tab, page: String(page), pageSize: String(PAGE_SIZE) });
    if (query.trim()) params.set("search", query.trim());
    const timer = setTimeout(
      () => {
        api<ListResponse>(`/api/customers?${params}`)
          .then((res) => {
            if (stale) return;
            setData(res);
            setListError("");
          })
          .catch((err) => {
            if (!stale) setListError(errorMessage(err));
          });
      },
      query ? 300 : 0,
    );
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [isDemo, tab, query, page, reloadKey]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  // ---------- soft delete and restore (S2-DEV-03) ----------
  // DELETE /api/customers/:custNo   and   PATCH /api/customers/:custNo/restore
  // The server refuses a delete while the customer still has sales; its message shows in the banner.
  const softDelete = async (c: ApiCustomer) => {
    const ok = window.confirm(
      `Delete ${c.custName} (${c.custNo})?\n\nIt will be marked Inactive and can be restored later.`,
    );
    if (!ok) return;
    setBusyNo(c.custNo);
    setActionError("");
    try {
      await api(`/api/customers/${c.custNo}`, { method: "DELETE" });
      // Deleted the last row of the last page: step back so the page is not empty
      if (data && data.customers.length === 1 && page > 1 && tab !== "all") setPage(page - 1);
      else reload();
    } catch (err) {
      setActionError(errorMessage(err));
      reload(); // someone else may have changed it: show what is really there
    } finally {
      setBusyNo(null);
    }
  };

  const restore = async (c: ApiCustomer) => {
    setBusyNo(c.custNo);
    setActionError("");
    try {
      await api(`/api/customers/${c.custNo}/restore`, { method: "PATCH" });
      if (data && data.customers.length === 1 && page > 1 && tab !== "all") setPage(page - 1);
      else reload();
    } catch (err) {
      setActionError(errorMessage(err));
      reload();
    } finally {
      setBusyNo(null);
    }
  };

  // ---------- add and edit (S2-DEV-02 API) ----------
  const openAdd = async () => {
    try {
      const next = await api<{ ok: true; custNo: string }>("/api/customers/next-number");
      setDialogError("");
      setDialog({ mode: "add", custNo: next.custNo });
    } catch (err) {
      setActionError(errorMessage(err));
    }
  };

  const save = async (values: CustomerValues) => {
    if (!dialog || saving) return;
    const body = { custName: values.custname, address: values.address, payTerm: values.payterm };
    setSaving(true);
    try {
      if (dialog.mode === "edit") {
        await api(`/api/customers/${dialog.customer.custNo}`, { method: "PATCH", body });
      } else {
        await api("/api/customers", { method: "POST", body });
      }
      setDialog(null);
      setActionError("");
      reload();
    } catch (err) {
      setDialogError(saveMessage(err)); // the dialog stays open so nothing typed is lost
    } finally {
      setSaving(false);
    }
  };

  // Users with the Delete right can open the Inactive and All tabs; everyone else sees Active only.
  const showTabs = canDelete;
  const counts = data?.counts;
  const rows = data?.customers ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const colCount = canDelete ? 6 : 5;
  const loading = !isDemo && data === null && !error;

  const description = canDelete
    ? "Add, edit, delete and restore customers. Deleted customers stay here as Inactive."
    : "Search, add and edit customers.";

  return (
    <section aria-labelledby="customers-title" className="flex flex-col gap-6">
      <header>
        <h1 id="customers-title" className="text-5xl font-bold leading-none">
          Customers
        </h1>
        <p className="mt-3 text-sm text-dark-grey">{description}</p>
      </header>

      {isDemo && (
        <p role="alert" className="rounded-md bg-red-200 px-4 py-2 text-red-800">
          You are using the demo account, which is not connected to the server. Log in with a real account to
          see and manage customers.
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-md bg-red-200 px-4 py-2 text-red-800">
          {error}
        </p>
      )}

      {/*----------Toolbar: status tabs, search, add----------*/}
      <div className="flex flex-wrap items-center justify-between gap-4">
        {showTabs ? (
          <div role="tablist" aria-label="Customer status" className="flex gap-2">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => {
                  setTab(t.id);
                  setPage(1);
                }}
                className={`rounded-md px-4 py-1.5 text-sm font-semibold ${
                  tab === t.id
                    ? "bg-fire text-white shadow-lg"
                    : "border border-light-grey bg-white hover:bg-light-grey"
                }`}
              >
                {t.label}
                {counts ? ` (${counts[t.id]})` : ""}
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
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search customers..."
              aria-label="Search customers"
              className="w-64 rounded-md border border-dark-grey bg-white py-2 pl-9 pr-3 shadow-lg placeholder:text-dark-grey focus:outline-none focus:ring-2 focus:ring-fire-light"
            />
          </div>
          {canAdd && (
            <button
              type="button"
              onClick={openAdd}
              className="flex items-center gap-2 rounded-md bg-fire px-4 py-2 text-white shadow-lg hover:bg-fire-light"
            >
              <i className="fa-solid fa-plus" aria-hidden="true" />
              Add customer
            </button>
          )}
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
              {canDelete && <th scope="col" className="px-4 py-3 font-semibold">Status</th>}
              <th scope="col" className="px-4 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr className="border-t border-light-grey">
                <td colSpan={colCount} className="px-4 py-8 text-center text-dark-grey">
                  Loading customers...
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr className="border-t border-light-grey">
                <td colSpan={colCount} className="px-4 py-8 text-center text-dark-grey">
                  No customers found.
                </td>
              </tr>
            )}
            {rows.map((c) => {
              const deleted = c.status === "Inactive";
              return (
                <tr
                  key={c.custNo}
                  // Shaded row: a soft-deleted customer
                  className={`border-t border-light-grey ${deleted ? "bg-cream" : ""}`}
                >
                  <td className="px-4 py-3 font-semibold">{c.custNo}</td>
                  <td className="px-4 py-3">{c.custName}</td>
                  <td className="px-4 py-3">{c.address}</td>
                  <td className="px-4 py-3">{payTermLabels[c.payTerm]}</td>
                  {canDelete && (
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                          deleted
                            ? "border-red-900 bg-red-300 text-red-800"
                            : "border-green-900 bg-green-300 text-green-800"
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {deleted ? (
                        canDelete && (
                          <button
                            type="button"
                            onClick={() => restore(c)}
                            disabled={busyNo === c.custNo}
                            aria-label={`Restore ${c.custName}`}
                            className={actionButton}
                          >
                            Restore
                          </button>
                        )
                      ) : (
                        <>
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => {
                                setDialogError("");
                                setDialog({ mode: "edit", customer: c });
                              }}
                              aria-label={`Edit ${c.custName}`}
                              className={actionButton}
                            >
                              Edit
                            </button>
                          )}
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => softDelete(c)}
                              disabled={busyNo === c.custNo}
                              aria-label={`Delete ${c.custName}`}
                              className={actionButton}
                            >
                              Delete
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/*----------Paging----------*/}
      {total > PAGE_SIZE && (
        <nav aria-label="Pagination" className="flex items-center justify-between px-2 text-sm text-dark-grey">
          <span>
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(total, page * PAGE_SIZE)} of {total}
          </span>
          <div className="flex items-center gap-2">
            <button type="button" className={actionButton} disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Previous
            </button>
            <span>
              Page {page} of {pageCount}
            </span>
            <button
              type="button"
              className={actionButton}
              disabled={page >= pageCount}
              onClick={() => setPage(page + 1)}
            >
              Next
            </button>
          </div>
        </nav>
      )}

      {dialog && (
        <CustomerDialog
          custno={dialog.mode === "edit" ? dialog.customer.custNo : dialog.custNo}
          initial={
            dialog.mode === "edit"
              ? {
                  custname: dialog.customer.custName,
                  address: dialog.customer.address,
                  payterm: dialog.customer.payTerm,
                }
              : undefined
          }
          error={dialogError}
          busy={saving}
          onSave={save}
          onClose={() => setDialog(null)}
        />
      )}
    </section>
  );
}

export default CustomersPage;
