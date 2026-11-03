import type { ReactNode } from "react";
import background from "../assets/techstore.jpg";

type AuthSplitLayoutProps = {
  headingId: string;
  heading: ReactNode;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
};

/** Form on the left, techstore image on the right. Shared by log in and password pages. */
function AuthSplitLayout({
  headingId,
  heading,
  description,
  children,
  footer,
}: AuthSplitLayoutProps) {
  return (
    <section
      aria-labelledby={headingId}
      className="grid min-h-[calc(100vh-6rem)] bg-white text-dark lg:grid-cols-2"
    >
      <div className="flex items-center justify-center p-10">
        <div className="w-full max-w-md">
          <header className="mb-8">
            <h1 id={headingId} className="text-5xl font-bold leading-none">
              {heading}
            </h1>
            <p className="mt-4 text-md text-dark-grey">{description}</p>
          </header>
          {children}
          {footer && (
            <footer className="mt-8 text-center text-md text-dark-grey">
              {footer}
            </footer>
          )}
        </div>
      </div>

      <aside className="relative hidden lg:block">
        <figure className="absolute inset-0 m-0">
          <img
            src={background}
            alt="Hope ERP powering a tech store's inventory and sales"
            className="h-full w-full object-cover"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-linear-to-br from-fire-light via-fire/40 to-transparent mix-blend-multiply"
          />
        </figure>
      </aside>
    </section>
  );
}

export default AuthSplitLayout;
