import type { InputHTMLAttributes } from "react";

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
};

function TextField({ id, label, className = "", ...props }: TextFieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-md font-semibold">
        {label}
      </label>
      <input
        id={id}
        name={id}
        required
        className={`w-full px-4 py-2 bg-white text-dark rounded-sm shadow-lg border border-dark-grey placeholder:text-dark-grey focus:outline-none focus:ring-2 focus:ring-fire-light ${className}`}
        {...props}
      />
    </div>
  );
}

export default TextField;
