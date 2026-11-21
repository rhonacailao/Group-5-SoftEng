import { useEffect, useRef, useState } from "react";
import TextField from "./TextField";
import { unitLabels, unitOptions, type Unit } from "../lib/units";

export type ProductValues = {
  prodcode: string;
  description: string;
  unit: Unit;
};

type ProductDialogProps = {
  /** Existing values when editing; leave out when adding */
  initial?: ProductValues;
  onSave: (values: ProductValues) => void;
  onClose: () => void;
  /** Message from the server (e.g. "Description is required."), shown above the buttons */
  error?: string;
  /** True while the request is running, so the form cannot be sent twice */
  busy?: boolean;
};

/**
 * Add or edit a product. The product code is typed when adding and is read-only when editing,
 * because sales and price history point at it. Status is set by the system (delete / restore are
 * separate steps), so it is not here.
 */
function ProductDialog({
  initial,
  onSave,
  onClose,
  error,
  busy = false,
}: ProductDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const [values, setValues] = useState<ProductValues>(
    initial ?? { prodcode: "", description: "", unit: "ea" },
  );
function ProductDialog({ initial, onSave, onClose, error, busy = false }: ProductDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const [values, setValues] = useState<ProductValues>(initial ?? { prodcode: "", description: "", unit: "ea" });
  const editing = initial !== undefined;

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="product-title"
      className="m-auto w-full max-w-lg rounded-xl bg-white p-0 text-dark shadow-lg backdrop:bg-dark/60"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (busy) return;
          onSave({
            prodcode: values.prodcode.trim().toUpperCase(),
            description: values.description.trim(),
            unit: values.unit,
          });
        }}
      >
        <header className="border-b border-light-grey p-6">
          <h2 id="product-title" className="text-2xl font-bold">
            {editing ? "Edit product" : "Add product"}
          </h2>
          {editing && (
            <p className="mt-1 text-sm text-dark-grey">
              Product code {values.prodcode}
            </p>
          )}
          {editing && <p className="mt-1 text-sm text-dark-grey">Product code {values.prodcode}</p>}
        </header>

        <div className="flex flex-col gap-4 p-6">
          {!editing && (
            <div className="flex flex-col gap-1">
              <TextField
                id="prodcode"
                label="Product code"
                maxLength={6}
                placeholder="AD0001"
                autoComplete="off"
                value={values.prodcode}
                onChange={(e) =>
                  setValues((v) => ({
                    ...v,
                    prodcode: e.target.value.toUpperCase(),
                  }))
                }
              />
              <p className="text-sm text-dark-grey">
                Two letters and four digits. It cannot be changed later.
              </p>
                onChange={(e) => setValues((v) => ({ ...v, prodcode: e.target.value.toUpperCase() }))}
              />
              <p className="text-sm text-dark-grey">Two letters and four digits. It cannot be changed later.</p>
            </div>
          )}
          <TextField
            id="description"
            label="Description"
            maxLength={30}
            value={values.description}
            onChange={(e) =>
              setValues((v) => ({ ...v, description: e.target.value }))
            }
            onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
          />
          <div className="flex flex-col gap-1">
            <label htmlFor="unit" className="text-md font-semibold">
              Unit
            </label>
            <select
              id="unit"
              name="unit"
              value={values.unit}
              onChange={(e) =>
                setValues((v) => ({ ...v, unit: e.target.value as Unit }))
              }
              onChange={(e) => setValues((v) => ({ ...v, unit: e.target.value as Unit }))}
              className="w-full rounded-sm border border-dark-grey bg-white px-4 py-2 text-dark shadow-lg focus:outline-none focus:ring-2 focus:ring-fire-light"
            >
              {unitOptions.map((u) => (
                <option key={u} value={u}>
                  {unitLabels[u]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <p role="alert" className="px-6 pb-2 text-sm text-red-800">
            {error}
          </p>
        )}

        <footer className="flex justify-end gap-3 border-t border-light-grey p-6">
          <button
            type="button"
            onClick={() => ref.current?.close()}
            className="rounded-md border border-light-grey bg-white px-4 py-2 hover:bg-light-grey"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-md bg-fire px-4 py-2 text-white shadow-lg hover:bg-fire-light disabled:opacity-60"
          >
            {editing ? "Save changes" : "Add product"}
          </button>
        </footer>
      </form>
    </dialog>
  );
}

export default ProductDialog;
