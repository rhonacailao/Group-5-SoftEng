import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import background from "../assets/group.jpg";
import TextField from "../components/TextField";
import GoogleButton from "../components/GoogleButton";
import OrDivider from "../components/OrDivider";

function RegisterPage() {
  const navigate = useNavigate();

  // Mockup only: after registering, the user sets their password.
  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const email = new FormData(e.currentTarget).get("email") as string;
    navigate("/set-password", { state: { email } });
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

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <fieldset className="flex flex-col gap-4">
            <legend className="sr-only">Your details</legend>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextField
                id="firstName"
                label="First name"
                type="text"
                autoComplete="given-name"
                placeholder="Juan"
              />
              <TextField
                id="lastName"
                label="Last name"
                type="text"
                autoComplete="family-name"
                placeholder="Dela Cruz"
              />
            </div>
            <TextField
              id="email"
              label="Email address"
              type="email"
              autoComplete="email"
              placeholder="username@example.com"
            />
          </fieldset>

          <button
            type="submit"
            className="px-4 py-2 bg-fire text-white rounded-md shadow-lg hover:bg-fire-light"
          >
            Register
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
      </div>
    </section>
  );
}

export default RegisterPage;
