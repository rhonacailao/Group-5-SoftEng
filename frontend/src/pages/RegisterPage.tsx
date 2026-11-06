import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import background from "../assets/group.jpg";
import TextField from "../components/TextField";
import GoogleButton from "../components/GoogleButton";
import OrDivider from "../components/OrDivider";
import Alert from "../components/Alert";
import { api, ApiError, errorMessage } from "../lib/api";

function RegisterPage() {
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  // The back end creates the account as "Pending". An administrator approves it, and
  // the user then gets an email with a link to choose a password.
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setFieldErrors({});
    setFormError(null);
    setBusy(true);
    try {
      await api("/api/auth/register", {
        body: {
          firstName: data.get("firstName"),
          lastName: data.get("lastName"),
          email: data.get("email"),
        },
      });
      setDone(true);
    } catch (err) {
      if (err instanceof ApiError && err.errors) setFieldErrors(err.errors);
      else setFormError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      aria-labelledby="register-heading"
      className="relative flex min-h-[calc(100vh-6rem)] items-center justify-center overflow-hidden p-10"
    >
      {/*----------Background----------*/}
      <figure className="absolute inset-0 m-0">
        <img
          src={background}
          alt="Colleagues laughing together around a table with laptops"
          className="h-full w-full object-cover"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-linear-to-br from-fire-light via-fire/40 to-transparent mix-blend-multiply"
        />
      </figure>

      {/*----------Floating sign up box----------*/}
      <div className="relative w-full max-w-md rounded-lg bg-white p-8 text-dark shadow-lg border border-light-grey">
        <header className="mb-6">
          <h1 id="register-heading" className="text-2xl font-bold">
            Create your Hope <span className="text-fire">ERP</span> account
          </h1>
          <p className="mt-2 text-md text-dark-grey">
            Enter your details to get started for free.
          </p>
        </header>

        {done ? (
          <div className="flex flex-col gap-4">
            <Alert type="success" title="Request sent!">
              Your registration is waiting for approval. Once an administrator
              approves it, we will email you a link to choose your password.
            </Alert>
            <Link
              to="/login"
              className="px-4 py-2 text-center bg-fire text-white rounded-md shadow-lg hover:bg-fire-light"
            >
              Back to log in
            </Link>
          </div>
        ) : (
          <>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <fieldset className="flex flex-col gap-4">
                <legend className="sr-only">Your details</legend>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <TextField
                    id="firstName"
                    label="First name"
                    type="text"
                    icon="fa-user"
                    autoComplete="given-name"
                    placeholder="Juan"
                    error={fieldErrors.firstName}
                  />
                  <TextField
                    id="lastName"
                    label="Last name"
                    type="text"
                    icon="fa-user"
                    autoComplete="family-name"
                    placeholder="Dela Cruz"
                    error={fieldErrors.lastName}
                  />
                </div>
                <TextField
                  id="email"
                  label="Email address"
                  type="email"
                  icon="fa-envelope"
                  autoComplete="email"
                  placeholder="username@example.com"
                  error={fieldErrors.email}
                />
              </fieldset>

              {formError && (
                <Alert type="error" title="Error!">
                  {formError}
                </Alert>
              )}

              <button
                type="submit"
                disabled={busy}
                className="px-4 py-2 bg-fire text-white rounded-md shadow-lg hover:bg-fire-light disabled:opacity-60"
              >
                {busy ? "Sending..." : "Register"}
              </button>

              <OrDivider />
              <GoogleButton />
            </form>

            <footer className="mt-6 text-md text-dark-grey">
              <p>
                Already have an account?{" "}
                <Link to="/login" className="text-fire underline">
                  Log in
                </Link>
              </p>
            </footer>
          </>
        )}
      </div>
    </section>
  );
}

export default RegisterPage;
