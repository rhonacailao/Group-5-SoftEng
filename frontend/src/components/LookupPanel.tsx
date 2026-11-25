import { useCallback, useEffect, useState } from "react";
import { api, ApiError, errorMessage } from "../lib/api";
import ConfirmDialog from "./ConfirmDialog";
import LookupDialog, { type LookupDialogValues } from "./LookupDialog";
import EmptyState from "./EmptyState";
import ErrorBanner from "./ErrorBanner";
import Card from "./Card";
import Badge from "./Badge";
import { describeError, type ErrorInfo } from "../lib/errorInfo";
import type {
  DemoLookupRow,
  DemoStore,
  LookupListResponse,
  LookupTab,
} from "../lib/demoHumanResources";

/** Everything that differs between the Jobs tab and the Departments tab. */
export type LookupConfig = {
  /** Heading above the table, e.g. "Jobs" */
  title: string;
  /** Lower case, e.g. "job" */
  noun: string;
  /** Lower case, e.g. "jobs" */
  nounPlural: string;
  codeLabel: string; // "Job code"
  nameLabel: string; // "Job description"
  codeMax: number;
  nameMax: number;
  /** Back end route, e.g. "/api/jobs" */
  endpoint: string;
  /** Rights are named <PREFIX>_ADD, <PREFIX>_EDIT and <PREFIX>_DELETE */
  rightsPrefix: string;
};

type LookupPanelProps = {
  config: LookupConfig;
  /** What this person may do with this tab (from GET /api/menu) */
  rights: string[];
  /** Given for the offline demo account: the in-memory store to use instead of the server */
  demo?: DemoStore;
};

type DialogState =
  | { mode: "add" }
  | { mode: "edit"; row: DemoLookupRow }
  | null;

const PAGE_SIZE = 20;

const actionButton =
  "rounded-md border border-light-grey bg-white px-3 py-1 text-sm transition-colors duration-200 ease-in-out hover:bg-light-grey disabled:opacity-60";

const tabs: { id: LookupTab; label: string }[] = [
  { id: "active", label: "Active" },
  { id: "inactive", label: "Inactive" },
  { id: "all", label: "All" },
];

// First error the server found, field messages first (e.g. "Job code is required.")
const saveMessage = (err: unknown) => {
  if (err instanceof ApiError && err.errors) {
    const first = Object.values(err.errors)[0];
    if (first) return first;
  }
  return errorMessage(err);
};

