import { useCallback, useEffect, useRef, useState } from "react";
import { useAuthStore } from "../store/authStore";
import { api } from "../lib/api";
import ProductDialog, { type ProductValues } from "../components/ProductDialog";
import ConfirmDialog from "../components/ConfirmDialog";
import EmptyState from "../components/EmptyState";
import ErrorBanner from "../components/ErrorBanner";
import PriceHistoryDialog, {
  type PriceCan,
} from "../components/PriceHistoryDialog";
import StatusBadge from "../components/StatusBadge";
import StatusTabs from "../components/StatusTabs";
import { DEMO_RIGHTS } from "../lib/demoProducts";
import { describeError, type ErrorInfo } from "../lib/errorInfo";
import { productApi } from "../lib/productApi";
import {
  ALL_PRODUCT_RIGHTS,
  DEMO_USER_ID,
  PAGE_SIZE,
  actionButton,
  asRole,
  dangerButton,
  money,
  roleChip,
  roleIntro,
  roleLabel,
  saveMessage,
  type ApiProduct,
  type ListResponse,
  type MenuResponse,
  type Tab,
} from "../lib/products";
import { isAdminOrAbove, isSuperadmin, type Role } from "../lib/roles";
import { unitLabels, unitOptions, type Unit } from "../lib/units";
import { useDismiss } from "../lib/useDismiss";

// ===========================================================================
// Products and Price History (S2-DEV-04 to S2-DEV-08)
//
// The page looks and behaves differently for each role (Student Guide, sections 1.2, 3.4):
//
//                      User                    Admin                       Superadmin
//   Rows               Active only             Active + deleted            Active + deleted
//   Status / Stamp     hidden                  shown                       shown
//   Inactive/All tabs  hidden                  shown                       shown
//   Buttons            only the rights an      only the rights the         every button (a superadmin
//                      Admin granted them      Rights dialog granted       implicitly holds all rights)
//
// Hiding a button is only a courtesy. The server checks the role and the right on every request
// (middleware/permission.js), and must also filter deleted rows for a User.
// ===========================================================================

type DialogState =
  { mode: "add" } | { mode: "edit"; product: ApiProduct } | null;

// Chips inside the filter dropdown (flat pills, like the inputs)
const chip = (selected: boolean) =>
  `rounded-full px-4 py-1.5 text-sm font-semibold transition-colors duration-200 ease-in-out ${
    selected ? "bg-fire text-white" : "bg-white hover:bg-light-grey"
  }`;

const unitChips: { id: Unit | ""; label: string }[] = [
  { id: "", label: "All" },
  ...unitOptions.map((id) => ({ id, label: unitLabels[id] })),
];

