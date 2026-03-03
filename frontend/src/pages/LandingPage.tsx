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
  StarIcon,
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
    highlights: [
      "Restore deleted notebooks instantly",
      "Revert member permission changes",
      "Recover revoked share links",
    ],
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

              <h1 className="text-4xl font-bold leading-[1.1] -tracking-[0.02em] sm:text-5xl lg:text-6xl">
                Your notes, organized.
                <br />
                <span className="bg-gradient-to-r from-blue-600 via-violet-600 to-cyan-500 bg-clip-text text-transparent">
                  Finally.
                </span>
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

              <p className="text-sm text-slate-500">
                Free forever &middot; No credit card &middot; Unlimited notes
              </p>

              {/* Social proof */}
              <div className="flex flex-wrap items-center justify-center gap-4 pt-1">
                <div className="flex -space-x-2">
                  {[
                    "from-blue-300 to-blue-400",
                    "from-violet-300 to-violet-400",
                    "from-cyan-300 to-cyan-400",
                    "from-amber-300 to-amber-400",
                    "from-rose-300 to-rose-400",
                  ].map((gradient, i) => (
                    <div
                      key={i}
                      className={`size-7 rounded-full border-2 border-white bg-gradient-to-br ${gradient}`}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-1.5 text-sm">
                  <div className="flex text-amber-400">
                    {[...Array(5)].map((_, i) => (
                      <StarIcon key={i} className="size-3.5 fill-current" />
                    ))}
                  </div>
                  <span className="font-medium text-slate-600">
                    Loved by 2,000+ users
                  </span>
                </div>
              </div>
            </div>

            {/* ── Product preview mockup ── */}
            <div className="mx-auto mt-16 max-w-4xl px-4">
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-200/50">
                {/* Window chrome */}
                <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3">
                  <span className="size-3 rounded-full bg-slate-200" />
                  <span className="size-3 rounded-full bg-slate-200" />
                  <span className="size-3 rounded-full bg-slate-200" />
                  <span className="ml-4 flex-1 rounded-md bg-slate-100 px-3 py-1 text-center text-xs text-slate-500">
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
                visible: { transition: { staggerChildren: 0.2 } },
              }}
              className="mt-16 space-y-20"
            >
              {features.map((feature, i) => {
                const isReversed = i % 2 !== 0;
                return (
                  <motion.div
                    key={feature.title}
                    variants={featuresReveal.variants}
                    className={`flex flex-col items-center gap-10 md:flex-row ${
                      isReversed ? "md:flex-row-reverse" : ""
                    }`}
                  >
                    {/* Text side */}
                    <div className="flex-1 space-y-4">
                      <div className="flex items-center gap-4">
                        <span className="grid size-12 shrink-0 place-items-center rounded-full bg-primary/10 text-xl font-bold text-primary">
                          {i + 1}
                        </span>
                        <h3 className="text-xl font-semibold">
                          {feature.title}
                        </h3>
                      </div>
                      <p className="pl-16 text-base leading-relaxed text-slate-500">
                        {feature.description}
                      </p>
                      <ul className="space-y-2 pl-16 text-sm text-slate-500">
                        {feature.details.map((detail) => (
                          <li key={detail} className="flex items-start gap-2">
                            <CheckIcon className="mt-0.5 size-3.5 shrink-0 text-primary" />
                            <span>{detail}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Visual side */}
                    <div className="flex flex-1 justify-center">
                      {i === 0 && (
                        /* Editor graphic */
                        <div className="w-full max-w-sm rounded-xl border border-slate-100 bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-transform duration-300 hover:-translate-y-1">
                          <div className="font-mono text-sm">
                            <div className="mb-3 flex items-center text-base font-bold text-slate-800">
                              ## Product Roadmap
                              <span className="ml-1 inline-block h-4 w-1.5 animate-pulse bg-blue-500" />
                            </div>
                            <div className="ml-1 space-y-2 text-slate-500">
                              <div className="flex items-center gap-2">
                                <span className="text-slate-300">-</span>
                                Sprint planning
                                <span className="rounded bg-blue-500/10 px-1.5 py-0.5 text-xs text-blue-500">
                                  @team
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-slate-300">-</span>
                                User interviews
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {i === 1 && (
                        /* Filter graphic */
                        <div className="relative h-48 w-full max-w-sm">
                          <div className="absolute inset-x-0 top-0 flex gap-2 rounded-lg border border-slate-200 bg-white p-2 shadow-sm">
                            <div className="flex flex-1 items-center rounded border border-slate-100 bg-slate-50 px-3 py-1.5 text-sm text-slate-500">
                              <svg
                                className="mr-2 size-4 text-slate-400"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                                />
                              </svg>
                              user research
                              <span className="ml-px animate-pulse">|</span>
                            </div>
                            <div className="flex items-center rounded bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-600">
                              Filters
                            </div>
                          </div>

                          <div className="absolute right-2 top-14 z-10 w-48 rounded-xl border border-slate-100 bg-white p-2 shadow-[0_10px_40px_rgb(0,0,0,0.08)]">
                            <div className="mb-1 flex cursor-pointer items-center gap-2 rounded-lg bg-green-500/10 px-3 py-2 text-xs font-semibold text-green-700">
                              <svg
                                className="size-3"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
                              </svg>
                              #Retro
                            </div>
                            <div className="flex cursor-pointer items-center gap-2 rounded-lg bg-blue-500/10 px-3 py-2 text-xs font-semibold text-blue-700">
                              <svg
                                className="size-3"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
                              </svg>
                              #Team
                            </div>
                          </div>
                        </div>
                      )}

                      {i === 2 && (
                        /* Share modal graphic */
                        <div className="w-full max-w-[280px] rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_20px_50px_rgb(0,0,0,0.1)] transition-transform duration-300 hover:scale-105">
                          <div className="mb-5 flex items-center justify-between">
                            <h4 className="text-sm font-bold text-slate-800">
                              Share Note
                            </h4>
                            <span className="cursor-pointer text-slate-400 hover:text-slate-600">
                              ✕
                            </span>
                          </div>

                          <div className="mb-4 flex items-center justify-between">
                            <span className="text-sm font-medium text-slate-600">
                              Publish to web
                            </span>
                            <div className="flex h-5 w-9 cursor-pointer items-center justify-end rounded-full bg-blue-500 p-0.5">
                              <div className="size-4 rounded-full bg-white shadow-sm" />
                            </div>
                          </div>

                          <div className="mb-4 truncate rounded-lg border border-slate-200 bg-slate-50 p-2.5 font-mono text-xs text-slate-500">
                            notesboard.xyz/your-note
                          </div>

                          <div className="w-full rounded-lg bg-blue-500 py-2.5 text-center text-sm font-semibold text-white shadow-sm shadow-blue-500/30 transition-colors hover:bg-blue-600">
                            Copy Link
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          </div>
        </section>

        {/* ── What's new ── */}
        <section
          id="updates"
          className="border-t border-slate-200 bg-[#f8fafc]"
        >
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
              className="mt-14 grid auto-rows-fr grid-cols-1 gap-5 md:grid-cols-3 md:grid-rows-2"
            >
              {updates.map((update, i) => {
                const { tag, title, description, icon: Icon } = update;
                const highlights =
                  "highlights" in update
                    ? (update as { highlights: string[] }).highlights
                    : null;
                return (
                  <motion.div
                    key={title}
                    variants={updatesReveal.variants}
                    className={`flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm ${
                      i === 0 ? "md:col-span-2 md:row-span-2" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="rounded-full bg-primary/10 px-3 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-primary">
                        {tag}
                      </span>
                    </div>
                    <div
                      className={`flex items-center gap-3 ${
                        i === 0 ? "mt-2" : ""
                      }`}
                    >
                      <span
                        className={`grid place-items-center rounded-xl bg-primary/10 ${
                          i === 0 ? "size-14" : "size-10"
                        }`}
                      >
                        <Icon
                          className={`text-primary ${
                            i === 0 ? "size-7" : "size-5"
                          }`}
                        />
                      </span>
                      <h3
                        className={`font-semibold ${
                          i === 0 ? "text-xl" : "text-base"
                        }`}
                      >
                        {title}
                      </h3>
                    </div>
                    <p
                      className={`leading-relaxed text-slate-500 ${
                        i === 0 ? "max-w-md text-base" : "text-sm"
                      }`}
                    >
                      {description}
                    </p>

                    {/* Extra content for featured card */}
                    {i === 0 && highlights && (
                      <div className="mt-auto flex flex-col gap-5 md:flex-row md:items-end md:gap-8">
                        <ul className="space-y-2 text-sm text-slate-500">
                          {highlights.map((h) => (
                            <li key={h} className="flex items-start gap-2">
                              <CheckIcon className="mt-0.5 size-3.5 shrink-0 text-primary" />
                              <span>{h}</span>
                            </li>
                          ))}
                        </ul>
                        {/* Mini timeline mockup */}
                        <div className="hidden flex-1 space-y-2.5 rounded-xl border border-slate-100 bg-slate-50/80 p-4 md:block">
                          {[
                            {
                              w: "w-3/4",
                              accent: true,
                              label: "Notebook restored",
                            },
                            {
                              w: "w-1/2",
                              accent: false,
                              label: "Permission reverted",
                            },
                            {
                              w: "w-2/3",
                              accent: false,
                              label: "Share link recovered",
                            },
                          ].map((row) => (
                            <div
                              key={row.label}
                              className="flex items-center gap-2.5"
                            >
                              <span
                                className={`size-2 shrink-0 rounded-full ${
                                  row.accent ? "bg-primary" : "bg-slate-200"
                                }`}
                              />
                              <div
                                className={`h-2.5 rounded ${row.w} ${
                                  row.accent ? "bg-primary/15" : "bg-slate-100"
                                }`}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </motion.div>
          </div>
        </section>

        {/* ── CTA ── */}
        <motion.section
          ref={ctaReveal.ref}
          initial="hidden"
          animate={ctaReveal.animate}
          variants={ctaReveal.variants}
          className="border-t border-slate-200"
        >
          <div className="mx-auto w-full max-w-5xl px-4 py-20">
            <div className="mx-auto max-w-3xl rounded-2xl bg-gradient-to-br from-blue-50 via-violet-50/60 to-cyan-50 px-6 py-16 text-center shadow-sm ring-1 ring-slate-200/60 sm:px-12">
              <h2 className="text-4xl font-bold tracking-tight">
                Ready to try it?
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-lg text-slate-500">
                Create a free account and start writing. Invite your team
                whenever you&apos;re ready.
              </p>
              <div className="flex flex-col items-center justify-center gap-3 pt-8 sm:flex-row">
                {initializing ? null : user ? (
                  <Link
                    to="/app"
                    className="btn btn-primary btn-lg gap-2 px-8 text-base"
                  >
                    <LayoutDashboardIcon className="size-5" />
                    Back to dashboard
                  </Link>
                ) : (
                  <>
                    <Link
                      to="/register"
                      className="btn btn-primary btn-lg gap-2 px-8 text-base shadow-lg shadow-primary/20"
                    >
                      Create an account
                      <ArrowRightIcon className="size-4" />
                    </Link>
                    <Link
                      to="/login"
                      className="btn btn-ghost btn-lg text-base"
                    >
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
      <hr className="mx-auto max-w-5xl border-slate-200" />
      <footer>
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-8 text-sm text-slate-500 md:flex-row md:items-center md:justify-between">
          <span>&copy; {new Date().getFullYear()} NotesBoard</span>
          <div className="flex items-center gap-4">
            <Link
              to="/privacy"
              className="transition-colors hover:text-slate-900"
            >
              Privacy
            </Link>
            <Link
              to="/terms"
              className="transition-colors hover:text-slate-900"
            >
              Terms
            </Link>
            <a
              href="mailto:hello@notesboard.xyz"
              className="transition-colors hover:text-slate-900"
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