function LookupPanel({ config, rights, demo }: LookupPanelProps) {
  const { title, noun, nounPlural, codeLabel, nameLabel, endpoint } = config;

  // Both paths return a promise and throw the same ApiError, so the code below is the same for both.
  const run = <T,>(demoCall: () => T, live: () => Promise<T>): Promise<T> =>
    demo ? new Promise<T>((resolve) => resolve(demoCall())) : live();

  // The server checks every request again, so hiding a button is only a convenience.
  const canAdd = rights.includes(`${config.rightsPrefix}_ADD`);
  const canEdit = rights.includes(`${config.rightsPrefix}_EDIT`);
  const canDelete = rights.includes(`${config.rightsPrefix}_DELETE`); // Delete right = delete AND restore

  const [data, setData] = useState<LookupListResponse | null>(null);
  const [tab, setTab] = useState<LookupTab>("active");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  // Two kinds of error, so a reload can never wipe out why an action was refused:
  //   actionError = a restore / add was refused (stays until dismissed or the next action)
  //   listError   = the list could not be loaded (clears the next time a load works)
  const [actionError, setActionError] = useState<ErrorInfo | null>(null);
  const [listError, setListError] = useState<ErrorInfo | null>(null);
  // Confirm-delete state: the row waiting for a yes, and what the server said when asked
  const [pendingDelete, setPendingDelete] = useState<DemoLookupRow | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<ErrorInfo | null>(null);
  const [busyCode, setBusyCode] = useState<string | null>(null); // row whose restore is running
  const [dialog, setDialog] = useState<DialogState>(null);
  const [dialogError, setDialogError] = useState("");
  const [saving, setSaving] = useState(false);

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
    const timer = setTimeout(
      () => {
        run<LookupListResponse>(
          () => demo!.list({ tab, query, page, pageSize: PAGE_SIZE }),
          () => api<LookupListResponse>(`${endpoint}?${params}`),
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
  }, [demo, endpoint, tab, query, page, reloadKey]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  // ---------- soft delete and restore ----------
  // After a row leaves the current tab, step back a page if that was the last row on it
  const refreshAfterRowChange = () => {
    if (data && data.items.length === 1 && page > 1 && tab !== "all")
      setPage(page - 1);
    else reload();
  };

  // Delete asks first. The database refuses a delete while job history still points at the row;
  // the reason shows inside the confirm dialog, so it can be read before closing.
  const askDelete = (row: DemoLookupRow) => {
    setDeleteError(null);
    setActionError(null);
    setPendingDelete(row);
  };

  const confirmDelete = async () => {
    if (!pendingDelete || deleting) return;
    const row = pendingDelete;
    setDeleting(true);
    setDeleteError(null);
    try {
      await run(
        () => demo!.remove(row.code),
        () => api(`${endpoint}/${row.code}`, { method: "DELETE" }),
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
  const restore = async (row: DemoLookupRow) => {
    setBusyCode(row.code);
    setActionError(null);
    try {
      await run(
        () => demo!.restore(row.code),
        () => api(`${endpoint}/${row.code}/restore`, { method: "PATCH" }),
      );
      refreshAfterRowChange();
    } catch (err) {
      setActionError(describeError(err));
      reload();
    } finally {
      setBusyCode(null);
    }
  };

  // ---------- add and edit ----------
  const openAdd = () => {
    setDialogError("");
    setActionError(null);
    setDialog({ mode: "add" });
  };

  const save = async (values: LookupDialogValues) => {
    if (!dialog || saving) return;
    setSaving(true);
    try {
      if (dialog.mode === "edit") {
        const { code } = dialog.row;
        const body = { name: values.name }; // the code is the key and never changes
        await run(
          () => demo!.update(code, body),
          () => api(`${endpoint}/${code}`, { method: "PATCH", body }),
        );
      } else {
        const body = { code: values.code, name: values.name };
        await run(
          () => demo!.create(body),
          () => api(endpoint, { method: "POST", body }),
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

  // Users with the Delete right can open the Inactive and All tabs and see Status and Stamp;
  // everyone else sees the Active rows only (same rule as Customers).
  const showTabs = canDelete;
  const counts = data?.counts;
  const rows = data?.items ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasActions = canEdit || canDelete;
  const colCount = 2 + (canDelete ? 2 : 0) + (hasActions ? 1 : 0);
  const loading = data === null && !listError;
  const loadFailed = listError !== null && data === null;
  const searching = query.trim() !== "";

  return (
    <div className="flex flex-col gap-6">
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

      {/*----------Toolbar: heading, status tabs, search, add----------*/}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <h2 className="text-2xl font-bold">{title}</h2>
          {showTabs && (
            <div
              role="tablist"
              aria-label={`${title} status`}
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
          )}
        </div>

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
              placeholder={`Search ${nounPlural}...`}
              aria-label={`Search ${nounPlural}`}
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
              Add {noun}
            </button>
          )}
        </div>
      </div>

      {/*----------Table----------*/}
      <Card className="overflow-x-auto p-2">
        <table className="w-full min-w-[40rem] text-left">
          <caption className="sr-only">{title}</caption>
          <thead className="text-sm text-dark-grey">
            <tr>
              <th scope="col" className="px-4 py-3 font-semibold">
                {codeLabel}
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                {nameLabel}
              </th>
              {canDelete && (
                <>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Stamp
                  </th>
                </>
              )}
              {hasActions && (
                <th scope="col" className="px-4 py-3 font-semibold">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr className="border-t border-light-grey">
                <td
                  colSpan={colCount}
                  className="px-4 py-8 text-center text-dark-grey"
                >
                  Loading {nounPlural}...
                </td>
              </tr>
            )}
            {/* Error state, first load: the table itself explains and offers a retry */}
            {loadFailed && (
              <tr className="border-t border-light-grey">
                <td colSpan={colCount}>
                  <EmptyState
                    icon="fa-triangle-exclamation"
                    title={`Couldn't load the ${nounPlural}`}
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
                  {searching ? (
                    <EmptyState
                      icon="fa-magnifying-glass"
                      title={`No ${nounPlural} match your search`}
                      action={
                        <button
                          type="button"
                          onClick={() => {
                            setQuery("");
                            setPage(1);
                          }}
                          className={actionButton}
                        >
                          Clear search
                        </button>
                      }
                    >
                      Try a different word, or clear the search.
                    </EmptyState>
                  ) : canDelete && tab === "inactive" ? (
                    <EmptyState
                      icon="fa-trash-can"
                      title={`No deleted ${nounPlural}`}
                    >
                      {`Deleted ${nounPlural} appear here, and can be restored.`}
                    </EmptyState>
                  ) : (
                    <EmptyState
                      title={`No ${nounPlural} yet`}
                      action={
                        canAdd ? (
                          <button
                            type="button"
                            onClick={openAdd}
                            className={actionButton}
                          >
                            Add the first {noun}
                          </button>
                        ) : undefined
                      }
                    >
                      {canAdd
                        ? `Add a ${noun} to get started.`
                        : `There are no ${nounPlural} to show.`}
                    </EmptyState>
                  )}
                </td>
              </tr>
            )}
            {rows.map((row) => {
              const deleted = row.status === "Inactive";
              return (
                <tr
                  key={row.code}
                  // Shaded row: a soft-deleted row
                  className={`border-t border-light-grey ${deleted ? "bg-cream" : ""}`}
                >
                  <td className="px-4 py-3 font-semibold">{row.code}</td>
                  <td className="px-4 py-3">{row.name}</td>
                  {canDelete && (
                    <>
                      <td className="px-4 py-3">
                        <Badge variant={deleted ? "danger" : "success"}>
                          {row.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-dark-grey">
                        {row.stamp}
                      </td>
                    </>
                  )}
                  {hasActions && (
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {deleted ? (
                          canDelete && (
                            <button
                              type="button"
                              onClick={() => restore(row)}
                              disabled={busyCode === row.code}
                              aria-label={`Restore ${row.name}`}
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
                                  setDialog({ mode: "edit", row });
                                }}
                                aria-label={`Edit ${row.name}`}
                                className={actionButton}
                              >
                                Edit
                              </button>
                            )}
                            {canDelete && (
                              <button
                                type="button"
                                onClick={() => askDelete(row)}
                                aria-label={`Delete ${row.name}`}
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
      </Card>

      {/*----------Paging----------*/}
      {total > PAGE_SIZE && (
        <nav
          aria-label={`${title} pagination`}
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
        <LookupDialog
          noun={noun}
          codeLabel={codeLabel}
          nameLabel={nameLabel}
          codeMax={config.codeMax}
          nameMax={config.nameMax}
          initial={
            dialog.mode === "edit"
              ? { code: dialog.row.code, name: dialog.row.name }
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
          title={`Delete ${pendingDelete.name}?`}
          confirmLabel={`Delete ${noun}`}
          busyLabel="Deleting..."
          busy={deleting}
          error={deleteError}
          onConfirm={confirmDelete}
          onCancel={() => !deleting && setPendingDelete(null)}
        >
          <p>
            <b>{pendingDelete.name}</b> ({pendingDelete.code}) will be marked
            Inactive and hidden from the Active list.
          </p>
          <p className="mt-2 text-sm text-dark-grey">
            You can restore it later from the Inactive tab. A {noun} that still
            has job history cannot be deleted.
          </p>
        </ConfirmDialog>
      )}
    </div>
  );
}

export default LookupPanel;
