import { useCallback, useEffect, useState } from "react";
import { useAuthStore } from "../store/authStore";
import { api, ApiError, errorMessage } from "../lib/api";
import ProductDialog, { type ProductValues } from "../components/ProductDialog";
import { unitLabels, unitOptions, type Unit } from "../lib/units";

// One row as the back end sends it (GET /api/products).
type ApiProduct = {
  prodCode: string;
  description: string;
  unit: Unit;
  status: "Active" | "Inactive";
};

type Tab = "active" | "inactive" | "all";
type Counts = Record<Tab, number>;

type ListResponse = {
  ok: true;
  products: ApiProduct[];
  total: number;
  counts: Counts;
  page: number;
  pageSize: number;
};

type MenuResponse = { ok: true; tiles: { code: string; rights: string[] }[] };

type DialogState = { mode: "add" } | { mode: "edit"; product: ApiProduct } | null;

const PAGE_SIZE = 20;
const DEMO_USER_ID = 0; // the offline demo account has no server session (see authStore.ts)

const actionButton =
  "rounded-md border border-light-grey bg-white px-3 py-1 text-sm hover:bg-light-grey disabled:opacity-60";

const tabs: { id: Tab; label: string }[] = [
  { id: "active", label: "Active" },
  { id: "inactive", label: "Inactive" },
  { id: "all", label: "All" },
];

// First error the server found, field messages first (e.g. "Description is required.")
const saveMessage = (err: unknown) => {
  if (err instanceof ApiError && err.errors) {
    const first = Object.values(err.errors)[0];
    if (first) return first;
  }
  return errorMessage(err);
};

