import { Link } from "react-router-dom";
import useAuth from "../hooks/useAuth";

function TermsPage() {
  const { user } = useAuth();
  const homePath = user ? "/app" : "/";

  return (
    <div className="min-h-screen bg-base-200 px-4 py-16">
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto w-full max-w-3xl space-y-6"
      >
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold">Terms of Service</h1>
          <p className="text-base-content/70">
            These terms define how you may use NotesBoard. By accessing the
            product you agree to the guidelines below.
          </p>
        </div>

        <div className="space-y-6 rounded-3xl border border-base-300/60 bg-base-100/80 p-8 text-sm leading-relaxed text-base-content/80 shadow-lg">
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-base-content">
              1. Acceptable use
            </h2>
            <p>
              Keep your workspace free from unlawful, harmful, or spam content.
              We may suspend accounts that violate these principles or impact
              other users.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-base-content">
              2. Availability
            </h2>
            <p>
              We strive for near-constant uptime. Planned maintenance or
              unexpected outages will be communicated promptly through in-app
              alerts or email.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-base-content">
              3. Changes
            </h2>
            <p>
              We may update these terms as NotesBoard evolves. When changes
              occur we'll highlight them in the product and provide a summary.
            </p>
          </section>
        </div>

        <p className="text-center text-sm text-base-content/60">
          Need more detail?{" "}
          <a className="link link-primary" href="mailto:hello@notesboard.xyz">
            Reach out
          </a>{" "}
          or head back to the{" "}
          <Link className="link link-primary" to={homePath}>
            home page
          </Link>
          .
        </p>
      </main>
    </div>
  );
}

export default TermsPage;
