import type { ReactNode } from "react";

type AlertProps = {
  type: "success" | "error";
  title: string;
  children: ReactNode;
};

const styles = {
  success: "border-green-900 bg-green-300 text-green-800",
  error: "border-red-900 bg-red-300 text-red-800",
};

function Alert({ type, title, children }: AlertProps) {
  return (
    <div
      role={type === "error" ? "alert" : "status"}
      className={`border p-4 rounded-md ${styles[type]}`}
    >
      <span>
        <b>{title} </b>
        {children}
      </span>
    </div>
  );
}

export default Alert;
