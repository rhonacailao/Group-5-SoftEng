import type { InputHTMLAttributes } from "react";

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
  /** Font Awesome icon name shown inside the input, e.g. "fa-envelope" */
  icon?: string;
  /** Error message for this field (from the back end or the form) */
  error?: string;
};

function TextField({ id, label, icon, error, className = "", ...props }: TextFieldProps) {
  const errorId = `${id}-error`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-md font-semibold">
        {label}
      </label>
      <div className="relative">
        {icon && (
          <i
            className={`fa-solid ${icon} pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-dark-grey`}
            aria-hidden="true"
          />
        )}
        <input
          id={id}
          name={id}
          required
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={`w-full ${icon ? "pl-11" : "pl-4"} pr-4 py-2 bg-white text-dark rounded-sm shadow-lg border ${
            error ? "border-red-800" : "border-dark-grey"
          } placeholder:text-dark-grey focus:outline-none focus:ring-2 focus:ring-fire-light ${className}`}
          {...props}
        />
      </div>
      {error && (
        <p id={errorId} className="text-sm text-red-800">
          {error}
        </p>
      )}
    </div>
  );
}

export default TextField;
