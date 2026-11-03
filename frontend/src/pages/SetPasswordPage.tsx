import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useLocation } from "react-router-dom";
import AuthSplitLayout from "../components/AuthSplitLayout";
import TextField from "../components/TextField";
import Alert from "../components/Alert";

const MIN_LENGTH = 8;

function SetPasswordPage() {
  const location = useLocation();
  const email = (location.state as { email?: string } | null)?.email;

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Mockup only: the password is not stored anywhere.
  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (password.length < MIN_LENGTH) {
      setError(`Use at least ${MIN_LENGTH} characters.`);
    } else if (password !== confirm) {
      setError("The passwords do not match.");
    } else {
      setError(null);
      setDone(true);
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
      description={
        email
          ? `Choose a new password for ${email}.`
          : "Choose a new password for your account."
      }
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
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <TextField
            id="newPassword"
            label="New password"
            type="password"
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
            className="px-4 py-2 bg-fire text-white rounded-md shadow-lg hover:bg-fire-light"
          >
            Save password
          </button>
        </form>
      )}
    </AuthSplitLayout>
  );
}

export default SetPasswordPage;
