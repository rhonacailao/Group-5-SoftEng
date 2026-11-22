import { useEffect, useRef, useState, type FormEvent } from "react";
import ConfirmDialog from "./ConfirmDialog";
import EmptyState from "./EmptyState";
import ErrorBanner from "./ErrorBanner";
import TextField from "./TextField";
import { describeError, type ErrorInfo } from "../lib/errorInfo";
import { priceApi } from "../lib/productApi";
import {
  actionButton,
  dangerButton,
  money,
  saveMessage,
  today,
  type ApiPrice,
  type ApiProduct,
  type PriceListResponse,
} from "../lib/products";
import { unitLabels } from "../lib/units";

export type PriceCan = { add: boolean; edit: boolean; remove: boolean };

type PriceForm = { mode: "add" | "edit"; effDate: string; unitPrice: string };

type PriceHistoryDialogProps = {
  product: ApiProduct;
  can: PriceCan;
  demo: boolean;
  onClose: () => void;
  /** Called after any change, so the product list can show the new current price */
  onChanged: () => void;
};

// Price history of one product (S2-DEV-07 / S2-DEV-08).
// Everyone who can open the page sees the same table; the rights decide who may add, edit or
// delete. Deleting a price is permanent (the price table has no soft delete), so it asks first.
function PriceHistoryDialog({
  product,
  can,
  demo,
  onClose,
  onChanged,
}: PriceHistoryDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const code = product.prodCode;

  const [data, setData] = useState<PriceListResponse | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [listError, setListError] = useState<ErrorInfo | null>(null);
  const [actionError, setActionError] = useState<ErrorInfo | null>(null);
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState<PriceForm | null>(null);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  // Confirm-delete state: the price waiting for a yes, and what happened when we asked the server
  const [pendingDelete, setPendingDelete] = useState<ApiPrice | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<ErrorInfo | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  useEffect(() => {
    let stale = false;
    priceApi
      .list(demo, code)
      .then((res) => {
        if (stale) return;
        setData(res);
        setListError(null);
      })
      .catch((err) => {
        if (!stale) setListError(describeError(err));
      });
    return () => {
      stale = true;
    };
  }, [demo, code, reloadKey]);

  const reload = () => setReloadKey((k) => k + 1);
  const changed = () => {
    reload();
    onChanged();
  };

  // ---------- add and edit ----------
  const openAdd = () => {
    setFormError("");
    setNotice("");
    setForm({ mode: "add", effDate: today(), unitPrice: "" });
  };
  const openEdit = (p: ApiPrice) => {
    setFormError("");
    setNotice("");
    setForm({
      mode: "edit",
      effDate: p.effDate,
      unitPrice: String(Number(p.unitPrice)),
    });
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form || saving) return;
    // Quick checks so the obvious mistakes never leave the browser; the server checks again
    const amount = Number(form.unitPrice);
    if (!form.effDate) return setFormError("Effective date is required.");
    if (!Number.isFinite(amount) || amount <= 0)
      return setFormError("Unit price must be greater than zero.");
    if (Math.round(amount * 100) / 100 !== amount)
      return setFormError("Unit price can have at most two decimals.");

    setSaving(true);
    try {
      if (form.mode === "edit") {
        await priceApi.update(demo, code, form.effDate, { unitPrice: amount });
        setNotice(`Saved the price starting ${form.effDate}.`);
      } else {
        await priceApi.add(demo, code, {
          effDate: form.effDate,
          unitPrice: amount,
        });
        setNotice(`Added a price starting ${form.effDate}.`);
      }
      setForm(null);
      setActionError(null);
      changed();
    } catch (err) {
      setFormError(saveMessage(err)); // the form stays open so nothing typed is lost
    } finally {
      setSaving(false);
    }
  };

  // ---------- delete (permanent, so it asks first) ----------
  const askDelete = (p: ApiPrice) => {
    setDeleteError(null);
    setActionError(null);
    setNotice("");
    setPendingDelete(p);
  };

  const confirmDelete = async () => {
    if (!pendingDelete || deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await priceApi.remove(demo, code, pendingDelete.effDate);
      setNotice(`Deleted the price starting ${pendingDelete.effDate}.`);
      setPendingDelete(null);
      changed();
    } catch (err) {
      // e.g. "earlier sales would be left without a price": shown inside the confirm dialog
      setDeleteError(describeError(err));
      reload(); // someone else may have changed it: show what is really there
    } finally {
      setDeleting(false);
    }
  };

  const rows = data?.prices ?? [];
  const showActions = can.edit || can.remove;
  const colCount = showActions ? 3 : 2;
  const loading = data === null && !listError;

  return (
    <>
      <dialog
        ref={ref}
        onClose={onClose}
        aria-labelledby="price-history-title"
        className="m-auto max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-0 text-dark shadow-lg backdrop:bg-dark/60"
      >
        <header className="border-b border-light-grey p-6">
          <h2 id="price-history-title" className="text-2xl font-bold">
            Price history · {code}
          </h2>
          <p className="mt-1 text-sm text-dark-grey">
            {product.description} · Unit: {unitLabels[product.unit]}
          </p>
        </header>

        <div className="flex flex-col gap-4 p-6">
          {/* Error state: a failed refresh keeps the old table and says why */}
          {listError && data && (
            <ErrorBanner
              title={listError.title}
              message={listError.message}
              onRetry={reload}
            />
          )}
          {actionError && (
            <ErrorBanner
              title={actionError.title}
              message={actionError.message}
              onDismiss={() => setActionError(null)}
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

          {can.add && !form && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={openAdd}
                className="flex items-center gap-2 rounded-md bg-fire px-4 py-2 text-white shadow-lg hover:bg-fire-light"
              >
                <i className="fa-solid fa-plus" aria-hidden="true" />
                Add price
              </button>
            </div>
          )}

          {/*----------Add / edit form----------*/}
          {form && (
            <form
              onSubmit={submit}
              className="flex flex-col gap-4 rounded-xl bg-paper p-4"
              noValidate
            >
              <h3 className="text-lg font-bold">
                {form.mode === "edit"
                  ? `Edit price starting ${form.effDate}`
                  : "Add price"}
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <TextField
                    id="price-effdate"
                    label="Effective date"
                    type="date"
                    value={form.effDate}
                    // The date identifies the price, so it cannot change
                    disabled={form.mode === "edit"}
                    onChange={(e) =>
                      setForm({ ...form, effDate: e.target.value })
                    }
                  />
                  <p className="text-sm text-dark-grey">
                    {form.mode === "edit"
                      ? "To change the date, delete this price and add a new one."
                      : "The price applies from this date. A future date is allowed."}
                  </p>
                </div>
                <TextField
                  id="price-unitprice"
                  label="Unit price (USD)"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={form.unitPrice}
                  onChange={(e) =>
                    setForm({ ...form, unitPrice: e.target.value })
                  }
                />
              </div>
              {formError && (
                <p role="alert" className="text-sm text-red-800">
                  {formError}
                </p>
              )}
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setForm(null)}
                  className="rounded-md border border-light-grey bg-white px-4 py-2 hover:bg-light-grey"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-md bg-fire px-4 py-2 text-white shadow-lg hover:bg-fire-light disabled:opacity-60"
                >
                  {form.mode === "edit" ? "Save price" : "Add price"}
                </button>
              </div>
            </form>
          )}

          {/*----------Table----------*/}
          <div className="overflow-x-auto rounded-xl bg-paper p-2 shadow-lg">
            <table className="w-full min-w-[24rem] text-left">
              <caption className="sr-only">Price history of {code}</caption>
              <thead className="text-sm text-dark-grey">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Effective date
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Unit price
                  </th>
                  {showActions && (
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
                      Loading prices...
                    </td>
                  </tr>
                )}
                {/* Error state, first load: the table itself explains and offers a retry */}
                {listError && !data && (
                  <tr className="border-t border-light-grey">
                    <td colSpan={colCount}>
                      <EmptyState
                        icon="fa-triangle-exclamation"
                        title="Couldn't load the prices"
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
                {/* Empty state */}
                {data && rows.length === 0 && (
                  <tr className="border-t border-light-grey">
                    <td colSpan={colCount}>
                      <EmptyState
                        icon="fa-tag"
                        title="No prices yet"
                        action={
                          can.add && !form ? (
                            <button
                              type="button"
                              onClick={openAdd}
                              className={actionButton}
                            >
                              Add the first price
                            </button>
                          ) : undefined
                        }
                      >
                        This product has no price, so the product list shows a
                        dash as its current price.
                      </EmptyState>
                    </td>
                  </tr>
                )}
                {rows.map((p) => (
                  <tr key={p.effDate} className="border-t border-light-grey">
                    <td className="px-4 py-3">
                      <span className="font-semibold">{p.effDate}</span>
                      {p.state === "Current" && (
                        <span className="ml-2 rounded-full border border-green-900 bg-green-300 px-2 py-0.5 text-xs font-semibold text-green-800">
                          Current
                        </span>
                      )}
                      {p.state === "Upcoming" && (
                        <span className="ml-2 rounded-full border border-dark-grey bg-cream px-2 py-0.5 text-xs font-semibold text-dark">
                          Scheduled
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-semibold">
                      {money(p.unitPrice)}
                    </td>
                    {showActions && (
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          {can.edit && (
                            <button
                              type="button"
                              onClick={() => openEdit(p)}
                              aria-label={`Edit the price starting ${p.effDate}`}
                              className={actionButton}
                            >
                              Edit
                            </button>
                          )}
                          {can.remove && (
                            <button
                              type="button"
                              onClick={() => askDelete(p)}
                              aria-label={`Delete the price starting ${p.effDate}`}
                              className={dangerButton}
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <footer className="flex justify-end border-t border-light-grey p-6">
          <button
            type="button"
            onClick={() => ref.current?.close()}
            className="rounded-md border border-light-grey bg-white px-4 py-2 hover:bg-light-grey"
          >
            Close
          </button>
        </footer>
      </dialog>

      {/* Confirm-delete state. A price is removed for good, so say so before it happens. */}
      {pendingDelete && (
        <ConfirmDialog
          title="Delete this price?"
          confirmLabel="Delete price"
          busyLabel="Deleting..."
          busy={deleting}
          error={deleteError}
          onConfirm={confirmDelete}
          onCancel={() => !deleting && setPendingDelete(null)}
        >
          <p>
            The price of <b>{money(pendingDelete.unitPrice)}</b> starting{" "}
            <b>{pendingDelete.effDate}</b> will be permanently removed.{" "}
            <b>This cannot be undone.</b>
          </p>
          {pendingDelete.state === "Current" && (
            <p className="mt-2 text-sm text-dark-grey">
              It is the current price, so the product will fall back to the
              price before it, if there is one.
            </p>
          )}
        </ConfirmDialog>
      )}
    </>
  );
}

export default PriceHistoryDialog;
