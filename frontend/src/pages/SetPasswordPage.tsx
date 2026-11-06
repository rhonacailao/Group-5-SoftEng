import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import AuthSplitLayout from "../components/AuthSplitLayout";
import TextField from "../components/TextField";
import Alert from "../components/Alert";
import { api, ApiError, errorMessage } from "../lib/api";

const MIN_LENGTH = 8;

// Reached from the emailed link: /set-password?token=...
// It is used both for the first password (after approval) and for a password reset.
function SetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get("token");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [badLink, setBadLink] = useState(!token);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (password.length < MIN_LENGTH) {
      setError(`Use at least ${MIN_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("The passwords do not match.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await api("/api/auth/set-password", { body: { token, password } });
      setDone(true);
    } catch (err) {
      setError(errorMessage(err));
      // Invalid, used or expired link: the user needs a new one
      if (err instanceof ApiError && err.code?.startsWith("TOKEN_")) setBadLink(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthSplitLayout
      headingId="set-password-heading"
      heading={
        <>
          Set your <span className="text-fire">password</span>
        </>
      }
      description="Choose a password for your account."
      footer={
        <p>
          <Link to="/login" className="text-fire underline">
            Back to log in
          </Link>
        </p>
      }
    >
      {done ? (
        <div className="flex flex-col gap-4">
          <Alert type="success" title="Password saved!">
            You can now log in with your new password.
          </Alert>
          <Link
            to="/login"
            className="px-4 py-2 text-center bg-fire text-white rounded-md shadow-lg hover:bg-fire-light"
          >
            Go to log in
          </Link>
        </div>
      ) : badLink ? (
        <div className="flex flex-col gap-4">
          <Alert type="error" title="Error!">
            {error ?? "This link is not valid."}
          </Alert>
          <Link
            to="/forgot-password"
            className="px-4 py-2 text-center bg-fire text-white rounded-md shadow-lg hover:bg-fire-light"
          >
            Request a new link
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <TextField
            id="newPassword"
            label="New password"
            type="password"
            icon="fa-lock"
            autoComplete="new-password"
            minLength={MIN_LENGTH}
            placeholder={`At least ${MIN_LENGTH} characters`}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <TextField
            id="confirmPassword"
            label="Confirm new password"
            type="password"
            icon="fa-lock"
            autoComplete="new-password"
            placeholder="Re-enter your password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />

          {error && (
            <Alert type="error" title="Error!">
              {error}
            </Alert>
          )}

          <button
            type="submit"
            disabled={busy}
            className="px-4 py-2 bg-fire text-white rounded-md shadow-lg hover:bg-fire-light disabled:opacity-60"
          >
            {busy ? "Saving..." : "Save password"}
          </button>
        </form>
      )}
    </AuthSplitLayout>
  );
}

export default SetPasswordPage;
