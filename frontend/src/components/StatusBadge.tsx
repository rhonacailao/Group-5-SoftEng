import type { Status } from "../lib/products";

/** Green "Active" or red "Inactive" pill. */
function StatusBadge({ status }: { status: Status }) {
  return (
    <span
      className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
        status === "Inactive"
          ? "border-red-900 bg-red-300 text-red-800"
          : "border-green-900 bg-green-300 text-green-800"
      }`}
    >
      {status}
    </span>
  );
}

export default StatusBadge;