// S2-DEV-04: product list with search and filter. S2-DEV-05: add and edit.
// S2-DEV-06: soft delete and restore. Prices (S2-DEV-07/08) come later.
function ProductsPage() {
  const user = useAuthStore((s) => s.user);
  const isDemo = user?.id === DEMO_USER_ID;

  // What this person may do comes from the Rights dialog, through GET /api/menu.
  // The server checks every request again, so hiding something is only a convenience.
  const [rights, setRights] = useState<string[]>([]);
  const canAdd = rights.includes("PRODUCT_ADD");
  const canEdit = rights.includes("PRODUCT_EDIT");
  const canDelete = rights.includes("PRODUCT_DELETE"); // Delete right = delete AND restore
  const canSeeDeleted = canDelete; // the Delete right also opens Inactive / All

  const [data, setData] = useState<ListResponse | null>(null);
  const [tab, setTab] = useState<Tab>("active");
  const [query, setQuery] = useState("");
  const [unit, setUnit] = useState<Unit | "">("");
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [dialogError, setDialogError] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(""); // "Added AD0005." after a save
  // Three kinds of message, same idea as the customer page, so a reload of the list can never
  // wipe out why an action was refused:
  //   rightsError = the rights lookup failed (stays)
  //   actionError = a delete / restore was refused (stays until the next action)
  //   listError   = the list itself could not be loaded (clears when a load works)
  const [rightsError, setRightsError] = useState("");
  const [actionError, setActionError] = useState("");
  const [listError, setListError] = useState("");
  const error = rightsError || actionError || listError;
  const [busyCode, setBusyCode] = useState<string | null>(null); // product whose delete/restore is running

  // Rights, once
  useEffect(() => {
    if (isDemo) return;
    api<MenuResponse>("/api/menu")
      .then((menu) => setRights(menu.tiles.find((t) => t.code === "PRODUCT")?.rights ?? []))
      .catch((err) => setRightsError(errorMessage(err)));
  }, [isDemo]);

  // The list: asks the server again whenever the tab, search, unit or page changes.
  // Typing in the search box waits a moment so we do not send a request for every key.
  useEffect(() => {
    if (isDemo) return;
    let stale = false;
    const params = new URLSearchParams({ status: tab, page: String(page), pageSize: String(PAGE_SIZE) });
    if (query.trim()) params.set("search", query.trim());
    if (unit) params.set("unit", unit);
    const timer = setTimeout(
      () => {
        api<ListResponse>(`/api/products?${params}`)
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
  }, [isDemo, tab, query, unit, page, reloadKey]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  // ---------- soft delete and restore (S2-DEV-06) ----------
  // DELETE /api/products/:prodCode   and   PATCH /api/products/:prodCode/restore
  // The server refuses a delete while the product still has sale lines or prices; its message
  // shows in the banner.
  const changeStatus = async (p: ApiProduct, action: "delete" | "restore") => {
    if (action === "delete") {
      const ok = window.confirm(
        `Delete ${p.description} (${p.prodCode})?\n\nIt will be marked Inactive and can be restored later.`,
      );
      if (!ok) return;
    }
    setBusyCode(p.prodCode);
    setActionError("");
    setNotice("");
    try {
      if (action === "delete") await api(`/api/products/${p.prodCode}`, { method: "DELETE" });
      else await api(`/api/products/${p.prodCode}/restore`, { method: "PATCH" });
      setNotice(action === "delete" ? `Deleted ${p.prodCode}.` : `Restored ${p.prodCode}.`);
      // Changed the last row of the last page: step back so the page is not empty
      if (data && data.products.length === 1 && page > 1 && tab !== "all") setPage(page - 1);
      else reload();
    } catch (err) {
      setActionError(errorMessage(err));
      reload(); // someone else may have changed it: show what is really there
    } finally {
      setBusyCode(null);
    }
  };

  // ---------- add and edit (S2-DEV-05) ----------
  // POST /api/products   and   PATCH /api/products/:prodCode
  // The server checks the right and every field again; its message shows in the dialog and the
  // dialog stays open so nothing typed is lost.
  const save = async (values: ProductValues) => {
    if (!dialog || saving) return;
    setSaving(true);
    try {
      if (dialog.mode === "edit") {
        const code = dialog.product.prodCode;
        await api(`/api/products/${code}`, {
          method: "PATCH",
          body: { description: values.description, unit: values.unit },
        });
        setNotice(`Saved ${code}.`);
      } else {
        await api("/api/products", {
          method: "POST",
          body: { prodCode: values.prodcode, description: values.description, unit: values.unit },
        });
        setNotice(`Added ${values.prodcode}. Search for it to find it in the list.`);
      }
      setDialog(null);
      reload();
    } catch (err) {
      setDialogError(saveMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const showTabs = canSeeDeleted;
  const counts = data?.counts;
  const rows = data?.products ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const showActions = canEdit || canDelete;
  const colCount = 3 + (canSeeDeleted ? 1 : 0) + (showActions ? 1 : 0);
  const loading = !isDemo && data === null && !error;
  const filtering = query.trim() !== "" || unit !== "";

  const description = canSeeDeleted
    ? "Add, edit, delete and restore products. Deleted products stay here as Inactive."
    : "Search, add and edit products.";

  return (
    <section aria-labelledby="products-title" className="flex flex-col gap-6">
      <header>
        <h1 id="products-title" className="text-5xl font-bold leading-none">
          Products
        </h1>
        <p className="mt-3 text-sm text-dark-grey">{description}</p>
      </header>

      {isDemo && (
        <p role="alert" className="rounded-md bg-red-200 px-4 py-2 text-red-800">
          You are using the demo account, which is not connected to the server. Log in with a real account to
          see products.
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-md bg-red-200 px-4 py-2 text-red-800">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="rounded-md bg-green-300 px-4 py-2 text-green-800">
          {notice}
        </p>
      )}

      {/*----------Toolbar: status tabs, unit filter, search----------*/}
      <div className="flex flex-wrap items-center justify-between gap-4">
        {showTabs ? (
          <div role="tablist" aria-label="Product status" className="flex gap-2">
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
          <select
            value={unit}
            onChange={(e) => {
              setUnit(e.target.value as Unit | "");
              setPage(1);
            }}
            aria-label="Filter by unit"
            className="rounded-md border border-dark-grey bg-white px-3 py-2 shadow-lg focus:outline-none focus:ring-2 focus:ring-fire-light"
          >
            <option value="">All units</option>
            {unitOptions.map((u) => (
              <option key={u} value={u}>
                {unitLabels[u]}
              </option>
            ))}
          </select>
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
              placeholder="Search code or description..."
              aria-label="Search products"
              className="w-72 rounded-md border border-dark-grey bg-white py-2 pl-9 pr-3 shadow-lg placeholder:text-dark-grey focus:outline-none focus:ring-2 focus:ring-fire-light"
            />
          </div>
          {canAdd && (
            <button
              type="button"
              onClick={() => {
                setDialogError("");
                setNotice("");
                setDialog({ mode: "add" });
              }}
              className="flex items-center gap-2 rounded-md bg-fire px-4 py-2 text-white shadow-lg hover:bg-fire-light"
            >
              <i className="fa-solid fa-plus" aria-hidden="true" />
              Add product
            </button>
          )}
          {filtering && (
            <button
              type="button"
              className={actionButton}
              onClick={() => {
                setQuery("");
                setUnit("");
                setPage(1);
              }}
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/*----------Table----------*/}
      <div className="overflow-x-auto rounded-xl bg-paper p-2 shadow-lg">
        <table className="w-full min-w-[36rem] text-left">
          <caption className="sr-only">Products</caption>
          <thead className="text-sm text-dark-grey">
            <tr>
              <th scope="col" className="px-4 py-3 font-semibold">Product code</th>
              <th scope="col" className="px-4 py-3 font-semibold">Description</th>
              <th scope="col" className="px-4 py-3 font-semibold">Unit</th>
              {canSeeDeleted && <th scope="col" className="px-4 py-3 font-semibold">Status</th>}
              {showActions && <th scope="col" className="px-4 py-3 font-semibold">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr className="border-t border-light-grey">
                <td colSpan={colCount} className="px-4 py-8 text-center text-dark-grey">
                  Loading products...
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr className="border-t border-light-grey">
                <td colSpan={colCount} className="px-4 py-8 text-center text-dark-grey">
                  {filtering ? "No products match your search." : "No products found."}
                </td>
              </tr>
            )}
            {rows.map((p) => {
              const deleted = p.status === "Inactive";
              return (
                <tr
                  key={p.prodCode}
                  // Shaded row: a soft-deleted product
                  className={`border-t border-light-grey ${deleted ? "bg-cream" : ""}`}
                >
                  <td className="px-4 py-3 font-semibold">{p.prodCode}</td>
                  <td className="px-4 py-3">{p.description}</td>
                  <td className="px-4 py-3">{unitLabels[p.unit]}</td>
                  {canSeeDeleted && (
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                          deleted
                            ? "border-red-900 bg-red-300 text-red-800"
                            : "border-green-900 bg-green-300 text-green-800"
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                  )}
                  {showActions && (
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {deleted ? (
                          // A deleted product has to be restored before it can be edited
                          canDelete && (
                            <button
                              type="button"
                              onClick={() => changeStatus(p, "restore")}
                              disabled={busyCode === p.prodCode}
                              aria-label={`Restore ${p.description}`}
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
                                  setNotice("");
                                  setDialog({ mode: "edit", product: p });
                                }}
                                aria-label={`Edit ${p.description}`}
                                className={actionButton}
                              >
                                Edit
                              </button>
                            )}
                            {canDelete && (
                              <button
                                type="button"
                                onClick={() => changeStatus(p, "delete")}
                                disabled={busyCode === p.prodCode}
                                aria-label={`Delete ${p.description}`}
                                className={actionButton}
                              >
                                Delete
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  )}
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
        <ProductDialog
          initial={
            dialog.mode === "edit"
              ? {
                  prodcode: dialog.product.prodCode,
                  description: dialog.product.description,
                  unit: dialog.product.unit,
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

export default ProductsPage;
