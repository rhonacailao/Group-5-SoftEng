import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import AuthSplitLayout from "../components/AuthSplitLayout";
import TextField from "../components/TextField";
import Alert from "../components/Alert";
import { api, errorMessage } from "../lib/api";

function ForgotPasswordPage() {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // The back end always gives the same answer, whether or not the email exists.
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const email = new FormData(e.currentTarget).get("email");
    setMessage(null);
    setError(null);
    setBusy(true);
    try {
      const res = await api<{ ok: true; message: string }>("/api/auth/forgot-password", {
        body: { email },
      });
      setMessage(res.message);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthSplitLayout
      headingId="forgot-heading"
      heading={
        <>
          Reset your <span className="text-fire">password</span>
        </>
      }
      description="Enter your email address and we will send you a link to reset your password."
      footer={
        <p>
          Remembered it?{" "}
          <Link to="/login" className="text-fire underline">
            Back to log in
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <TextField
          id="email"
          label="Email address"
          type="email"
          icon="fa-envelope"
          autoComplete="email"
          placeholder="username@example.com"
        />

        {message && (
          <Alert type="success" title="Check your inbox.">
            {message}
          </Alert>
        )}
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
          {busy ? "Sending..." : "Send reset link"}
        </button>
      </form>
    </AuthSplitLayout>
  );
}

export default ForgotPasswordPage;
