import { tabs, type Counts, type Tab } from "../lib/products";

// Active / Inactive / All with counts. Only Admin and Superadmin get these.
function StatusTabs({
  label,
  tab,
  counts,
  onChange,
}: {
  label: string;
  tab: Tab;
  counts?: Counts;
  onChange: (tab: Tab) => void;
}) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-2">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={tab === t.id}
          onClick={() => onChange(t.id)}
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
  );
}

export default StatusTabs;