function ProductsPage() {
  const user = useAuthStore((s) => s.user);
  const isDemo = user?.id === DEMO_USER_ID;

  // The demo account can preview each role. A real account always gets its own role.
  const [previewRole, setPreviewRole] = useState<Role>(asRole(user?.role));
  const viewRole: Role = isDemo ? previewRole : asRole(user?.role);
  const privileged = isAdminOrAbove(viewRole); // sees deleted rows, Status, Stamp and the tabs

  // What this person may do. Superadmin implicitly holds every right (same rule as the server);
  // Admin and User only hold what the Rights dialog granted, read from GET /api/menu.
  // The server checks every request again, so hiding a button is only a convenience.
  const [menuRights, setMenuRights] = useState<string[]>([]);
  const rights = isDemo
    ? DEMO_RIGHTS[viewRole]
    : isSuperadmin(viewRole)
      ? ALL_PRODUCT_RIGHTS
      : menuRights;
  const has = (code: string) => rights.includes(code);
  const canAdd = has("PRODUCT_ADD");
  const canEdit = has("PRODUCT_EDIT");
  const canDelete = has("PRODUCT_DELETE"); // Delete right = delete AND restore
  const priceCan: PriceCan = {
    add: has("PRICE_ADD"),
    edit: has("PRICE_EDIT"),
    remove: has("PRICE_DELETE"),
  };

  const [data, setData] = useState<ListResponse | null>(null);
  const [tab, setTab] = useState<Tab>("active");
  const [query, setQuery] = useState("");
  const [unit, setUnit] = useState<Unit | "">("");
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const closeFilter = useCallback(() => setFilterOpen(false), []);
  useDismiss(filterRef, filterOpen, closeFilter);
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [dialogError, setDialogError] = useState("");
  const [saving, setSaving] = useState(false);
  const [pricesFor, setPricesFor] = useState<ApiProduct | null>(null);
  const [busyCode, setBusyCode] = useState<string | null>(null); // product whose delete / restore is running
  const [notice, setNotice] = useState(""); // "Added AD0005." after a save
  // Three kinds of error, so a reload can never wipe out why an action was refused:
  //   rightsError = the rights lookup failed (stays)
  //   actionError = a restore was refused (stays until dismissed or the next action)
  //   listError   = the list could not be loaded (clears the next time a load works)
  const [rightsError, setRightsError] = useState<ErrorInfo | null>(null);
  const [actionError, setActionError] = useState<ErrorInfo | null>(null);
  const [listError, setListError] = useState<ErrorInfo | null>(null);
  // Confirm-delete state: the product waiting for a yes, and what the server said when asked
  const [pendingDelete, setPendingDelete] = useState<ApiProduct | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<ErrorInfo | null>(null);

  // A User only ever asks for Active rows, whatever the tab state says
  const effectiveTab: Tab = privileged ? tab : "active";

  // Rights, once (not needed for the demo account or a superadmin)
  const needsMenu = !isDemo && !isSuperadmin(viewRole);
  useEffect(() => {
    if (!needsMenu) return;
    api<MenuResponse>("/api/menu")
      .then((menu) =>
        setMenuRights(
          menu.tiles.find((t) => t.code === "PRODUCT")?.rights ?? [],
        ),
      )
      .catch((err) => setRightsError(describeError(err)));
  }, [needsMenu]);

  // The list: asks the server again whenever the tab, search, unit or page changes.
  // Typing in the search box waits a moment so we do not send a request for every key.
  useEffect(() => {
    let stale = false;
    const timer = setTimeout(
      () => {
        productApi
          .list(isDemo, {
            status: effectiveTab,
            search: query,
            unit,
            page,
            pageSize: PAGE_SIZE,
          })
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
  }, [isDemo, effectiveTab, query, unit, page, reloadKey]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  // ---------- add and edit (S2-DEV-05) ----------
  // The server checks the right and every field again; its message shows in the dialog and the
  // dialog stays open so nothing typed is lost.
  const save = async (values: ProductValues) => {
    if (!dialog || saving) return;
    setSaving(true);
    try {
      if (dialog.mode === "edit") {
        const code = dialog.product.prodCode;
        await productApi.update(isDemo, code, {
          description: values.description,
          unit: values.unit,
        });
        setNotice(`Saved ${code}.`);
      } else {
        await productApi.create(isDemo, {
          prodCode: values.prodcode,
          description: values.description,
          unit: values.unit,
        });
        setNotice(
          `Added ${values.prodcode}. Search for it to find it in the list.`,
        );
      }
      setDialog(null);
      reload();
    } catch (err) {
      setDialogError(saveMessage(err));
    } finally {
      setSaving(false);
    }
  };

  // ---------- soft delete and restore (S2-DEV-06) ----------
  // After a row leaves the current tab, step back a page if that was the last row on it
  const refreshAfterRowChange = () => {
    if (
      data &&
      data.products.length === 1 &&
      page > 1 &&
      effectiveTab !== "all"
    )
      setPage(page - 1);
    else reload();
  };

  // Delete asks first. The server refuses a delete while the product still has prices or sales;
  // its reason shows inside the confirm dialog, so it can be read before closing.
  const askDelete = (p: ApiProduct) => {
    setDeleteError(null);
    setActionError(null);
    setNotice("");
    setPendingDelete(p);
  };

  const confirmDelete = async () => {
    if (!pendingDelete || deleting) return;
    const p = pendingDelete;
    setDeleting(true);
    setDeleteError(null);
    try {
      await productApi.remove(isDemo, p.prodCode);
      setNotice(`Deleted ${p.prodCode}.`);
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
  const restore = async (p: ApiProduct) => {
    setBusyCode(p.prodCode);
    setActionError(null);
    setNotice("");
    try {
      await productApi.restore(isDemo, p.prodCode);
      setNotice(`Restored ${p.prodCode}.`);
      refreshAfterRowChange();
    } catch (err) {
      setActionError(describeError(err));
      reload();
    } finally {
      setBusyCode(null);
    }
  };

  const openAdd = () => {
    setDialogError("");
    setNotice("");
    setDialog({ mode: "add" });
  };

  const clearFilters = () => {
    setQuery("");
    setUnit("");
    setPage(1);
  };

  const switchPreview = (role: Role) => {
    setPreviewRole(role);
    setTab("active");
    setPage(1);
    setNotice("");
    setActionError(null);
  };

  const counts = data?.counts;
  // Defensive: a User never sees a deleted row, even if the server sent one
  const rows = (data?.products ?? []).filter(
    (p) => privileged || p.status === "Active",
  );
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const colCount = 5 + (privileged ? 2 : 0);
  const loading = data === null && !listError;
  const loadFailed = listError !== null && data === null;
  const filtering = query.trim() !== "" || unit !== "";

  return (
    <section aria-labelledby="products-title" className="flex flex-col gap-6">
      <header>
        <div className="flex flex-wrap items-center gap-4">
          <h1 id="products-title" className="text-5xl font-bold leading-none">
            Products
          </h1>
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${roleChip[viewRole]}`}
            aria-label={`Signed in as ${roleLabel[viewRole]}`}
          >
            {roleLabel[viewRole]}
          </span>
        </div>
        <p className="mt-3 text-sm text-dark-grey">{roleIntro[viewRole]}</p>
      </header>

      {isDemo && (
        <div
          role="status"
          className="flex flex-wrap items-center gap-3 rounded-md bg-cream px-4 py-2"
        >
          <span>
            You are using the demo account with sample products. Changes stay in
            this browser tab and reset when you refresh. Preview as:
          </span>
          <div role="group" aria-label="Preview as role" className="flex gap-2">
            {(["user", "admin", "superadmin"] as const).map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={viewRole === r}
                onClick={() => switchPreview(r)}
                className={`rounded-full px-4 py-1 text-sm font-semibold ${
                  viewRole === r
                    ? "bg-dark text-white"
                    : "bg-white hover:bg-light-grey"
                }`}
              >
                {roleLabel[r]}
              </button>
            ))}
          </div>
        </div>
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
      {notice && (
        <p
          role="status"
          className="rounded-md bg-green-300 px-4 py-2 text-green-800"
        >
          {notice}
        </p>
      )}

      {/*----------Toolbar: status tabs, unit filter, search, add----------*/}
      <div className="flex flex-wrap items-center justify-between gap-4">
        {privileged ? (
          <StatusTabs
            label="Product status"
            tab={tab}
            counts={counts}
            onChange={(t) => {
              setTab(t);
              setPage(1);
            }}
          />
        ) : (
          <span />
        )}

        <div className="flex flex-wrap items-center gap-3">
          {/*----------Filter dropdown: unit----------*/}
          <div ref={filterRef} className="relative">
            <button
              type="button"
              onClick={() => setFilterOpen((o) => !o)}
              aria-expanded={filterOpen}
              aria-controls="product-filter-panel"
              aria-label="Filter products"
              className="relative flex h-10 w-10 items-center justify-center rounded-full bg-[#e0d3ca] transition-colors duration-200 ease-in-out hover:bg-light-grey focus:outline-none focus-visible:ring-2 focus-visible:ring-fire-light"
            >
              <i
                className="fa-solid fa-filter text-dark-grey"
                aria-hidden="true"
              />
              {unit && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-fire px-1 text-xs font-bold text-white">
                  1<span className="sr-only"> active filter</span>
                </span>
              )}
            </button>

            {filterOpen && (
              <div
                id="product-filter-panel"
                role="group"
                aria-label="Filter products"
                className="absolute left-0 z-30 mt-2 flex w-72 flex-col gap-4 rounded-xl bg-paper p-4"
              >
                <fieldset>
                  <legend className="mb-2 text-sm font-semibold text-dark-grey">
                    Unit
                  </legend>
                  <div className="flex flex-wrap gap-2">
                    {unitChips.map((o) => (
                      <button
                        key={o.id || "all"}
                        type="button"
                        aria-pressed={unit === o.id}
                        onClick={() => {
                          setUnit(o.id);
                          setPage(1);
                        }}
                        className={chip(unit === o.id)}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <button
                  type="button"
                  onClick={() => {
                    setUnit("");
                    setPage(1);
                  }}
                  disabled={!unit}
                  className="self-end rounded-full px-3 py-1 text-sm font-semibold text-dark-grey transition-colors duration-200 ease-in-out hover:text-dark disabled:opacity-40"
                >
                  Clear filters
                </button>
              </div>
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
              placeholder="Search products..."
              aria-label="Search products"
              className="w-64 rounded-full bg-[#e0d3ca] py-2 pl-9 pr-3 placeholder:text-dark-grey focus:outline-none focus:ring-2 focus:ring-fire-light"
            />
          </div>
          {canAdd && (
            <button
              type="button"
              onClick={openAdd}
              className="flex items-center gap-2 rounded-md bg-fire px-4 py-2 text-white shadow-lg hover:bg-fire-light"
            >
              <i className="fa-solid fa-plus" aria-hidden="true" />
              Add product
            </button>
          )}
        </div>
      </div>

      {/*----------Table----------*/}
      <div className="overflow-x-auto rounded-xl bg-paper p-2 shadow-lg">
        <table className="w-full min-w-[40rem] text-left">
          <caption className="sr-only">Products</caption>
          <thead className="text-sm text-dark-grey">
            <tr>
              <th scope="col" className="px-4 py-3 font-semibold">
                Product code
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                Description
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                Unit
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                Current price
              </th>
              {privileged && (
                <th scope="col" className="px-4 py-3 font-semibold">
                  Status
                </th>
              )}
              {privileged && (
                <th scope="col" className="px-4 py-3 font-semibold">
                  Stamp
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
                  Loading products...
                </td>
              </tr>
            )}
            {/* Error state, first load: the table itself explains and offers a retry */}
            {loadFailed && (
              <tr className="border-t border-light-grey">
                <td colSpan={colCount}>
                  <EmptyState
                    icon="fa-triangle-exclamation"
                    title="Couldn't load the products"
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
                      title="No products match your search"
                      action={
                        <button
                          type="button"
                          onClick={clearFilters}
                          className={actionButton}
                        >
                          Clear search and filter
                        </button>
                      }
                    >
                      Try a different word, or clear the search and the unit
                      filter.
                    </EmptyState>
                  ) : privileged && effectiveTab === "inactive" ? (
                    <EmptyState icon="fa-trash-can" title="No deleted products">
                      Products you delete appear here, and can be restored.
                    </EmptyState>
                  ) : (
                    <EmptyState
                      title="No products yet"
                      action={
                        canAdd ? (
                          <button
                            type="button"
                            onClick={openAdd}
                            className={actionButton}
                          >
                            Add the first product
                          </button>
                        ) : undefined
                      }
                    >
                      {canAdd
                        ? "Add a product to get started."
                        : "There are no products to show."}
                    </EmptyState>
                  )}
                </td>
              </tr>
            )}
            {rows.map((p) => {
              const deleted = p.status === "Inactive";
              const busy = busyCode === p.prodCode;
              return (
                <tr
                  key={p.prodCode}
                  // Shaded row: a soft-deleted product (Admin and Superadmin only)
                  className={`border-t border-light-grey ${deleted ? "bg-cream" : ""}`}
                >
                  <td className="px-4 py-3 font-semibold">{p.prodCode}</td>
                  <td className="px-4 py-3">{p.description}</td>
                  <td className="px-4 py-3">{unitLabels[p.unit]}</td>
                  <td className="px-4 py-3 font-semibold">
                    {p.currentPrice === null || p.currentPrice === undefined ? (
                      <>
                        <span aria-hidden="true">—</span>
                        <span className="sr-only">No current price</span>
                      </>
                    ) : (
                      money(p.currentPrice)
                    )}
                  </td>
                  {privileged && (
                    <td className="px-4 py-3">
                      <StatusBadge status={p.status} />
                    </td>
                  )}
                  {privileged && (
                    <td className="px-4 py-3 text-xs text-dark-grey">
                      {p.stamp ?? "—"}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {/* A deleted product has to be restored before its prices or details can be touched */}
                      {!deleted && (
                        <button
                          type="button"
                          onClick={() => setPricesFor(p)}
                          aria-label={`Prices of ${p.description}`}
                          className={actionButton}
                        >
                          Prices
                        </button>
                      )}
                      {!deleted && canEdit && (
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
                      {!deleted && canDelete && (
                        <button
                          type="button"
                          onClick={() => askDelete(p)}
                          disabled={busy}
                          aria-label={`Delete ${p.description}`}
                          className={dangerButton}
                        >
                          Delete
                        </button>
                      )}
                      {deleted && canDelete && (
                        <button
                          type="button"
                          onClick={() => restore(p)}
                          disabled={busy}
                          aria-label={`Restore ${p.description}`}
                          className={actionButton}
                        >
                          Restore
                        </button>
                      )}
                      {deleted && !canDelete && (
                        <span
                          className="text-dark-grey"
                          aria-label="No actions available"
                        >
                          —
                        </span>
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

      {/* Confirm-delete state: nothing is deleted until the person says yes */}
      {pendingDelete && (
        <ConfirmDialog
          title={`Delete ${pendingDelete.description}?`}
          confirmLabel="Delete product"
          busyLabel="Deleting..."
          busy={deleting}
          error={deleteError}
          onConfirm={confirmDelete}
          onCancel={() => !deleting && setPendingDelete(null)}
        >
          <p>
            <b>{pendingDelete.description}</b> ({pendingDelete.prodCode}) will
            be marked Inactive and hidden from the product list.
          </p>
          <p className="mt-2 text-sm text-dark-grey">
            {privileged
              ? "You can restore it later from the Inactive tab."
              : "Only an Admin can see and restore it afterwards."}{" "}
            A product that still has prices or sales cannot be deleted.
          </p>
        </ConfirmDialog>
      )}

      {pricesFor && (
        <PriceHistoryDialog
          // key: switching the previewed role reopens the dialog with that role's view
          key={`${pricesFor.prodCode}-${viewRole}`}
          product={pricesFor}
          can={priceCan}
          demo={isDemo}
          onClose={() => setPricesFor(null)}
          onChanged={reload}
        />
      )}
    </section>
  );
}

export default ProductsPage;
