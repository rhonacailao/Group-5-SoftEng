import { useState } from "react";

type Toggle = { id: string; label: string; detail: string };

// Mock settings: the back end has no system settings endpoint yet.
const toggles: Toggle[] = [
  { id: "maintenance", label: "Maintenance mode", detail: "Only Superadmins can sign in while this is on." },
  { id: "registration", label: "Open registration", detail: "Let new people create an account without an invite." },
  { id: "approval", label: "Require approval for new accounts", detail: "An Admin must approve each new registration." },
  { id: "audit", label: "Audit log", detail: "Record who changed what across all modules." },
];

/** Superadmin only. Not the same as /settings, which holds general website settings. */
function SystemSettingsPage() {
  const [values, setValues] = useState<Record<string, boolean>>({
    maintenance: false,
    registration: true,
    approval: true,
    audit: true,
  });

  return (
    <section aria-labelledby="ss-title" className="p-8">
      <header className="mb-6">
        <h1 id="ss-title" className="text-3xl font-bold">
          System Settings
        </h1>
        <p className="mt-1 text-sm text-dark-grey">
          Superadmin only. These settings affect every account in the system.
        </p>
      </header>

      <ul className="flex max-w-3xl flex-col gap-3">
        {toggles.map((t) => (
          <li key={t.id} className="rounded-xl bg-paper p-4 shadow-lg">
            <label className="flex cursor-pointer items-center justify-between gap-6">
              <span>
                <span className="block font-semibold">{t.label}</span>
                <span className="block text-sm text-dark-grey">{t.detail}</span>
              </span>
              <input
                type="checkbox"
                role="switch"
                checked={values[t.id]}
                onChange={() => setValues((v) => ({ ...v, [t.id]: !v[t.id] }))}
                className="h-5 w-5 shrink-0 accent-fire"
              />
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default SystemSettingsPage;
