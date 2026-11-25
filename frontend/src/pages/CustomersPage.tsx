import { useCallback, useEffect, useRef, useState } from "react";
import { useAuthStore } from "../store/authStore";
import { api, ApiError, errorMessage } from "../lib/api";
import ConfirmDialog from "../components/ConfirmDialog";
import CustomerDialog, {
  type CustomerValues,
} from "../components/CustomerDialog";
import EmptyState from "../components/EmptyState";
import ErrorBanner from "../components/ErrorBanner";
import Card from "../components/Card";
import Badge from "../components/Badge";
import { describeError, type ErrorInfo } from "../lib/errorInfo";
import { payTermLabels, type PayTerm } from "../lib/payTerms";
import { useDismiss } from "../lib/useDismiss";
import {
  DEMO_CUSTOMER_RIGHTS,
  demoCreate,
  demoList,
  demoNextNumber,
  demoRemove,
  demoRestore,
  demoUpdate,
} from "../lib/demoCustomers";

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

type DialogState =
  | { mode: "add"; custNo: string }
  | { mode: "edit"; customer: ApiCustomer }
  | null;

const PAGE_SIZE = 20;
const DEMO_USER_ID = 0; // the offline demo account has no server session (see authStore.ts)

const actionButton =
  "rounded-md border border-light-grey bg-white px-3 py-1 text-sm transition-colors duration-200 ease-in-out hover:bg-light-grey disabled:opacity-60";

// Chips inside the filter dropdown (flat pills, like the inputs)
const chip = (selected: boolean) =>
  `rounded-full px-4 py-1.5 text-sm font-semibold transition-colors duration-200 ease-in-out ${
    selected ? "bg-fire text-white" : "bg-white hover:bg-light-grey"
  }`;

