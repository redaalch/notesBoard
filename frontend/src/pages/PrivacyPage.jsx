import { Link } from "react-router-dom";

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-base-200 px-4 py-16">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold">Privacy Policy</h1>
          <p className="text-base-content/70">
            We keep your notes private and secure. This summary outlines how
            NotesBoard handles data inside the app.
          </p>
        </div>

        <div className="space-y-6 rounded-3xl border border-base-300/60 bg-base-100/80 p-8 text-sm leading-relaxed text-base-content/80 shadow-lg">
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-base-content">
              1. Data you add
            </h2>
            <p>
              Notes, tags, and account details stay within your workspace. We
              never sell or share your content and only use it to provide app
              functionality.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-base-content">
              2. Storage
            </h2>
            <p>
              NotesBoard stores information in encrypted databases. Attachments
              and emails sent through the app are transmitted using secure TLS
              connections.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-base-content">
              3. Your control
            </h2>
            <p>
              You may export or delete your workspace at any time. Removing your
              account permanently deletes the associated content from our
              systems.
            </p>
          </section>
        </div>

        <p className="text-center text-sm text-base-content/60">
          Have questions?{" "}
          <a className="link link-primary" href="mailto:hello@notesboard.xyz">
            Contact support
          </a>{" "}
          or return to the{" "}
          <Link className="link link-primary" to="/">
            home page
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

export default PrivacyPage;
