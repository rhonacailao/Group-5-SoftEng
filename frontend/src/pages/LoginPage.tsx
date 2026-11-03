import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import AuthSplitLayout from "../components/AuthSplitLayout";
import TextField from "../components/TextField";
import GoogleButton from "../components/GoogleButton";
import OrDivider from "../components/OrDivider";
import Alert from "../components/Alert";

function LoginPage() {
  const [loggedIn, setLoggedIn] = useState(false);

  // Mockup only: no authentication is performed.
  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoggedIn(true);
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
        <p>
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
          autoComplete="email"
          placeholder="username@example.com"
        />
        <TextField
          id="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          placeholder="Enter your password"
        />

        <p className="text-md">
          <Link to="/forgot-password" className="text-fire underline">
            Forgot password?
          </Link>
        </p>

        {loggedIn && (
          <Alert type="success" title="Success!">
            You are logged in (mockup).
          </Alert>
        )}

        <button
          type="submit"
          className="px-4 py-2 bg-fire text-white rounded-md shadow-lg hover:bg-fire-light"
        >
          Log in
        </button>

        <OrDivider />
        <GoogleButton />
      </form>
    </AuthSplitLayout>
  );
}

export default LoginPage;
