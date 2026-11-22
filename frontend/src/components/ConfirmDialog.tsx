import { useEffect, useId, useRef, type ReactNode } from "react";
import ErrorBanner from "./ErrorBanner";
import type { ErrorInfo } from "../lib/errorInfo";

type ConfirmDialogProps = {
  /** The question, e.g. "Delete Industrial Widget A?" */
  title: string;
  /** What will happen. Say plainly whether it can be undone. */
  children: ReactNode;
  /** Names the action, e.g. "Delete product" (better than "OK") */
  confirmLabel: string;
  /** Shown on the confirm button while the request runs */
  busyLabel?: string;
  cancelLabel?: string;
  /** "danger" = red confirm button, for deletes */
  tone?: "danger" | "default";
  /** True while the request runs: the dialog cannot be closed or confirmed twice */
  busy?: boolean;
  /** Set when the server refused, so the reason shows here and the person can read it before closing */
  error?: ErrorInfo | null;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * The confirm-delete state: a pause before something destructive, replacing window.confirm.
 * Nothing happens until the person presses the confirm button. Focus starts on Cancel, so
 * pressing Enter by reflex does not delete anything.
 */
function ConfirmDialog({
  title,
  children,
  confirmLabel,
  busyLabel = "Working...",
  cancelLabel = "Cancel",
  tone = "danger",
  busy = false,
  error,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const bodyId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    cancelRef.current?.focus();
  }, []);

  return (
    <dialog
      ref={ref}
      role="alertdialog"
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      // Escape must not close the dialog while the request is running
      onCancel={(e) => {
        if (busy) e.preventDefault();
      }}
      onClose={onCancel}
      className="m-auto w-full max-w-md rounded-xl bg-white p-0 text-dark shadow-lg backdrop:bg-dark/60"
    >
      <header className="border-b border-light-grey p-6">
        <h2 id={titleId} className="text-2xl font-bold">
          {title}
        </h2>
      </header>

      <div id={bodyId} className="flex flex-col gap-4 p-6">
        <div className="text-dark">{children}</div>
        {error && <ErrorBanner title={error.title} message={error.message} />}
      </div>

      <footer className="flex justify-end gap-3 border-t border-light-grey p-6">
        <button
          ref={cancelRef}
          type="button"
          onClick={() => ref.current?.close()}
          disabled={busy}
          className="rounded-md border border-light-grey bg-white px-4 py-2 hover:bg-light-grey disabled:opacity-60"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className={`rounded-md px-4 py-2 text-white shadow-lg transition-colors duration-200 ease-in-out disabled:opacity-60 ${
            tone === "danger"
              ? "bg-red-800 hover:bg-red-900"
              : "bg-fire hover:bg-fire-light"
          }`}
        >
          {busy ? busyLabel : confirmLabel}
        </button>
      </footer>
    </dialog>
  );
}

export default ConfirmDialog;
