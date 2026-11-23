import { useEffect, useRef, useState } from "react";
import { api, errorMessage } from "../lib/api";

// What GET /api/users/:id/rights sends: every module with its rights, and which ones this person holds
type RightRow = { code: string; description: string; granted: boolean };
type ModuleRow = { code: string; name: string; rights: RightRow[] };
type RightsResponse = { ok: true; modules: ModuleRow[] };

type RightsDialogProps = {
  userId: number;
  /** Name shown in the title, e.g. "Alex Rivera" */
  personName: string;
  /** Called after the server saved the rights */
  onSaved: () => void;
  onClose: () => void;
};

const moduleIcon: Record<string, string> = {
  CUSTOMER: "fa-users",
  PRODUCT: "fa-box",
  SALES: "fa-cart-shopping",
  HUMAN_RESOURCES: "fa-id-badge",
  REPORTS: "fa-chart-line",
};

const smallButton =
  "rounded-md border border-light-grey bg-white px-3 py-1 text-sm transition-colors duration-200 ease-in-out hover:bg-light-grey";

/**
 * Rights of one person, straight from the server.
 * The list of modules and rights is the real one from the database, and Save sends the complete
 * list of ticked rights to PUT /api/users/:id/rights. A person can open a module as soon as they
 * hold at least one right in it; each right then allows exactly one action.
 */
function RightsDialog({ userId, personName, onSaved, onClose }: RightsDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const [modules, setModules] = useState<ModuleRow[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  useEffect(() => {
    let stale = false;
    api<RightsResponse>(`/api/users/${userId}/rights`)
      .then((res) => {
        if (stale) return;
        setModules(res.modules);
        setPicked(
          new Set(res.modules.flatMap((m) => m.rights.filter((r) => r.granted).map((r) => r.code))),
        );
      })
      .catch((err) => {
        if (!stale) setLoadError(errorMessage(err));
      });
    return () => {
      stale = true;
    };
  }, [userId]);

  const toggleRight = (code: string) =>
    setPicked((current) => {
      const next = new Set(current);
      if (!next.delete(code)) next.add(code);
      return next;
    });

  // Module checkbox: everything in the module on, or (when it was all on) everything off
  const toggleModule = (m: ModuleRow) =>
    setPicked((current) => {
      const next = new Set(current);
      const allOn = m.rights.every((r) => next.has(r.code));
      for (const r of m.rights) {
        if (allOn) next.delete(r.code);
        else next.add(r.code);
      }
      return next;
    });

  const setAll = (on: boolean) =>
    setPicked(on ? new Set((modules ?? []).flatMap((m) => m.rights.map((r) => r.code))) : new Set());

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setSaveError("");
    try {
      await api(`/api/users/${userId}/rights`, { method: "PUT", body: { rights: [...picked] } });
      onSaved();
    } catch (err) {
      setSaveError(errorMessage(err)); // the dialog stays open so nothing ticked is lost
    } finally {
      setSaving(false);
    }
  };

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="rights-title"
      className="m-auto w-full max-w-xl rounded-xl bg-white p-0 text-dark shadow-lg backdrop:bg-dark/60"
    >
      <form
        method="dialog"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <header className="flex items-start justify-between gap-4 border-b border-light-grey p-6">
          <div>
            <h2 id="rights-title" className="text-2xl font-bold">
              Rights
            </h2>
            <p className="mt-1 text-sm text-dark-grey">
              What {personName} can open and do. A module opens as soon as one of its rights is
              ticked; each right allows one action.
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button type="button" onClick={() => setAll(true)} disabled={!modules} className={smallButton}>
              All
            </button>
            <button type="button" onClick={() => setAll(false)} disabled={!modules} className={smallButton}>
              None
            </button>
          </div>
        </header>

        <div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto p-6">
          {loadError && (
            <p role="alert" className="rounded-md bg-red-200 px-4 py-2 text-red-800">
              {loadError}
            </p>
          )}
          {!modules && !loadError && <p className="text-dark-grey">Loading rights...</p>}

          {modules?.map((m) => {
            const onCount = m.rights.filter((r) => picked.has(r.code)).length;
            const allOn = onCount === m.rights.length;
            return (
              <fieldset
                key={m.code}
                className={`rounded-md border p-4 ${onCount > 0 ? "border-fire bg-paper" : "border-light-grey"}`}
              >
                <legend className="sr-only">{m.name}</legend>
                <label className="flex cursor-pointer items-center gap-3 font-semibold">
                  <input
                    type="checkbox"
                    checked={allOn}
                    ref={(el) => {
                      if (el) el.indeterminate = onCount > 0 && !allOn;
                    }}
                    onChange={() => toggleModule(m)}
                    className="h-4 w-4 accent-fire"
                  />
                  <i className={`fa-solid ${moduleIcon[m.code] ?? "fa-folder"} fa-fw text-fire`} aria-hidden="true" />
                  {m.name}
                  <span className="text-sm font-normal text-dark-grey">
                    ({onCount}/{m.rights.length})
                  </span>
                </label>

                <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 pl-7">
                  {m.rights.map((r) => (
                    <label key={r.code} className="flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={picked.has(r.code)}
                        onChange={() => toggleRight(r.code)}
                        className="h-4 w-4 accent-fire"
                      />
                      {r.description}
                    </label>
                  ))}
                </div>
              </fieldset>
            );
          })}
        </div>

        {saveError && (
          <p role="alert" className="mx-6 mb-2 rounded-md bg-red-200 px-4 py-2 text-red-800">
            {saveError}
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
            disabled={!modules || saving}
            className="rounded-md bg-fire px-4 py-2 text-white shadow-lg transition-colors duration-200 ease-in-out hover:bg-fire-light disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save rights"}
          </button>
        </footer>
      </form>
    </dialog>
  );
}

export default RightsDialog;
