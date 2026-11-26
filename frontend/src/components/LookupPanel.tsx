import { useCallback, useEffect, useState, type ReactNode } from "react";
import { api, ApiError, errorMessage } from "../lib/api";
import ConfirmDialog from "./ConfirmDialog";
import LookupDialog, {
  type LookupDialogValues,
  type LookupField,
} from "./LookupDialog";
import EmptyState from "./EmptyState";
import ErrorBanner from "./ErrorBanner";
import Card from "./Card";
import Badge from "./Badge";
import { describeError, type ErrorInfo } from "../lib/errorInfo";
import type {
  DemoStore,
  LookupListResponse,
  LookupRow,
  LookupTab,
} from "../lib/demoHumanResources";

/** A table column after the code column. */
export type LookupColumn = {
  /** Field of the row to show, e.g. "lastName" */
  key: string;
  label: string;
  align?: "right";
  /** Keep a date or a number on one line */
  nowrap?: boolean;
  /** Tailwind width class (e.g. "w-[7rem]"). Only used with config.fitWidth, where columns have fixed widths. */
  width?: string;
  /** Hide this column on screens narrower than this (Tailwind breakpoint), so the table fits a phone */
  hideBelow?: "md" | "lg" | "xl";
  /** Custom cell, for values that need formatting. Empty values show as a dash. */
  render?: (row: LookupRow) => ReactNode;
};

/** A form field. `lockedOnEdit` fields are typed when adding and shown in the subtitle when editing. */
export type LookupFieldDef = LookupField & { lockedOnEdit?: boolean };

/**
 * Everything that differs between the Jobs, Departments and Employees tabs (and the job history
 * of one employee). Jobs and departments only need the first group: a code and a name. The
 * second group is for tables with more columns and fields.
 */
export type LookupConfig = {
  /** Heading above the table, e.g. "Jobs" */
  title: string;
  /** Lower case, e.g. "job" */
  noun: string;
  /** Lower case, e.g. "jobs" */
  nounPlural: string;
  codeLabel: string; // "Job code"
  /** The name column and field of the default layout: "Job description" */
  nameLabel?: string;
  codeMax?: number;
  nameMax?: number;
  /** Back end route, e.g. "/api/jobs" */
  endpoint: string;
  /** Rights are named <PREFIX>_ADD, <PREFIX>_EDIT and <PREFIX>_DELETE */
  rightsPrefix: string;

  // ----- only for tables with more than a code and a name -----
  /** Columns after the code. Default: one column with the name. */
  columns?: LookupColumn[];
  /** Form fields. Default: the code (typed when adding, read-only when editing) and the name. */
  fields?: LookupFieldDef[];
  /** The system assigns the code (employee numbers): GET <endpoint>/next-number, and no code field. */
  autoCode?: boolean;
  /** How a row is called in buttons and messages. Default: its name. */
  rowLabel?: (row: LookupRow) => string;
  /** Leave the code out of the delete message, for codes that are not meant to be read */
  hideCodeInMessages?: boolean;
  /** Last sentence of the delete message. Default: "A <noun> that still has job history cannot be deleted." */
  deleteNote?: string;
  /** Text of the add button. Default: "Add <noun>" */
  addLabel?: string;
  /** Show the search box. Default true. */
  searchable?: boolean;
  /** Show the heading above the table. Default true; false when the caller has its own heading. */
  showTitle?: boolean;
  /** Rows per page. Default 20. */
  pageSize?: number;
  /** Let the table shrink to its container (e.g. inside a dialog) instead of keeping a minimum width and scrolling sideways. */
  fitWidth?: boolean;
};

type LookupPanelProps = {
  config: LookupConfig;
  /** What this person may do with this tab (from GET /api/menu) */
  rights: string[];
  /** Given for the offline demo account: the in-memory store to use instead of the server */
  demo?: DemoStore;
  /** Extra buttons at the start of each row's Actions cell (e.g. the History button of an employee) */
  rowActions?: (row: LookupRow) => ReactNode;
};

type DialogState =
  | { mode: "add"; code?: string } // code: the number the system will give (autoCode tables)
  | { mode: "edit"; row: LookupRow }
  | null;

const DEFAULT_PAGE_SIZE = 20;

// Written out in full so Tailwind can see the class names
const hideBelowClass = {
  md: "hidden md:table-cell",
  lg: "hidden lg:table-cell",
  xl: "hidden xl:table-cell",
};
// The Stamp column is long and for admins only: it is the first to go on small screens
const STAMP_CELL = "hidden lg:table-cell";

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

