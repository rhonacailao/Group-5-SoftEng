import type { ReactNode } from "react";

export type BadgeVariant =
  | "info"
  | "success"
  | "danger"
  | "warning"
  | "dark"
  | "neutral"
  | "accent";

// Full class names are written out so Tailwind can find them.
const variants: Record<BadgeVariant, string> = {
  info: "border-blue-900 bg-blue-300 text-blue-800",
  success: "border-green-900 bg-green-300 text-green-800",
  danger: "border-red-900 bg-red-300 text-red-800",
  warning: "border-yellow-900 bg-yellow-200 text-yellow-900",
  dark: "border-dark bg-dark text-white",
  neutral: "border-dark-grey bg-cream text-dark",
  accent: "border-fire bg-fire-light/30 text-dark",
};

type BadgeProps = {
  variant: BadgeVariant;
  className?: string;
  children: ReactNode;
};

/** Small pill for statuses and roles. One size, border and weight everywhere. */
function Badge({ variant, className = "", children }: BadgeProps) {
  return (
    <span
      className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${variants[variant]} ${className}`.trim()}
    >
      {children}
    </span>
  );
}

export default Badge;
