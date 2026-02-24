import { Link } from "react-router-dom";
import {
  ArrowRightIcon,
  CheckIcon,
  ExternalLinkIcon,
  FilterIcon,
  FolderOpenIcon,
  LayoutDashboardIcon,
  PenLineIcon,
  RotateCcwIcon,
  Share2Icon,
} from "lucide-react";
import useAuth from "../hooks/useAuth";
import Logo from "../Components/Logo";

const features = [
  {
    title: "Write without friction",
    description:
      "Markdown shortcuts, slash commands, and auto-save. Open it, type, done.",
    details: [
      "Inline formatting as you type",
      "Keyboard-first — no menus needed",
    ],
    icon: PenLineIcon,
  },
  {
    title: "Find anything, fast",
    description:
      "Tag notes, pin saved filters, and let smart views bring the right note to you.",
    details: [
      "Reusable filters across notebooks",
      "Search that actually works",
    ],
    icon: FolderOpenIcon,
  },
  {
    title: "Share on your terms",
    description:
      "Publish a notebook with one click, or keep it private. You decide what goes public.",
    details: [
      "Public notebooks with a clean URL",
      "Granular member permissions",
    ],
    icon: Share2Icon,
  },
];

const updates = [
  {
    tag: "New",
    title: "Undo timeline",
    description:
      "Roll back notebook deletes, member changes, and share links — one click, no hassle.",
    icon: RotateCcwIcon,
  },
  {
    tag: "Improved",
    title: "Saved views",
    description:
      "Create reusable filters and sorts for every project, then pull them up in seconds.",
    icon: FilterIcon,
  },
  {
    tag: "Beta",
    title: "One-click publishing",
    description:
      "Generate a public link for your notebook. Updates stay in sync automatically.",
    icon: ExternalLinkIcon,
  },
];

