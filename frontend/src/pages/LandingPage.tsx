import { Link } from "react-router-dom";
import { motion } from "framer-motion";
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
import useScrollReveal from "../hooks/useScrollReveal";
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
  const featuresReveal = useScrollReveal();
  const updatesReveal = useScrollReveal();
  const ctaReveal = useScrollReveal();

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
        <section className="relative overflow-hidden">
          {/* Subtle radial glow */}
          <div className="pointer-events-none absolute inset-0" aria-hidden>
            <div className="absolute left-1/2 top-0 h-[600px] w-[900px] -translate-x-1/2 -translate-y-1/4 rounded-full bg-primary/[0.06] blur-3xl" />
          </div>

          <div className="relative mx-auto w-full max-w-5xl px-4 pb-16 pt-24 lg:pt-32">
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
                A fast, clean workspace for capturing ideas, organizing
                research, and sharing what matters — without the clutter.
              </p>

              <div className="flex flex-col items-center justify-center gap-3 pt-2 sm:flex-row">
                {initializing ? null : user ? (
                  <Link to="/app" className="btn btn-primary btn-lg gap-2">
                    <LayoutDashboardIcon className="size-5" />
                    Open dashboard
                  </Link>
                ) : (
                  <>
                    <Link
                      to="/register"
                      className="btn btn-primary btn-lg gap-2"
                    >
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

            {/* ── Product preview mockup ── */}
            <div className="mx-auto mt-16 max-w-4xl px-4">
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-200/50">
                {/* Window chrome */}
                <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3">
                  <span className="size-3 rounded-full bg-slate-200" />
                  <span className="size-3 rounded-full bg-slate-200" />
                  <span className="size-3 rounded-full bg-slate-200" />
                  <span className="ml-4 flex-1 rounded-md bg-slate-100 px-3 py-1 text-center text-xs text-slate-400">
                    notesboard.xyz/app
                  </span>
                </div>
                {/* App preview content */}
                <div className="p-6 sm:p-8">
                  <div className="flex flex-col gap-6 lg:flex-row">
                    {/* Sidebar mock */}
                    <div className="hidden w-48 shrink-0 space-y-3 lg:block">
                      <div className="h-4 w-24 rounded bg-slate-100" />
                      <div className="space-y-2 pt-2">
                        <div className="flex items-center gap-2">
                          <div className="size-2 rounded-full bg-primary/40" />
                          <div className="h-3 w-28 rounded bg-slate-100" />
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="size-2 rounded-full bg-slate-200" />
                          <div className="h-3 w-20 rounded bg-slate-100" />
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="size-2 rounded-full bg-slate-200" />
                          <div className="h-3 w-24 rounded bg-slate-100" />
                        </div>
                      </div>
                      <div className="h-px bg-slate-100" />
                      <div className="h-4 w-16 rounded bg-slate-100" />
                      <div className="space-y-2 pt-1">
                        <div className="flex items-center gap-2">
                          <div className="size-2 rounded-full bg-slate-200" />
                          <div className="h-3 w-22 rounded bg-slate-100" />
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="size-2 rounded-full bg-slate-200" />
                          <div className="h-3 w-16 rounded bg-slate-100" />
                        </div>
                      </div>
                    </div>
                    {/* Main content mock */}
                    <div className="flex-1 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="h-5 w-40 rounded bg-slate-100" />
                        <div className="flex gap-2">
                          <div className="h-7 w-16 rounded-md bg-slate-100" />
                          <div className="h-7 w-20 rounded-md bg-primary/15" />
                        </div>
                      </div>
                      {/* Note cards grid */}
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {[1, 2, 3].map((n) => (
                          <div
                            key={n}
                            className="space-y-2 rounded-lg border border-slate-100 bg-slate-50/80 p-4"
                          >
                            <div className="h-4 w-3/4 rounded bg-slate-200/70" />
                            <div className="space-y-1.5">
                              <div className="h-2.5 w-full rounded bg-slate-100" />
                              <div className="h-2.5 w-5/6 rounded bg-slate-100" />
                              <div className="h-2.5 w-2/3 rounded bg-slate-100" />
                            </div>
                            <div className="flex gap-1.5 pt-1">
                              <span className="h-4 w-10 rounded-full bg-primary/10" />
                              <span className="h-4 w-12 rounded-full bg-slate-100" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
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

            <motion.div
              ref={featuresReveal.ref}
              initial="hidden"
              animate={featuresReveal.animate}
              variants={{
                hidden: {},
                visible: { transition: { staggerChildren: 0.15 } },
              }}
              className="mt-14 grid gap-8 md:grid-cols-3"
            >
              {features.map((feature, i) => {
                const Icon = feature.icon;
                return (
                  <motion.article
                    key={feature.title}
                    variants={featuresReveal.variants}
                    className="relative flex h-full flex-col gap-4 rounded-xl border border-slate-200 bg-slate-50/50 p-6 pl-8 text-left transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    {/* Step number + vertical connector */}
                    <div className="absolute -left-px top-0 flex flex-col items-center md:-top-6">
                      <span className="z-10 grid size-8 place-items-center rounded-full border-2 border-primary bg-white text-xs font-bold text-primary">
                        {i + 1}
                      </span>
                      {i < features.length - 1 && (
                        <span
                          className="hidden h-full w-px bg-slate-200 md:block"
                          aria-hidden
                        />
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
                        <Icon className="size-5" />
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
                  </motion.article>
                );
              })}
            </motion.div>
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

            <motion.div
              ref={updatesReveal.ref}
              initial="hidden"
              animate={updatesReveal.animate}
              variants={{
                hidden: {},
                visible: { transition: { staggerChildren: 0.12 } },
              }}
              className="mt-14 grid gap-6 md:grid-cols-3"
            >
              {updates.map(({ tag, title, description, icon: Icon }) => (
                <motion.div
                  key={title}
                  variants={updatesReveal.variants}
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
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ── CTA ── */}
        <motion.section
          ref={ctaReveal.ref}
          initial="hidden"
          animate={ctaReveal.animate}
          variants={ctaReveal.variants}
          className="border-t border-slate-200 bg-white"
        >
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
        </motion.section>
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
