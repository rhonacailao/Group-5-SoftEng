import { useEffect, useRef, useState } from "react";
import TextField from "./TextField";

/** One input of the form. Jobs and departments have a code and a name; employees have more. */
export type LookupField = {
  /** Name of the value in the object sent to the server, e.g. "lastName" */
  key: string;
  label: string;
  /** Default "text" */
  type?: "text" | "date" | "select";
  maxLength?: number;
  /** Small help text under the input */
  hint?: string;
  /** For type "select" */
  options?: { value: string; label: string }[];
  /** Typed in capitals, for codes */
  uppercase?: boolean;
};

export type LookupDialogValues = Record<string, string>;

type LookupDialogProps = {
  /** "Add job", "Edit employee"... */
  title: string;
  /** Under the title: the part that cannot be edited, e.g. "Job code PRES" */
  subtitle?: string;
  /** Text of the save button */
  submitLabel: string;
  fields: LookupField[];
  /** Existing values when editing; leave out when adding */
  initial?: LookupDialogValues;
  onSave: (values: LookupDialogValues) => void;
  onClose: () => void;
  /** Message from the server (e.g. "Job code is required."), shown above the buttons */
  error?: string;
  /** True while the request is running, so the form cannot be sent twice */
  busy?: boolean;
};

/**
 * Add or edit one row of a LookupPanel table. The panel decides which fields are shown: a key
 * that is typed when adding (the job code) is left out when editing and shown in the subtitle
 * instead, and a key the system assigns (the employee number) is never a field. Status and Stamp
 * are filled in by the system, so they are not here.
 */
function LookupDialog({
  title,
  subtitle,
  submitLabel,
  fields,
  initial,
  onSave,
  onClose,
  error,
  busy = false,
}: LookupDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const [values, setValues] = useState<LookupDialogValues>(() =>
    Object.fromEntries(fields.map((f) => [f.key, initial?.[f.key] ?? ""])),
  );

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const setValue = (field: LookupField, raw: string) =>
    setValues((v) => ({
      ...v,
      [field.key]: field.uppercase ? raw.toUpperCase() : raw,
    }));

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="lookup-title"
      className="m-auto w-full max-w-lg rounded-xl bg-white p-0 text-dark shadow-lg backdrop:bg-dark/60"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(
            Object.fromEntries(
              fields.map((f) => {
                const value = (values[f.key] ?? "").trim();
                return [f.key, f.uppercase ? value.toUpperCase() : value];
              }),
            ),
          );
        }}
      >
        <header className="border-b border-light-grey p-6">
          <h2 id="lookup-title" className="text-2xl font-bold">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-1 text-sm text-dark-grey">{subtitle}</p>
          )}
        </header>

        <div className="flex flex-col gap-4 p-6">
          {fields.map((f) => {
            const id = `lookup-${f.key}`;
            const hint = f.hint && (
              <p className="mt-1 text-xs text-dark-grey">{f.hint}</p>
            );
            if (f.type === "select") {
              return (
                <div key={f.key}>
                  <label htmlFor={id} className="mb-1 block font-semibold">
                    {f.label}
                  </label>
                  <select
                    id={id}
                    value={values[f.key] ?? ""}
                    onChange={(e) => setValue(f, e.target.value)}
                    className="w-full rounded-md bg-[#e0d3ca] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-fire-light"
                  >
                    <option value="">Select...</option>
                    {f.options?.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  {hint}
                </div>
              );
            }
            return (
              <div key={f.key}>
                <TextField
                  id={id}
                  label={f.label}
                  type={f.type === "date" ? "date" : undefined}
                  maxLength={f.maxLength}
                  value={values[f.key] ?? ""}
                  onChange={(e) => setValue(f, e.target.value)}
                />
                {hint}
              </div>
            );
          })}
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
            className="rounded-md border border-light-grey bg-white px-4 py-2 transition-colors duration-200 ease-in-out hover:bg-light-grey"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-md bg-fire px-4 py-2 text-white shadow-lg transition-colors duration-200 ease-in-out hover:bg-fire-light disabled:opacity-60"
          >
            {submitLabel}
          </button>
        </footer>
      </form>
    </dialog>
  );
}

export default LookupDialog;
