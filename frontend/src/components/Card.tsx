import type { ComponentPropsWithoutRef, ElementType } from "react";

type CardProps<T extends ElementType = "div"> = {
  as?: T;
  className?: string;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "className">;

/**
 * Shared card surface: paper background, rounded corners and one standard shadow.
 * Padding and layout stay with the caller (className), because they vary per use.
 */
function Card<T extends ElementType = "div">({
  as,
  className = "",
  ...props
}: CardProps<T>) {
  const Component: ElementType = as ?? "div";
  return (
    <Component
      className={`rounded-xl bg-paper shadow-lg ${className}`.trim()}
      {...props}
    />
  );
}

export default Card;
