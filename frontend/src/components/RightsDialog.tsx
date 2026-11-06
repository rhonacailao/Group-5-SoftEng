import { useEffect, useRef, useState } from "react";
import { actions, modules, type ActionId, type ModuleId, type Rights } from "../lib/roles";

type RightsDialogProps = {
  /** Name shown in the title, e.g. "Alex Rivera" */
  personName: string;
  initialRights: Rights;
  onSave: (rights: Rights) => void;
  onClose: () => void;
};

/**
 * Checkboxes grouped by module.
 * Ticking a module switches it on; the boxes under it decide what the person may do there.
 * "All" and "None" are shortcuts.
 */
function RightsDialog({ personName, initialRights, onSave, onClose }: RightsDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const [rights, setRights] = useState<Rights>(initialRights);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const toggleModule = (id: ModuleId) =>
    setRights((r) => {
      const on = !r[id].enabled;
      // Switching a module on gives view access by default; switching it off clears the rest.
      return { ...r, [id]: { enabled: on, actions: on ? ["view"] : [] } };
    });

  const toggleAction = (id: ModuleId, action: ActionId) =>
    setRights((r) => {
      const has = r[id].actions.includes(action);
      return {
        ...r,
        [id]: {
          ...r[id],
          actions: has ? r[id].actions.filter((a) => a !== action) : [...r[id].actions, action],
        },
      };
    });

  const setAll = (on: boolean) => {
    const next = {} as Rights;
    for (const m of modules) {
      next[m.id] = { enabled: on, actions: on ? actions.map((a) => a.id) : [] };
    }
    setRights(next);
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
          onSave(rights);
        }}
      >
        <header className="flex items-start justify-between gap-4 border-b border-light-grey p-6">
          <div>
            <h2 id="rights-title" className="text-2xl font-bold">
              Rights
            </h2>
            <p className="mt-1 text-sm text-dark-grey">
              What {personName} can open and do. Tick a module to switch it on, then choose what they may do there.
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => setAll(true)}
              className="rounded-md border border-light-grey bg-white px-3 py-1 text-sm hover:bg-light-grey"
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setAll(false)}
              className="rounded-md border border-light-grey bg-white px-3 py-1 text-sm hover:bg-light-grey"
            >
              None
            </button>
          </div>
        </header>

        <div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto p-6">
          {modules.map((m) => {
            const state = rights[m.id];
            return (
              <fieldset
                key={m.id}
                className={`rounded-md border p-4 ${
                  state.enabled ? "border-fire bg-paper" : "border-light-grey"
                }`}
              >
                <legend className="sr-only">{m.label}</legend>
                <label className="flex cursor-pointer items-center gap-3 font-semibold">
                  <input
                    type="checkbox"
                    checked={state.enabled}
                    onChange={() => toggleModule(m.id)}
                    className="h-4 w-4 accent-fire"
                  />
                  <i className={`fa-solid ${m.icon} fa-fw text-fire`} aria-hidden="true" />
                  {m.label}
                </label>

                <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 pl-7">
                  {actions.map((a) => (
                    <label
                      key={a.id}
                      className={`flex items-center gap-2 text-sm ${
                        state.enabled ? "cursor-pointer" : "cursor-not-allowed text-dark-grey"
                      }`}
                    >
                      <input
                        type="checkbox"
                        disabled={!state.enabled}
                        checked={state.actions.includes(a.id)}
                        onChange={() => toggleAction(m.id, a.id)}
                        className="h-4 w-4 accent-fire"
                      />
                      {a.label}
                    </label>
                  ))}
                </div>
              </fieldset>
            );
          })}
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
            Save rights
          </button>
        </footer>
      </form>
    </dialog>
  );
}

export default RightsDialog;
