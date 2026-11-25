import { useEffect, useRef, useState } from "react";
import TextField from "./TextField";

export type LookupDialogValues = {
  code: string;
  name: string;
};

type LookupDialogProps = {
  /** Lower case, e.g. "job" or "department" */
  noun: string;
  codeLabel: string;
  nameLabel: string;
  codeMax: number;
  nameMax: number;
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
 * Add or edit a job or a department. Both are just a code and a name. The code is the primary
 * key, so it is typed when adding and shown read-only when editing. Status and Stamp are filled
 * in by the system, so they are not here.
 */
function LookupDialog({
  noun,
  codeLabel,
  nameLabel,
  codeMax,
  nameMax,
  initial,
  onSave,
  onClose,
  error,
  busy = false,
}: LookupDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const [values, setValues] = useState<LookupDialogValues>(
    initial ?? { code: "", name: "" },
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
      aria-labelledby="lookup-title"
      className="m-auto w-full max-w-lg rounded-xl bg-white p-0 text-dark shadow-lg backdrop:bg-dark/60"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave({
            code: values.code.trim().toUpperCase(),
            name: values.name.trim(),
          });
        }}
      >
        <header className="border-b border-light-grey p-6">
          <h2 id="lookup-title" className="text-2xl font-bold">
            {editing ? `Edit ${noun}` : `Add ${noun}`}
          </h2>
          {editing && (
            <p className="mt-1 text-sm text-dark-grey">
              {codeLabel} {initial.code}
            </p>
          )}
        </header>

        <div className="flex flex-col gap-4 p-6">
          {!editing && (
            <TextField
              id="lookup-code"
              label={codeLabel}
              maxLength={codeMax}
              value={values.code}
              onChange={(e) =>
                setValues((v) => ({
                  ...v,
                  code: e.target.value.toUpperCase(),
                }))
              }
            />
          )}
          <TextField
            id="lookup-name"
            label={nameLabel}
            maxLength={nameMax}
            value={values.name}
            onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
          />
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
            {editing ? "Save changes" : `Add ${noun}`}
          </button>
        </footer>
      </form>
    </dialog>
  );
}

export default LookupDialog;
