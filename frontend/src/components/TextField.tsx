import { useState } from "react";
import type { InputHTMLAttributes } from "react";

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
  /** Font Awesome icon name shown inside the input, e.g. "fa-envelope" */
  icon?: string;
  /** Error message for this field (from the back end or the form) */
  error?: string;
};

function TextField({
  id,
  label,
  icon,
  error,
  type = "text",
  className = "",
  ...props
}: TextFieldProps) {
  const [visible, setVisible] = useState(false);
  const errorId = `${id}-error`;
  const isPassword = type === "password";

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
          type={isPassword && visible ? "text" : type}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={`w-full ${icon ? "pl-11" : "pl-4"} ${isPassword ? "pr-11" : "pr-4"} py-2 rounded-full bg-[#e0d3ca] text-dark placeholder:text-dark-grey focus:outline-none focus:ring-2 ${
            error
              ? "ring-2 ring-red-800 focus:ring-red-800"
              : "focus:ring-fire-light"
          } ${className}`}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? "Hide password" : "Show password"}
            aria-pressed={visible}
            className="absolute right-0 top-1/2 flex h-full w-11 -translate-y-1/2 items-center justify-center text-dark-grey transition-colors duration-200 ease-in-out hover:text-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-fire-light rounded-full"
          >
            <i
              className={`fa-solid ${visible ? "fa-eye-slash" : "fa-eye"}`}
              aria-hidden="true"
            />
          </button>
        )}
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
