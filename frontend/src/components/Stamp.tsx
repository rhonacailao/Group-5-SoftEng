import type { ApiStamp } from "../lib/products";
import { toStamp } from "../lib/stamp";

// Colour of the small action badge (same idea as the Baikolano design: CREATED, EDITED, DELETED, RESTORED)
const badge: Record<string, string> = {
  CREATED: "border-green-900 bg-green-300 text-green-800",
  EDITED: "border-amber-900 bg-amber-200 text-amber-900",
  DELETED: "border-red-900 bg-red-300 text-red-800",
  RESTORED: "border-sky-900 bg-sky-200 text-sky-900",
};

/** Who did the last thing to a row, and when: a coloured action tag, the name, then the date. */
function Stamp({ value }: { value: ApiStamp | string | null | undefined }) {
  const stamp = toStamp(value);
  if (!stamp) return <span aria-hidden="true">—</span>;
  return (
    <span className="inline-grid min-w-[7rem] grid-cols-[auto_1fr] items-center gap-x-1.5 gap-y-0.5">
      <b
        className={`w-fit rounded border px-1.5 py-px text-[0.65rem] font-semibold tracking-wide ${
          badge[stamp.action] ?? badge.CREATED
        }`}
      >
        {stamp.action}
      </b>
      <span className="text-xs font-semibold text-dark-grey">{stamp.user}</span>
      {stamp.date && <small className="col-span-2 text-[0.7rem] text-dark-grey">{stamp.date}</small>}
    </span>
  );
}

export default Stamp;
