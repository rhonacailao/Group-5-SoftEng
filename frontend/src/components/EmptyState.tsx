import type { ReactNode } from "react";

type EmptyStateProps = {
  /** What is missing, e.g. "No products yet" */
  title: string;
  /** Why, or what to do next. One short sentence. */
  children?: ReactNode;
  /** Font Awesome icon name without the "fa-solid" part, e.g. "fa-box-open" */
  icon?: string;
  /** A button that fixes it, e.g. "Add product" or "Clear filters" */
  action?: ReactNode;
};

/**
 * The empty state: shown when a list has nothing to display, so a blank table is never
 * mistaken for a broken one. Put it inside a full-width table cell, or on its own.
 */
function EmptyState({
  title,
  children,
  icon = "fa-box-open",
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
      <i
        className={`fa-solid ${icon} text-3xl text-dark-grey`}
        aria-hidden="true"
      />
      <p className="text-lg font-semibold">{title}</p>
      {children && (
        <p className="max-w-sm text-sm text-dark-grey">{children}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export default EmptyState;