function LookupPanel({ config, rights, demo, rowActions }: LookupPanelProps) {
  const { title, noun, nounPlural, codeLabel, endpoint, autoCode } = config;
  const nameLabel = config.nameLabel ?? "Name";
  const PAGE_SIZE = config.pageSize ?? DEFAULT_PAGE_SIZE;
  const fit = config.fitWidth === true;

  // Jobs and departments: a name column, and a code + name form
  const columns: LookupColumn[] = config.columns ?? [
    { key: "name", label: nameLabel },
  ];
  const fields: LookupFieldDef[] = config.fields ?? [
    {
      key: "code",
      label: codeLabel,
      maxLength: config.codeMax,
      uppercase: true,
      lockedOnEdit: true,
    },
    { key: "name", label: nameLabel, maxLength: config.nameMax },
  ];
  const labelOf = (row: LookupRow) =>
    config.rowLabel ? config.rowLabel(row) : String(row.name ?? row.code);
  const hideClass = (col: LookupColumn) =>
    col.hideBelow ? hideBelowClass[col.hideBelow] : "";
  const cellOf = (row: LookupRow, col: LookupColumn): ReactNode => {
    if (col.render) return col.render(row);
    const value = row[col.key];
    return value === undefined || value === null || value === ""
      ? "—"
      : String(value);
  };

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
  const [pendingDelete, setPendingDelete] = useState<LookupRow | null>(null);
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
  const askDelete = (row: LookupRow) => {
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
        () =>
          api(`${endpoint}/${encodeURIComponent(row.code)}`, {
            method: "DELETE",
          }),
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
  const restore = async (row: LookupRow) => {
    setBusyCode(row.code);
    setActionError(null);
    try {
      await run(
        () => demo!.restore(row.code),
        () =>
          api(`${endpoint}/${encodeURIComponent(row.code)}/restore`, {
            method: "PATCH",
          }),
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
  // Tables whose code the system assigns (employee numbers) ask for the next one first,
  // so the dialog can show it
  const openAdd = async () => {
    setActionError(null);
    try {
      const code = autoCode
        ? await run(
            () => demo!.nextCode!(),
            () =>
              api<{ ok: true; code: string }>(`${endpoint}/next-number`).then(
                (res) => res.code,
              ),
          )
        : undefined;
      setDialogError("");
      setDialog({ mode: "add", code });
    } catch (err) {
      setActionError(describeError(err));
    }
  };

  const save = async (values: LookupDialogValues) => {
    if (!dialog || saving) return;
    setSaving(true);
    try {
      if (dialog.mode === "edit") {
        const { code } = dialog.row;
        // The values hold the editable fields only: the code is the key and never changes
        await run(
          () => demo!.update(code, values),
          () =>
            api(`${endpoint}/${encodeURIComponent(code)}`, {
              method: "PATCH",
              body: values,
            }),
        );
      } else {
        await run(
          () => demo!.create(values),
          () => api(endpoint, { method: "POST", body: values }),
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

  // What the dialog shows: when editing, the fields that are locked move into the subtitle
  const dialogFields =
    dialog?.mode === "edit" ? fields.filter((f) => !f.lockedOnEdit) : fields;
  const dialogSubtitle = (() => {
    if (!dialog) return undefined;
    if (dialog.mode === "add")
      return autoCode && dialog.code
        ? `${codeLabel} ${dialog.code}`
        : undefined;
    const { row } = dialog;
    const parts = fields
      .filter((f) => f.lockedOnEdit)
      .map((f) => `${f.label} ${String(row[f.key] ?? "")}`);
    if (autoCode) parts.unshift(`${codeLabel} ${row.code}`);
    return parts.join(" · ") || undefined;
  })();

  // Users with the Delete right can open the Inactive and All tabs and see Status and Stamp;
  // everyone else sees the Active rows only (same rule as Customers).
  const showTabs = canDelete;
  const counts = data?.counts;
  const rows = data?.items ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasActions = canEdit || canDelete || rowActions !== undefined;
  const colCount =
    1 + columns.length + (canDelete ? 2 : 0) + (hasActions ? 1 : 0);
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
          {config.showTitle !== false && (
            <h2 className="text-2xl font-bold">{title}</h2>
          )}
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
          {config.searchable !== false && (
            <div className="relative w-full sm:w-auto">
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
                className="w-full rounded-full bg-[#e0d3ca] sm:w-64 py-2 pl-9 pr-3 placeholder:text-dark-grey focus:outline-none focus:ring-2 focus:ring-fire-light"
              />
            </div>
          )}
          {canAdd && (
            <button
              type="button"
              onClick={openAdd}
              className="flex items-center gap-2 rounded-md bg-fire px-4 py-2 text-white shadow-lg transition-colors duration-200 ease-in-out hover:bg-fire-light"
            >
              <i className="fa-solid fa-plus" aria-hidden="true" />
              {config.addLabel ?? `Add ${noun}`}
            </button>
          )}
        </div>
      </div>

      {/*----------Table----------*/}
      <Card className="overflow-x-auto p-2">
        <table
          className={`w-full text-left ${
            config.fitWidth
              ? "table-fixed [&_td]:px-3 [&_th]:px-3 [&_td:first-child]:whitespace-nowrap" // fixed layout: same column widths with or without rows
              : columns.length > 2
                ? "lg:min-w-[64rem]"
                : "min-w-[40rem]"
          }`}
        >
          <caption className="sr-only">{title}</caption>
          <thead className="text-sm text-dark-grey">
            <tr>
              <th
                scope="col"
                className={`px-4 py-3 font-semibold ${fit ? "w-[9rem]" : ""}`}
              >
                {codeLabel}
              </th>
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={`px-4 py-3 font-semibold ${col.align === "right" ? "text-right" : ""} ${fit ? (col.width ?? "") : ""} ${hideClass(col)}`}
                >
                  {col.label}
                </th>
              ))}
              {canDelete && (
                <>
                  <th
                    scope="col"
                    className={`px-4 py-3 font-semibold ${fit ? "w-[5.5rem]" : ""}`}
                  >
                    Status
                  </th>
                  <th
                    scope="col"
                    className={`px-4 py-3 font-semibold ${fit ? "w-[7rem]" : ""} ${STAMP_CELL}`}
                  >
                    Stamp
                  </th>
                </>
              )}
              {hasActions && (
                <th
                  scope="col"
                  className={`px-4 py-3 font-semibold ${fit ? "w-[5.5rem]" : ""}`}
                >
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
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-4 py-3 ${col.align === "right" ? "text-right" : ""} ${col.nowrap ? "whitespace-nowrap" : ""} ${hideClass(col)}`}
                    >
                      {cellOf(row, col)}
                    </td>
                  ))}
                  {canDelete && (
                    <>
                      <td className="px-4 py-3">
                        <Badge variant={deleted ? "danger" : "success"}>
                          {row.status}
                        </Badge>
                      </td>
                      <td
                        className={`px-4 py-3 text-sm text-dark-grey ${STAMP_CELL}`}
                      >
                        {row.stamp}
                      </td>
                    </>
                  )}
                  {hasActions && (
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {rowActions?.(row)}
                        {deleted ? (
                          canDelete && (
                            <button
                              type="button"
                              onClick={() => restore(row)}
                              disabled={busyCode === row.code}
                              aria-label={`Restore ${labelOf(row)}`}
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
                                aria-label={`Edit ${labelOf(row)}`}
                                className={actionButton}
                              >
                                Edit
                              </button>
                            )}
                            {canDelete && (
                              <button
                                type="button"
                                onClick={() => askDelete(row)}
                                aria-label={`Delete ${labelOf(row)}`}
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
          title={dialog.mode === "edit" ? `Edit ${noun}` : `Add ${noun}`}
          subtitle={dialogSubtitle}
          submitLabel={dialog.mode === "edit" ? "Save changes" : `Add ${noun}`}
          fields={dialogFields}
          initial={
            dialog.mode === "edit"
              ? Object.fromEntries(
                  dialogFields.map((f) => [
                    f.key,
                    String(dialog.row[f.key] ?? ""),
                  ]),
                )
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
          title={`Delete ${labelOf(pendingDelete)}?`}
          confirmLabel={`Delete ${noun}`}
          busyLabel="Deleting..."
          busy={deleting}
          error={deleteError}
          onConfirm={confirmDelete}
          onCancel={() => !deleting && setPendingDelete(null)}
        >
          <p>
            <b>{labelOf(pendingDelete)}</b>
            {config.hideCodeInMessages ? "" : ` (${pendingDelete.code})`} will
            be marked Inactive and hidden from the Active list.
          </p>
          <p className="mt-2 text-sm text-dark-grey">
            You can restore it later from the Inactive tab.{" "}
            {config.deleteNote ??
              `A ${noun} that still has job history cannot be deleted.`}
          </p>
        </ConfirmDialog>
      )}
    </div>
  );
}

export default LookupPanel;
