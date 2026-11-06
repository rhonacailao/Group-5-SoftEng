import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthSplitLayout from "../components/AuthSplitLayout";
import TextField from "../components/TextField";
import GoogleButton from "../components/GoogleButton";
import OrDivider from "../components/OrDivider";
import Alert from "../components/Alert";
import { errorMessage } from "../lib/api";
import { DEMO_EMAIL, DEMO_ENABLED, DEMO_PASSWORD, useAuthStore } from "../store/authStore";

function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email, password);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthSplitLayout
      headingId="login-heading"
      heading={
        <>
          Log in to Hope <span className="text-fire">ERP</span>
        </>
      }
      description="Enter your email address and password to continue."
      footer={
        <p className="text-center">
          Don&apos;t have an account?{" "}
          <Link to="/register" className="text-fire underline">
            Register
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
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <TextField
          id="password"
          label="Password"
          type="password"
          icon="fa-lock"
          autoComplete="current-password"
          placeholder="Enter your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <p className="text-md">
          <Link to="/forgot-password" className="text-fire underline">
            Forgot password?
          </Link>
        </p>

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
          {busy ? "Logging in..." : "Log in"}
        </button>

        <OrDivider />
        <GoogleButton />

        {DEMO_ENABLED && (
          <p className="text-center text-sm text-dark-grey">
            Demo account: <b>{DEMO_EMAIL}</b> / <b>{DEMO_PASSWORD}</b>
          </p>
        )}
      </form>
    </AuthSplitLayout>
  );
}

export default LoginPage;
