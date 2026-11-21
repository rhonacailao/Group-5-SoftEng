import { useEffect, useRef, useState, type FormEvent } from "react";
import StatusBadge from "./StatusBadge";
import StatusTabs from "./StatusTabs";
import TextField from "./TextField";
import { errorMessage } from "../lib/api";
import { priceApi } from "../lib/productApi";
import {
  actionButton,
  currentEffDate,
  dangerButton,
  money,
  saveMessage,
  today,
  type ApiPrice,
  type ApiProduct,
  type PriceListResponse,
  type Tab,
} from "../lib/products";
import { unitLabels } from "../lib/units";

export type PriceCan = { add: boolean; edit: boolean; remove: boolean };

type PriceForm = { mode: "add" | "edit"; effDate: string; unitPrice: string };

type PriceHistoryDialogProps = {
  product: ApiProduct;
  /** Admin / Superadmin: sees deleted prices, Status and Stamp */
  privileged: boolean;
  can: PriceCan;
  demo: boolean;
  onClose: () => void;
  /** Called after any change, so the product list can show the new current price */
  onChanged: () => void;
};

function PriceHistoryDialog({
  product,
  privileged,
  can,
  demo,
  onClose,
  onChanged,
}: PriceHistoryDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const code = product.prodCode;

  const [tab, setTab] = useState<Tab>("active");
  const [data, setData] = useState<PriceListResponse | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [listError, setListError] = useState("");
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyDate, setBusyDate] = useState<string | null>(null);
  const [form, setForm] = useState<PriceForm | null>(null);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  // A User only ever sees Active prices
  const effectiveTab: Tab = privileged ? tab : "active";
  const error = actionError || listError;

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  useEffect(() => {
    let stale = false;
    priceApi
      .list(demo, code, effectiveTab)
      .then((res) => {
        if (stale) return;
        setData(res);
        setListError("");
      })
      .catch((err) => {
        if (!stale) setListError(errorMessage(err));
      });
    return () => {
      stale = true;
    };
  }, [demo, code, effectiveTab, reloadKey]);

  const changed = () => {
    setReloadKey((k) => k + 1);
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
        setNotice(`Saved the price effective ${form.effDate}.`);
      } else {
        await priceApi.add(demo, code, {
          effDate: form.effDate,
          unitPrice: amount,
        });
        setNotice(`Added a price effective ${form.effDate}.`);
      }
      setForm(null);
      changed();
    } catch (err) {
      setFormError(saveMessage(err)); // the form stays open so nothing typed is lost
    } finally {
      setSaving(false);
    }
  };

  // ---------- soft delete and restore ----------
  const softDelete = async (p: ApiPrice) => {
    const ok = window.confirm(
      `Delete the price of ${money(p.unitPrice)} effective ${p.effDate}?\n\nIt will be marked Inactive${
        privileged ? " and can be restored later." : "."
      }`,
    );
    if (!ok) return;
    await run(
      p.effDate,
      () => priceApi.remove(demo, code, p.effDate),
      `Deleted the price effective ${p.effDate}.`,
    );
  };
  const restore = (p: ApiPrice) =>
    run(
      p.effDate,
      () => priceApi.restore(demo, code, p.effDate),
      `Restored the price effective ${p.effDate}.`,
    );

  const run = async (
    effDate: string,
    action: () => Promise<unknown>,
    success: string,
  ) => {
    setBusyDate(effDate);
    setActionError("");
    setNotice("");
    try {
      await action();
      setNotice(success);
      changed();
    } catch (err) {
      setActionError(errorMessage(err));
      setReloadKey((k) => k + 1); // someone else may have changed it: show what is really there
    } finally {
      setBusyDate(null);
    }
  };

  // Defensive: a User never sees a deleted price, whatever the server sent
  const rows = (data?.prices ?? []).filter(
    (p) => privileged || p.status === "Active",
  );
  const current = currentEffDate(rows);
  const colCount = 3 + (privileged ? 2 : 0);
  const loading = data === null && !error;

  return (
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
        {error && (
          <p
            role="alert"
            className="rounded-md bg-red-200 px-4 py-2 text-red-800"
          >
            {error}
          </p>
        )}
        {notice && (
          <p
            role="status"
            className="rounded-md bg-green-300 px-4 py-2 text-green-800"
          >
            {notice}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          {privileged ? (
            <StatusTabs
              label="Price status"
              tab={tab}
              counts={data?.counts}
              onChange={setTab}
            />
          ) : (
            <span />
          )}
          {can.add && !form && (
            <button
              type="button"
              onClick={openAdd}
              className="flex items-center gap-2 rounded-md bg-fire px-4 py-2 text-white shadow-lg hover:bg-fire-light"
            >
              <i className="fa-solid fa-plus" aria-hidden="true" />
              Add price
            </button>
          )}
        </div>

        {/*----------Add / edit form----------*/}
        {form && (
          <form
            onSubmit={submit}
            className="flex flex-col gap-4 rounded-xl bg-paper p-4"
            noValidate
          >
            <h3 className="text-lg font-bold">
              {form.mode === "edit"
                ? `Edit price effective ${form.effDate}`
                : "Add price"}
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <TextField
                  id="price-effdate"
                  label="Effective date"
                  type="date"
                  value={form.effDate}
                  // The date is part of the key and old sales depend on it, so it cannot change
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
          <table className="w-full min-w-[30rem] text-left">
            <caption className="sr-only">Price history of {code}</caption>
            <thead className="text-sm text-dark-grey">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Effective date
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Unit price
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
                    Loading prices...
                  </td>
                </tr>
              )}
              {!loading && rows.length === 0 && (
                <tr className="border-t border-light-grey">
                  <td
                    colSpan={colCount}
                    className="px-4 py-8 text-center text-dark-grey"
                  >
                    No prices found for this product.
                  </td>
                </tr>
              )}
              {rows.map((p) => {
                const deleted = p.status === "Inactive";
                const scheduled = !deleted && p.effDate > today();
                return (
                  <tr
                    key={p.effDate}
                    className={`border-t border-light-grey ${deleted ? "bg-cream" : ""}`}
                  >
                    <td className="px-4 py-3">
                      <span className="font-semibold">{p.effDate}</span>
                      {p.effDate === current && (
                        <span className="ml-2 rounded-full border border-green-900 bg-green-300 px-2 py-0.5 text-xs font-semibold text-green-800">
                          Current
                        </span>
                      )}
                      {scheduled && (
                        <span className="ml-2 rounded-full border border-dark-grey bg-cream px-2 py-0.5 text-xs font-semibold text-dark">
                          Scheduled
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-semibold">
                      {money(p.unitPrice)}
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
                        {!deleted && can.edit && (
                          <button
                            type="button"
                            onClick={() => openEdit(p)}
                            disabled={busyDate === p.effDate}
                            aria-label={`Edit the price effective ${p.effDate}`}
                            className={actionButton}
                          >
                            Edit
                          </button>
                        )}
                        {!deleted && can.remove && (
                          <button
                            type="button"
                            onClick={() => softDelete(p)}
                            disabled={busyDate === p.effDate}
                            aria-label={`Delete the price effective ${p.effDate}`}
                            className={dangerButton}
                          >
                            Delete
                          </button>
                        )}
                        {deleted && can.remove && (
                          <button
                            type="button"
                            onClick={() => restore(p)}
                            disabled={busyDate === p.effDate}
                            aria-label={`Restore the price effective ${p.effDate}`}
                            className={actionButton}
                          >
                            Restore
                          </button>
                        )}
                        {(deleted ? !can.remove : !can.edit && !can.remove) && (
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
  );
}

export default PriceHistoryDialog;