const payTermOptions: { id: PayTerm | ""; label: string }[] = [
  { id: "", label: "All" },
  ...(Object.keys(payTermLabels) as PayTerm[]).map((id) => ({
    id,
    label: payTermLabels[id],
  })),
];

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

  // The demo account has no server, so it runs against the sample customers in lib/demoCustomers.ts.
  // Both paths return a promise and throw the same ApiError, so the code below is the same for both.
  const run = <T,>(demo: () => T, live: () => Promise<T>): Promise<T> =>
    isDemo ? new Promise<T>((resolve) => resolve(demo())) : live();

  // What this person may do comes from the Rights dialog, through GET /api/menu.
  // The server checks every request again, so hiding a button is only a convenience.
  const [rights, setRights] = useState<string[]>([]);
  const canAdd = rights.includes("CUSTOMER_ADD");
  const canEdit = rights.includes("CUSTOMER_EDIT");
  const canDelete = rights.includes("CUSTOMER_DELETE"); // Delete right = delete AND restore

  const [data, setData] = useState<ListResponse | null>(null);
  const [tab, setTab] = useState<Tab>("active");
  const [query, setQuery] = useState("");
  const [payTerm, setPayTerm] = useState<PayTerm | "">("");
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const closeFilter = useCallback(() => setFilterOpen(false), []);
  useDismiss(filterRef, filterOpen, closeFilter);
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  // Three kinds of error, so a reload can never wipe out why an action was refused:
  //   rightsError = the rights lookup failed (stays)
  //   actionError = a restore / add was refused (stays until dismissed or the next action)
  //   listError   = the list could not be loaded (clears the next time a load works)
  const [rightsError, setRightsError] = useState<ErrorInfo | null>(null);
  const [actionError, setActionError] = useState<ErrorInfo | null>(null);
  const [listError, setListError] = useState<ErrorInfo | null>(null);
  // Confirm-delete state: the customer waiting for a yes, and what the server said when asked
  const [pendingDelete, setPendingDelete] = useState<ApiCustomer | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<ErrorInfo | null>(null);
  const [busyNo, setBusyNo] = useState<string | null>(null); // customer whose delete/restore is running
  const [dialog, setDialog] = useState<DialogState>(null);
  const [dialogError, setDialogError] = useState("");
  const [saving, setSaving] = useState(false);

  // Rights, once
  useEffect(() => {
    run(
      () => DEMO_CUSTOMER_RIGHTS,
      () =>
        api<MenuResponse>("/api/menu").then(
          (menu) => menu.tiles.find((t) => t.code === "CUSTOMER")?.rights ?? [],
        ),
    )
      .then(setRights)
      .catch((err) => setRightsError(describeError(err)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemo]);

  // The list: asks the server again whenever the tab, the search, the page or reloadKey changes.
  // Typing in the search box waits a moment so we do not send a request for every key.
  useEffect(() => {
    let stale = false;
    const params = new URLSearchParams({
      status: tab,
      page: String(page),
      pageSize: String(PAGE_SIZE),
    });
    if (query.trim()) params.set("search", query.trim());
    if (payTerm) params.set("payTerm", payTerm);
    const timer = setTimeout(
      () => {
        run<ListResponse>(
          () => demoList({ tab, query, payTerm, page, pageSize: PAGE_SIZE }),
          () => api<ListResponse>(`/api/customers?${params}`),
        )
          .then((res) => {
            if (stale) return;
            setData(res);
            setListError(null);
          })
          .catch((err) => {
            if (!stale) setListError(describeError(err));
          });
      },
      query ? 300 : 0,
    );
    return () => {
      stale = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemo, tab, query, payTerm, page, reloadKey]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  // ---------- soft delete and restore (S2-DEV-03) ----------
  // DELETE /api/customers/:custNo   and   PATCH /api/customers/:custNo/restore
  // After a row leaves the current tab, step back a page if that was the last row on it
  const refreshAfterRowChange = () => {
    if (data && data.customers.length === 1 && page > 1 && tab !== "all")
      setPage(page - 1);
    else reload();
  };

  // Delete asks first. The server refuses a delete while the customer still has sales;
  // its reason shows inside the confirm dialog, so it can be read before closing.
  const askDelete = (c: ApiCustomer) => {
    setDeleteError(null);
    setActionError(null);
    setPendingDelete(c);
  };

  const confirmDelete = async () => {
    if (!pendingDelete || deleting) return;
    const c = pendingDelete;
    setDeleting(true);
    setDeleteError(null);
    try {
      await run(
        () => demoRemove(c.custNo),
        () => api(`/api/customers/${c.custNo}`, { method: "DELETE" }),
      );
      setPendingDelete(null);
      refreshAfterRowChange();
    } catch (err) {
      setDeleteError(describeError(err));
      reload(); // someone else may have changed it: show what is really there
    } finally {
      setDeleting(false);
    }
  };

  // Restore needs no confirmation: it undoes a delete and nothing is lost
  const restore = async (c: ApiCustomer) => {
    setBusyNo(c.custNo);
    setActionError(null);
    try {
      await run(
        () => demoRestore(c.custNo),
        () => api(`/api/customers/${c.custNo}/restore`, { method: "PATCH" }),
      );
      refreshAfterRowChange();
    } catch (err) {
      setActionError(describeError(err));
      reload();
    } finally {
      setBusyNo(null);
    }
  };

  // ---------- add and edit (S2-DEV-02 API) ----------
  const openAdd = async () => {
    try {
      const next = await run(demoNextNumber, () =>
        api<{ ok: true; custNo: string }>("/api/customers/next-number"),
      );
      setDialogError("");
      setDialog({ mode: "add", custNo: next.custNo });
    } catch (err) {
      setActionError(describeError(err));
    }
  };

  const save = async (values: CustomerValues) => {
    if (!dialog || saving) return;
    const body = {
      custName: values.custname,
      address: values.address,
      payTerm: values.payterm,
    };
    setSaving(true);
    try {
      if (dialog.mode === "edit") {
        const { custNo } = dialog.customer;
        await run(
          () => demoUpdate(custNo, body),
          () => api(`/api/customers/${custNo}`, { method: "PATCH", body }),
        );
      } else {
        await run(
          () => demoCreate(body),
          () => api("/api/customers", { method: "POST", body }),
        );
      }
      setDialog(null);
      setActionError(null);
      reload();
    } catch (err) {
      setDialogError(saveMessage(err)); // the dialog stays open so nothing typed is lost
    } finally {
      setSaving(false);
    }
  };

  // Users with the Delete right can open the Inactive and All tabs; everyone else sees Active only.
  const showTabs = canDelete;
  // Filters that differ from the default view (Active, any pay terms): shown as a badge on the button
  const filterCount =
    (payTerm ? 1 : 0) + (canDelete && tab !== "active" ? 1 : 0);
  const clearFilters = () => {
    setPayTerm("");
    setTab("active");
    setPage(1);
  };
  // For the empty state: drop the search word and the pay-terms filter
  const clearSearchAndFilter = () => {
    setQuery("");
    setPayTerm("");
    setPage(1);
  };
  const counts = data?.counts;
  const rows = data?.customers ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const colCount = canDelete ? 6 : 5;
  const loading = data === null && !listError;
  const loadFailed = listError !== null && data === null;
  const filtering = query.trim() !== "" || payTerm !== "";

  return (
    <section aria-labelledby="customers-title" className="flex flex-col gap-6">
      <header>
        <h1 id="customers-title" className="text-5xl font-bold leading-none">
          Customers
        </h1>
      </header>

      {isDemo && (
        <p role="status" className="text-xs italic">
          Demo
        </p>
      )}
      {/* Error state: each message says what failed and, where it helps, how to get out */}
      {rightsError && (
        <ErrorBanner title={rightsError.title} message={rightsError.message} />
      )}
      {actionError && (
        <ErrorBanner
          title={actionError.title}
          message={actionError.message}
          onDismiss={() => setActionError(null)}
        />
      )}
      {listError && data && (
        <ErrorBanner
          title={listError.title}
          message={listError.message}
          onRetry={reload}
        />
      )}

      {/*----------Toolbar: status tabs, search, add----------*/}
      <div className="flex flex-wrap items-center justify-between gap-4">
        {showTabs ? (
          <div
            role="tablist"
            aria-label="Customer status"
            className="flex gap-2"
          >
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
                    : "border border-light-grey bg-white transition-colors duration-200 ease-in-out hover:bg-light-grey"
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
          {/*----------Filter dropdown: pay terms and status----------*/}
          <div ref={filterRef} className="relative">
            <button
              type="button"
              onClick={() => setFilterOpen((o) => !o)}
              aria-expanded={filterOpen}
              aria-controls="customer-filter-panel"
              aria-label="Filter customers"
              className="relative flex h-10 w-10 items-center justify-center rounded-full bg-[#e0d3ca] transition-colors duration-200 ease-in-out hover:bg-light-grey focus:outline-none focus-visible:ring-2 focus-visible:ring-fire-light"
            >
              <i
                className="fa-solid fa-filter text-dark-grey"
                aria-hidden="true"
              />
              {filterCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-fire px-1 text-xs font-bold text-white">
                  {filterCount}
                  <span className="sr-only"> active filters</span>
                </span>
              )}
            </button>

            {filterOpen && (
              <Card
                id="customer-filter-panel"
                role="group"
                aria-label="Filter customers"
                className="absolute left-0 z-30 mt-2 flex w-72 flex-col gap-4 p-4"
              >
                <fieldset>
                  <legend className="mb-2 text-sm font-semibold text-dark-grey">
                    Pay terms
                  </legend>
                  <div className="flex flex-wrap gap-2">
                    {payTermOptions.map((o) => (
                      <button
                        key={o.id || "all"}
                        type="button"
                        aria-pressed={payTerm === o.id}
                        onClick={() => {
                          setPayTerm(o.id);
                          setPage(1);
                        }}
                        className={chip(payTerm === o.id)}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </fieldset>

                {/* Only people with the Delete right can see deleted customers (same rule as the tabs) */}
                {canDelete && (
                  <fieldset>
                    <legend className="mb-2 text-sm font-semibold text-dark-grey">
                      Status
                    </legend>
                    <div className="flex flex-wrap gap-2">
                      {tabs.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          aria-pressed={tab === t.id}
                          onClick={() => {
                            setTab(t.id);
                            setPage(1);
                          }}
                          className={chip(tab === t.id)}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                )}

                <button
                  type="button"
                  onClick={clearFilters}
                  disabled={filterCount === 0}
                  className="self-end rounded-full px-3 py-1 text-sm font-semibold text-dark-grey transition-colors duration-200 ease-in-out hover:text-dark disabled:opacity-40"
                >
                  Clear filters
                </button>
              </Card>
            )}
          </div>
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
              className="w-64 rounded-full bg-[#e0d3ca] py-2 pl-9 pr-3 placeholder:text-dark-grey focus:outline-none focus:ring-2 focus:ring-fire-light"
            />
          </div>
          {canAdd && (
            <button
              type="button"
              onClick={openAdd}
              className="flex items-center gap-2 rounded-md bg-fire px-4 py-2 text-white shadow-lg transition-colors duration-200 ease-in-out hover:bg-fire-light"
            >
              <i className="fa-solid fa-plus" aria-hidden="true" />
              Add customer
            </button>
          )}
        </div>
      </div>

      {/*----------Table----------*/}
      <Card className="overflow-x-auto p-2">
        <table className="w-full min-w-[48rem] text-left">
          <caption className="sr-only">Customers</caption>
          <thead className="text-sm text-dark-grey">
            <tr>
              <th scope="col" className="px-4 py-3 font-semibold">
                Cust no
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                Customer name
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                Address
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                Pay terms
              </th>
              {canDelete && (
                <th scope="col" className="px-4 py-3 font-semibold">
                  Status
                </th>
              )}
              <th scope="col" className="px-4 py-3 font-semibold">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr className="border-t border-light-grey">
                <td
                  colSpan={colCount}
                  className="px-4 py-8 text-center text-dark-grey"
                >
                  Loading customers...
                </td>
              </tr>
            )}
            {/* Error state, first load: the table itself explains and offers a retry */}
            {loadFailed && (
              <tr className="border-t border-light-grey">
                <td colSpan={colCount}>
                  <EmptyState
                    icon="fa-triangle-exclamation"
                    title="Couldn't load the customers"
                    action={
                      <button
                        type="button"
                        onClick={reload}
                        className={actionButton}
                      >
                        Try again
                      </button>
                    }
                  >
                    {listError.message}
                  </EmptyState>
                </td>
              </tr>
            )}
            {/* Empty state: three different reasons, three different messages */}
            {!loading && !loadFailed && rows.length === 0 && (
              <tr className="border-t border-light-grey">
                <td colSpan={colCount}>
                  {filtering ? (
                    <EmptyState
                      icon="fa-magnifying-glass"
                      title="No customers match your search"
                      action={
                        <button
                          type="button"
                          onClick={clearSearchAndFilter}
                          className={actionButton}
                        >
                          Clear search and filter
                        </button>
                      }
                    >
                      Try a different word, or clear the search and the pay
                      terms filter.
                    </EmptyState>
                  ) : canDelete && tab === "inactive" ? (
                    <EmptyState
                      icon="fa-trash-can"
                      title="No deleted customers"
                    >
                      Customers you delete appear here, and can be restored.
                    </EmptyState>
                  ) : (
                    <EmptyState
                      title="No customers yet"
                      action={
                        canAdd ? (
                          <button
                            type="button"
                            onClick={openAdd}
                            className={actionButton}
                          >
                            Add the first customer
                          </button>
                        ) : undefined
                      }
                    >
                      {canAdd
                        ? "Add a customer to get started."
                        : "There are no customers to show."}
                    </EmptyState>
                  )}
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
                      <Badge variant={deleted ? "danger" : "success"}>
                        {c.status}
                      </Badge>
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
                              onClick={() => askDelete(c)}
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
      </Card>

      {/*----------Paging----------*/}
      {total > PAGE_SIZE && (
        <nav
          aria-label="Pagination"
          className="flex items-center justify-between px-2 text-sm text-dark-grey"
        >
          <span>
            Showing {(page - 1) * PAGE_SIZE + 1}–
            {Math.min(total, page * PAGE_SIZE)} of {total}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={actionButton}
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
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
          custno={
            dialog.mode === "edit" ? dialog.customer.custNo : dialog.custNo
          }
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

      {/* Confirm-delete state: nothing is deleted until the person says yes */}
      {pendingDelete && (
        <ConfirmDialog
          title={`Delete ${pendingDelete.custName}?`}
          confirmLabel="Delete customer"
          busyLabel="Deleting..."
          busy={deleting}
          error={deleteError}
          onConfirm={confirmDelete}
          onCancel={() => !deleting && setPendingDelete(null)}
        >
          <p>
            <b>{pendingDelete.custName}</b> ({pendingDelete.custNo}) will be
            marked Inactive and hidden from the Active list.
          </p>
          <p className="mt-2 text-sm text-dark-grey">
            You can restore it later from the Inactive tab. A customer that
            still has sales cannot be deleted.
          </p>
        </ConfirmDialog>
      )}
    </section>
  );
}

export default CustomersPage;