function LandingPage() {
  const { user, initializing } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* ── Header ── */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4">
          <Link to="/" aria-label="NotesBoard home" className="inline-flex">
            <Logo size="2.75rem" className="text-left" />
          </Link>

          <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 md:flex">
            <a
              href="#features"
              className="transition-colors hover:text-slate-900"
            >
              Features
            </a>
            <a
              href="#updates"
              className="transition-colors hover:text-slate-900"
            >
              Updates
            </a>
          </nav>

          <div className="flex items-center gap-3">
            {initializing ? null : user ? (
              <Link
                to="/app"
                className="btn btn-primary btn-sm gap-2"
                aria-label="Go to dashboard"
              >
                <LayoutDashboardIcon className="size-4" />
                Dashboard
              </Link>
            ) : (
              <>
                <Link to="/login" className="btn btn-ghost btn-sm">
                  Sign in
                </Link>
                <Link
                  to="/register"
                  className="btn btn-primary btn-sm hidden md:inline-flex"
                >
                  Get started
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main id="main-content" tabIndex={-1}>
        {/* ── Hero ── */}
        <section className="mx-auto w-full max-w-5xl px-4 pb-20 pt-24 lg:pt-32">
          <div className="mx-auto max-w-3xl space-y-6 text-center">
            <span className="inline-block rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
              Now with undo timeline &amp; saved views
            </span>

            <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              Your notes, organized.
              <br />
              <span className="text-primary">Finally.</span>
            </h1>

            <p className="mx-auto max-w-xl text-lg text-slate-500">
              A fast, clean workspace for capturing ideas, organizing research,
              and sharing what matters — without the clutter.
            </p>

            <div className="flex flex-col items-center justify-center gap-3 pt-2 sm:flex-row">
              {initializing ? null : user ? (
                <Link to="/app" className="btn btn-primary btn-lg gap-2">
                  <LayoutDashboardIcon className="size-5" />
                  Open dashboard
                </Link>
              ) : (
                <>
                  <Link to="/register" className="btn btn-primary btn-lg gap-2">
                    Get started free
                    <ArrowRightIcon className="size-4" />
                  </Link>
                  <Link to="/login" className="btn btn-ghost btn-lg">
                    Sign in
                  </Link>
                </>
              )}
            </div>

            <p className="text-sm text-slate-400">
              Free forever &middot; No credit card &middot; Unlimited notes
            </p>
          </div>
        </section>

        {/* ── Features ── */}
        <section id="features" className="border-t border-slate-200 bg-white">
          <div className="mx-auto w-full max-w-5xl px-4 py-20">
            <div className="mx-auto max-w-2xl space-y-3 text-center">
              <h2 className="text-3xl font-bold tracking-tight">
                How it works
              </h2>
              <p className="text-base text-slate-500">
                Three steps. That&apos;s it.
              </p>
            </div>

            <div className="mt-14 grid gap-8 md:grid-cols-3">
              {features.map((feature, i) => {
                const Icon = feature.icon;
                return (
                  <article
                    key={feature.title}
                    className="flex h-full flex-col gap-4 rounded-xl border border-slate-200 bg-slate-50/50 p-6 text-left transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="flex items-center gap-3">
                      <span className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
                        <Icon className="size-5" />
                      </span>
                      <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                        Step {i + 1}
                      </span>
                    </div>

                    <div className="space-y-2">
                      <h3 className="text-lg font-semibold">{feature.title}</h3>
                      <p className="text-sm leading-relaxed text-slate-500">
                        {feature.description}
                      </p>
                    </div>

                    <ul className="mt-auto space-y-2 text-sm text-slate-500">
                      {feature.details.map((detail) => (
                        <li key={detail} className="flex items-start gap-2">
                          <CheckIcon className="mt-0.5 size-3.5 shrink-0 text-primary" />
                          <span>{detail}</span>
                        </li>
                      ))}
                    </ul>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── What's new ── */}
        <section id="updates" className="border-t border-slate-200">
          <div className="mx-auto w-full max-w-5xl px-4 py-20">
            <div className="mx-auto max-w-2xl space-y-3 text-center">
              <h2 className="text-3xl font-bold tracking-tight">
                What&apos;s new
              </h2>
              <p className="text-base text-slate-500">
                Recent updates to NotesBoard.
              </p>
            </div>

            <div className="mt-14 grid gap-6 md:grid-cols-3">
              {updates.map(({ tag, title, description, icon: Icon }) => (
                <div
                  key={title}
                  className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 text-left"
                >
                  <div className="flex items-center justify-between">
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      {tag}
                    </span>
                    <Icon className="size-4 text-slate-400" />
                  </div>
                  <h3 className="text-base font-semibold">{title}</h3>
                  <p className="text-sm leading-relaxed text-slate-500">
                    {description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="border-t border-slate-200 bg-white">
          <div className="mx-auto w-full max-w-5xl px-4 py-20">
            <div className="mx-auto max-w-2xl space-y-5 text-center">
              <h2 className="text-3xl font-bold tracking-tight">
                Ready to try it?
              </h2>
              <p className="text-base text-slate-500">
                Create a free account and start writing. Invite your team
                whenever you&apos;re ready.
              </p>
              <div className="flex flex-col items-center justify-center gap-3 pt-2 sm:flex-row">
                {initializing ? null : user ? (
                  <Link to="/app" className="btn btn-primary btn-lg gap-2">
                    <LayoutDashboardIcon className="size-5" />
                    Back to dashboard
                  </Link>
                ) : (
                  <>
                    <Link
                      to="/register"
                      className="btn btn-primary btn-lg gap-2"
                    >
                      Create an account
                      <ArrowRightIcon className="size-4" />
                    </Link>
                    <Link to="/login" className="btn btn-ghost btn-lg">
                      I already have one
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-slate-200">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-8 text-sm text-slate-400 md:flex-row md:items-center md:justify-between">
          <span>&copy; {new Date().getFullYear()} NotesBoard</span>
          <div className="flex items-center gap-4">
            <Link
              to="/privacy"
              className="transition-colors hover:text-slate-600"
            >
              Privacy
            </Link>
            <Link
              to="/terms"
              className="transition-colors hover:text-slate-600"
            >
              Terms
            </Link>
            <a
              href="mailto:hello@notesboard.xyz"
              className="transition-colors hover:text-slate-600"
            >
              Support
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;
