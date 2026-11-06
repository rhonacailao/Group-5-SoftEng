import { useEffect, useRef, useState } from "react";
import TextField from "./TextField";

export type PayTerm = "COD" | "30D" | "45D";

export const payTermLabels: Record<PayTerm, string> = {
  COD: "COD",
  "30D": "Net 30",
  "45D": "Net 45",
};

export type CustomerValues = {
  custname: string;
  address: string;
  payterm: PayTerm;
};

type CustomerDialogProps = {
  /** Customer number shown (read-only) in the title area, e.g. "C0021" */
  custno: string;
  /** Existing values when editing; leave out when adding */
  initial?: CustomerValues;
  onSave: (values: CustomerValues) => void;
  onClose: () => void;
};

/** Add or edit a customer. Status and Stamp are filled in by the system, so they are not here. */
function CustomerDialog({ custno, initial, onSave, onClose }: CustomerDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const [values, setValues] = useState<CustomerValues>(
    initial ?? { custname: "", address: "", payterm: "30D" },
  );
  const editing = initial !== undefined;

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="customer-title"
      className="m-auto w-full max-w-lg rounded-xl bg-white p-0 text-dark shadow-lg backdrop:bg-dark/60"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave({
            custname: values.custname.trim(),
            address: values.address.trim(),
            payterm: values.payterm,
          });
        }}
      >
        <header className="border-b border-light-grey p-6">
          <h2 id="customer-title" className="text-2xl font-bold">
            {editing ? "Edit customer" : "Add customer"}
          </h2>
          <p className="mt-1 text-sm text-dark-grey">Customer no. {custno}</p>
        </header>

        <div className="flex flex-col gap-4 p-6">
          <TextField
            id="custname"
            label="Customer name"
            maxLength={20}
            value={values.custname}
            onChange={(e) => setValues((v) => ({ ...v, custname: e.target.value }))}
          />
          <TextField
            id="address"
            label="Address"
            maxLength={50}
            value={values.address}
            onChange={(e) => setValues((v) => ({ ...v, address: e.target.value }))}
          />
          <div className="flex flex-col gap-1">
            <label htmlFor="payterm" className="text-md font-semibold">
              Pay terms
            </label>
            <select
              id="payterm"
              name="payterm"
              value={values.payterm}
              onChange={(e) => setValues((v) => ({ ...v, payterm: e.target.value as PayTerm }))}
              className="w-full rounded-sm border border-dark-grey bg-white px-4 py-2 text-dark shadow-lg focus:outline-none focus:ring-2 focus:ring-fire-light"
            >
              {(Object.keys(payTermLabels) as PayTerm[]).map((p) => (
                <option key={p} value={p}>
                  {payTermLabels[p]}
                </option>
              ))}
            </select>
          </div>
        </div>

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
            className="rounded-md bg-fire px-4 py-2 text-white shadow-lg hover:bg-fire-light"
          >
            {editing ? "Save changes" : "Add customer"}
          </button>
        </footer>
      </form>
    </dialog>
  );
}

export default CustomerDialog;
