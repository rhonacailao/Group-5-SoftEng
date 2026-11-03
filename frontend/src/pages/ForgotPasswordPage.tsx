import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import AuthSplitLayout from "../components/AuthSplitLayout";
import TextField from "../components/TextField";
import Alert from "../components/Alert";

function ForgotPasswordPage() {
  const [email, setEmail] = useState<string | null>(null);

  // Mockup only: no email is actually sent.
  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setEmail(new FormData(e.currentTarget).get("email") as string);
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
          autoComplete="email"
          placeholder="username@example.com"
        />

        {email && (
          <Alert type="success" title="Check your inbox.">
            If an account exists for {email}, a reset link is on its way.{" "}
            <Link to="/set-password" state={{ email }} className="underline">
              Open the reset link (mockup)
            </Link>
          </Alert>
        )}

        <button
          type="submit"
          className="px-4 py-2 bg-fire text-white rounded-md shadow-lg hover:bg-fire-light"
        >
          Send reset link
        </button>
      </form>
    </AuthSplitLayout>
  );
}

export default ForgotPasswordPage;
