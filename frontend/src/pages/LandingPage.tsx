import { Link } from "react-router-dom";
import { m } from "framer-motion";
import {
  ArrowRightIcon,
  BrainIcon,
  CheckIcon,
  GlobeIcon,
  HistoryIcon,
  BookmarkIcon,
  LogInIcon,
  NotebookPenIcon,
  RefreshCwIcon,
  SearchIcon,
  Share2Icon,
  ShieldCheckIcon,
  UsersIcon,
} from "lucide-react";
import useAuth from "../hooks/useAuth";
import useScrollReveal from "../hooks/useScrollReveal";
import Logo from "../Components/Logo";

const features = [
  {
    title: "Write and collaborate in real time",
    description:
      "Every keystroke syncs instantly across your team. Markdown, slash commands, and auto-save keep ideas flowing — with live cursors showing who's alongside you.",
    details: [
      "Live cursors — see collaborators as they type",
      "Works offline; syncs the moment you reconnect",
    ],
    icon: NotebookPenIcon,
    accent: "text-primary",
    accentBg: "bg-primary/10",
    visual: "editor" as const,
  },
  {
    title: "Find anything with AI-powered search",
    description:
      "Search by meaning, not just keywords. Save reusable filters as smart views so the right notes surface automatically — across every notebook and tag.",
    details: [
      "Semantic search understands intent, not just text",
      "Saved views that update as your notes grow",
    ],
    icon: BrainIcon,
    accent: "text-violet-600",
    accentBg: "bg-violet-500/10",
    visual: "search" as const,
  },
  {
    title: "Publish notebooks and control access",
    description:
      "Share a notebook publicly with a clean URL, or keep it private. Set per-member roles and revoke access any time — published notebooks update automatically.",
    details: [
      "Clean public URLs that stay in sync",
      "Granular roles: viewer, commenter, editor, admin",
    ],
    icon: ShieldCheckIcon,
    accent: "text-emerald-600",
    accentBg: "bg-emerald-500/10",
    visual: "publish" as const,
  },
];

const updates = [
  {
    tag: "New",
    title: "Undo timeline",
    description:
      "Roll back notebook deletes, member changes, and share links — one click, no hassle.",
    icon: HistoryIcon,
  },
  {
    tag: "Improved",
    title: "Saved views",
    description:
      "Create reusable filters and sorts for every project, then pull them up in seconds.",
    icon: BookmarkIcon,
  },
  {
    tag: "Beta",
    title: "One-click publishing",
    description:
      "Generate a public link for any notebook. Updates stay in sync automatically.",
    icon: Share2Icon,
  },
];

const TAG_COLORS: Record<string, string> = {
  project: "bg-primary/10 text-primary",
  team: "bg-violet-500/10 text-violet-600",
  research: "bg-emerald-500/10 text-emerald-600",
};

function LandingPage() {
  const { user, initializing } = useAuth();
  const featuresReveal = useScrollReveal();
  const updatesReveal = useScrollReveal();
  const ctaReveal = useScrollReveal<HTMLElement>();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* ── Header ── */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3.5">
          <Link to="/" aria-label="NotesBoard home" className="inline-flex">
            <Logo size="2.75rem" className="text-left" />
          </Link>

          <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 md:flex">
            <a
              href="#how-it-works"
              className="transition-colors hover:text-slate-900"
            >
              How it works
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
                aria-label="Open app"
              >
                <LogInIcon className="size-4" />
                Open app
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
                  Start free
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main id="main-content" tabIndex={-1}>
        {/* ── Hero ── */}
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0" aria-hidden>
            <div className="absolute left-1/2 top-0 h-[600px] w-[900px] -translate-x-1/2 -translate-y-1/4 rounded-full bg-primary/[0.07] blur-3xl" />
          </div>

          <div className="relative mx-auto w-full max-w-5xl px-4 pb-16 pt-20 lg:pt-28">
            <div className="mx-auto max-w-3xl space-y-5 text-center">
              {/* Category badge */}
              <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Collaborative · AI-powered · Publishable
              </span>

              <h1 className="text-4xl font-bold leading-[1.1] -tracking-[0.025em] sm:text-5xl lg:text-[3.5rem]">
                Notes and docs built
                <br />
                <span className="bg-gradient-to-r from-blue-600 via-violet-600 to-cyan-500 bg-clip-text text-transparent">
                  for teams that think together.
                </span>
              </h1>

              <p className="mx-auto max-w-xl text-lg leading-relaxed text-slate-500">
                Real-time collaborative editing, AI-powered semantic search, and
                one-click notebook publishing — all in one focused workspace.
              </p>

              {/* CTA buttons */}
              <div className="flex flex-col items-center justify-center gap-3 pt-2 sm:flex-row">
                {initializing ? null : user ? (
                  <Link to="/app" className="btn btn-primary btn-lg gap-2">
                    <LogInIcon className="size-5" />
                    Open your workspace
                  </Link>
                ) : (
                  <>
                    <Link
                      to="/register"
                      className="btn btn-primary btn-lg gap-2 shadow-lg shadow-primary/20"
                    >
                      Start for free
                      <ArrowRightIcon className="size-4" />
                    </Link>
                    <Link to="/login" className="btn btn-ghost btn-lg">
                      Sign in
                    </Link>
                  </>
                )}
              </div>

              {/* Proof points — the 4 real differentiators */}
              <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-slate-500">
                <span className="flex items-center gap-1.5">
                  <UsersIcon className="size-3.5 text-primary" />
                  Real-time collaboration
                </span>
                <span className="hidden h-3 w-px bg-slate-300 sm:block" />
                <span className="flex items-center gap-1.5">
                  <SearchIcon className="size-3.5 text-violet-500" />
                  AI semantic search
                </span>
                <span className="hidden h-3 w-px bg-slate-300 sm:block" />
                <span className="flex items-center gap-1.5">
                  <ShieldCheckIcon className="size-3.5 text-emerald-500" />
                  One-click publishing
                </span>
                <span className="hidden h-3 w-px bg-slate-300 sm:block" />
                <span className="flex items-center gap-1.5">
                  <RefreshCwIcon className="size-3.5 text-slate-400" />
                  Offline with auto-sync
                </span>
              </div>

              <p className="text-xs text-slate-400">
                Free forever &middot; No credit card &middot; Unlimited notes
              </p>
            </div>

            {/* ── Product preview ── */}
            <div className="mx-auto mt-14 max-w-4xl">
              <div className="overflow-hidden rounded-xl border border-slate-300/70 bg-white shadow-2xl shadow-slate-400/20 ring-1 ring-slate-900/8">
                {/* Window chrome */}
                <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-100 px-4 py-3">
                  <span className="size-2.5 rounded-full bg-red-400/70" />
                  <span className="size-2.5 rounded-full bg-amber-400/70" />
                  <span className="size-2.5 rounded-full bg-emerald-400/70" />
                  <span className="ml-4 flex-1 rounded bg-slate-100 px-3 py-1 text-center text-[11px] text-slate-500">
                    notesboard.xyz/app
                  </span>
                </div>

                {/* App surface */}
                <div className="flex min-h-[260px]">
                  {/* Sidebar */}
                  <div className="hidden w-44 shrink-0 space-y-3 border-r border-slate-200 bg-slate-50 p-4 lg:block">
                    <p className="text-[9px] font-semibold uppercase tracking-widest text-slate-400">
                      Notebooks
                    </p>
                    <div className="space-y-0.5">
                      {[
                        { label: "Product", w: "w-16", active: true },
                        { label: "Design", w: "w-12", active: false },
                        { label: "Research", w: "w-20", active: false },
                      ].map((item) => (
                        <div
                          key={item.label}
                          className={`flex items-center gap-2 rounded-md px-2 py-1.5 ${
                            item.active ? "bg-primary/10" : ""
                          }`}
                        >
                          <span
                            className={`size-1.5 rounded-full ${
                              item.active ? "bg-primary/60" : "bg-slate-200"
                            }`}
                          />
                          <div
                            className={`h-2 ${item.w} rounded ${
                              item.active ? "bg-primary/25" : "bg-slate-100"
                            }`}
                          />
                        </div>
                      ))}
                    </div>

                    <div className="space-y-0.5 border-t border-slate-100 pt-3">
                      <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-widest text-slate-400">
                        Saved views
                      </p>
                      {["w-24", "w-16"].map((w, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2 rounded-md px-2 py-1.5"
                        >
                          <span className="size-1.5 rounded-full bg-violet-300" />
                          <div
                            className={`h-2 ${w} rounded bg-violet-100/80`}
                          />
                        </div>
                      ))}
                    </div>

                    {/* Callout */}
                    <div className="rounded-md border border-violet-200 bg-violet-50 px-2 py-1.5">
                      <p className="text-[9px] font-semibold leading-snug text-violet-600">
                        ↑ Reusable smart filters
                      </p>
                    </div>
                  </div>

                  {/* Main area */}
                  <div className="flex-1 space-y-3 p-4 sm:p-5">
                    {/* Toolbar */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-3.5 w-24 rounded bg-slate-200/80" />
                        <div className="h-3.5 w-12 rounded bg-slate-100" />
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Collaborator avatars */}
                        <div className="flex -space-x-1.5">
                          {[
                            "bg-primary/40",
                            "bg-violet-400/50",
                            "bg-emerald-400/50",
                          ].map((c, i) => (
                            <span
                              key={i}
                              className={`size-5 rounded-full border-[1.5px] border-white ${c}`}
                            />
                          ))}
                        </div>
                        <div className="h-6 w-16 rounded-md bg-primary/12" />
                      </div>
                    </div>

                    {/* Note cards */}
                    <div className="grid gap-2 sm:grid-cols-3">
                      {[
                        {
                          title: "Product Roadmap",
                          preview:
                            "Q2 priorities, sprint planning, AI search rollout timeline...",
                          tag: "project",
                          pinned: true,
                        },
                        {
                          title: "Team Retro — March",
                          preview:
                            "What went well: editor stability, deployment pipeline improvements...",
                          tag: "team",
                          pinned: false,
                        },
                        {
                          title: "User Research Notes",
                          preview:
                            "12 interviews completed. Key theme: search friction is real...",
                          tag: "research",
                          pinned: false,
                        },
                      ].map((card) => (
                        <div
                          key={card.title}
                          className={`space-y-1.5 rounded-lg border bg-white p-3 shadow-[0_1px_3px_rgb(0_0_0/0.08)] ${
                            card.pinned
                              ? "border-amber-400/70"
                              : "border-slate-200"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-1">
                            <p className="text-[11px] font-bold leading-snug text-slate-800 truncate">
                              {card.title}
                            </p>
                            {card.pinned && (
                              <span className="shrink-0 text-[9px] text-amber-500">
                                ●
                              </span>
                            )}
                          </div>
                          <p className="text-[9px] leading-relaxed text-slate-500 line-clamp-2">
                            {card.preview}
                          </p>
                          <div className="flex items-center justify-between pt-0.5">
                            <span
                              className={`rounded px-1.5 py-0.5 text-[8px] font-semibold ${
                                TAG_COLORS[card.tag] ??
                                "bg-slate-100 text-slate-500"
                              }`}
                            >
                              {card.tag}
                            </span>
                            <span className="text-[8px] text-slate-300">
                              2h ago
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Bottom callout strip */}
                    <div className="flex flex-wrap gap-2">
                      <div className="flex items-center gap-1.5 rounded-md border border-violet-200 bg-violet-50 px-2.5 py-1.5">
                        <BrainIcon className="size-2.5 text-violet-500" />
                        <span className="text-[9px] font-semibold text-violet-600">
                          AI found 3 related notes
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1.5">
                        <GlobeIcon className="size-2.5 text-emerald-500" />
                        <span className="text-[9px] font-semibold text-emerald-600">
                          Published · notesboard.xyz/roadmap
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── How it works ── */}
        <section
          id="how-it-works"
          className="border-t border-slate-200 bg-white"
        >
          <div className="mx-auto w-full max-w-5xl px-4 py-20">
            <div className="mx-auto max-w-2xl space-y-3 text-center">
              <h2 className="text-3xl font-bold tracking-tight">
                How it works
              </h2>
              <p className="text-base text-slate-500">
                Four things NotesBoard does that most tools don&apos;t.
              </p>
            </div>

            <m.div
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
                const Icon = feature.icon;
                return (
                  <m.div
                    key={feature.title}
                    variants={featuresReveal.variants}
                    className={`flex flex-col items-center gap-10 md:flex-row ${
                      isReversed ? "md:flex-row-reverse" : ""
                    }`}
                  >
                    {/* Text side */}
                    <div className="flex-1 space-y-4">
                      <div className="flex items-center gap-4">
                        <span
                          className={`grid size-11 shrink-0 place-items-center rounded-xl ${feature.accentBg}`}
                        >
                          <Icon className={`size-5 ${feature.accent}`} />
                        </span>
                        <h3 className="text-xl font-semibold tracking-tight">
                          {feature.title}
                        </h3>
                      </div>
                      <p className="pl-[3.75rem] text-base leading-relaxed text-slate-500">
                        {feature.description}
                      </p>
                      <ul className="space-y-2 pl-[3.75rem] text-sm text-slate-500">
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
                      {feature.visual === "editor" && (
                        <div className="w-full max-w-sm rounded-xl border border-slate-100 bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.05)] transition-transform duration-300 hover:-translate-y-1">
                          {/* Collaborator bar */}
                          <div className="mb-4 flex items-center justify-between">
                            <div className="flex -space-x-2">
                              {["bg-primary/50", "bg-violet-400/60"].map(
                                (c, i) => (
                                  <span
                                    key={i}
                                    className={`size-6 rounded-full border-2 border-white ${c} flex items-center justify-center text-[9px] font-bold text-white`}
                                  >
                                    {["A", "M"][i]}
                                  </span>
                                ),
                              )}
                            </div>
                            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
                              2 editing live
                            </span>
                          </div>
                          <div className="font-mono text-sm">
                            <div className="mb-3 flex items-center text-base font-bold text-slate-800">
                              ## Product Roadmap
                              <span className="ml-1 inline-block h-4 w-1.5 animate-pulse bg-primary" />
                            </div>
                            <div className="ml-1 space-y-2 text-slate-500">
                              <div className="flex items-center gap-2">
                                <span className="text-slate-300">-</span>
                                Sprint planning
                                <span className="rounded bg-violet-500/10 px-1.5 py-0.5 text-xs text-violet-600">
                                  @Maya
                                </span>
                              </div>
                              <div className="relative flex items-center gap-2">
                                <span className="text-slate-300">-</span>
                                <span className="bg-violet-200/50 px-0.5">
                                  AI search rollout
                                </span>
                                <span className="absolute -top-3 left-8 rounded-sm bg-violet-500 px-1 text-[9px] text-white">
                                  Maya
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {feature.visual === "search" && (
                        <div className="relative h-52 w-full max-w-sm">
                          {/* Search bar */}
                          <div className="flex gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
                            <div className="flex flex-1 items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm">
                              <SearchIcon className="size-4 text-violet-400" />
                              <span className="text-slate-500">
                                quarterly planning notes
                              </span>
                              <span className="animate-pulse text-slate-400">
                                |
                              </span>
                            </div>
                          </div>

                          {/* Results */}
                          <div className="absolute inset-x-0 top-14 rounded-xl border border-slate-100 bg-white shadow-[0_10px_40px_rgb(0,0,0,0.08)]">
                            <div className="border-b border-slate-100 px-3 py-1.5">
                              <p className="text-[10px] font-semibold text-violet-600">
                                ✦ Semantically similar
                              </p>
                            </div>
                            {[
                              { title: "Q2 Product Roadmap", score: "98%" },
                              { title: "OKR Review — Q1", score: "91%" },
                              { title: "Team Sprint Notes", score: "84%" },
                            ].map((r) => (
                              <div
                                key={r.title}
                                className="flex items-center justify-between px-3 py-2.5 text-sm hover:bg-slate-50"
                              >
                                <span className="font-medium text-slate-700">
                                  {r.title}
                                </span>
                                <span className="text-[10px] font-semibold text-violet-500">
                                  {r.score}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {feature.visual === "publish" && (
                        <div className="w-full max-w-[280px] rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_20px_50px_rgb(0,0,0,0.1)] transition-transform duration-300 hover:scale-105">
                          <div className="mb-5 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Share2Icon className="size-4 text-slate-700" />
                              <h4 className="text-sm font-bold text-slate-800">
                                Publish notebook
                              </h4>
                            </div>
                            <span className="cursor-pointer text-slate-400 hover:text-slate-600">
                              ✕
                            </span>
                          </div>

                          <div className="mb-4 flex items-center justify-between">
                            <span className="text-sm font-medium text-slate-600">
                              Public access
                            </span>
                            <div className="flex h-5 w-9 cursor-pointer items-center justify-end rounded-full bg-emerald-500 p-0.5">
                              <div className="size-4 rounded-full bg-white shadow-sm" />
                            </div>
                          </div>

                          <div className="mb-4 truncate rounded-lg border border-slate-200 bg-slate-50 p-2.5 font-mono text-xs text-slate-500">
                            notesboard.xyz/nb/roadmap
                          </div>

                          <div className="mb-3 space-y-1.5 text-xs text-slate-500">
                            {[
                              "Updates sync automatically",
                              "Viewer role by default",
                            ].map((t) => (
                              <div key={t} className="flex items-center gap-2">
                                <CheckIcon className="size-3 shrink-0 text-emerald-500" />
                                {t}
                              </div>
                            ))}
                          </div>

                          <div className="w-full rounded-lg bg-emerald-500 py-2.5 text-center text-sm font-semibold text-white shadow-sm shadow-emerald-500/30 transition-colors hover:bg-emerald-600">
                            Copy Link
                          </div>
                        </div>
                      )}
                    </div>
                  </m.div>
                );
              })}
            </m.div>
          </div>
        </section>

        {/* ── Latest updates (compact) ── */}
        <section id="updates" className="border-t border-slate-200 bg-slate-50">
          <div className="mx-auto w-full max-w-5xl px-4 py-16">
            <div className="mb-10 flex items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold tracking-tight">
                  Latest updates
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  What we shipped recently.
                </p>
              </div>
            </div>

            <m.div
              ref={updatesReveal.ref}
              initial="hidden"
              animate={updatesReveal.animate}
              variants={{
                hidden: {},
                visible: { transition: { staggerChildren: 0.1 } },
              }}
              className="grid grid-cols-1 gap-4 md:grid-cols-3"
            >
              {updates.map(({ tag, title, description, icon: Icon }) => (
                <m.div
                  key={title}
                  variants={updatesReveal.variants}
                  className="flex flex-col gap-3 rounded-xl border border-slate-300/70 bg-white p-5 shadow-[0_1px_4px_rgb(0_0_0/0.08)]"
                >
                  <div className="flex items-center justify-between">
                    <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                      {tag}
                    </span>
                    <span className="grid size-8 place-items-center rounded-lg bg-slate-100">
                      <Icon className="size-4 text-slate-600" />
                    </span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">{title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-slate-500">
                      {description}
                    </p>
                  </div>
                </m.div>
              ))}
            </m.div>
          </div>
        </section>

        {/* ── Final CTA ── */}
        <m.section
          ref={ctaReveal.ref}
          initial="hidden"
          animate={ctaReveal.animate}
          variants={ctaReveal.variants}
          className="border-t border-slate-200"
        >
          <div className="mx-auto w-full max-w-5xl px-4 py-20">
            <div className="mx-auto max-w-3xl rounded-2xl bg-gradient-to-br from-blue-50 via-violet-50/60 to-cyan-50 px-6 py-16 text-center shadow-sm ring-1 ring-slate-200/60 sm:px-12">
              <h2 className="text-4xl font-bold tracking-tight">
                Write live. Find anything. Publish instantly.
              </h2>
              <p className="mx-auto mt-4 max-w-lg text-lg text-slate-500">
                One focused workspace for your team — with real-time
                collaboration, AI search, and publishing built in. Free to
                start, no card required.
              </p>
              <div className="flex flex-col items-center justify-center gap-3 pt-8 sm:flex-row">
                {initializing ? null : user ? (
                  <Link
                    to="/app"
                    className="btn btn-primary btn-lg gap-2 px-8 text-base"
                  >
                    <LogInIcon className="size-5" />
                    Open your workspace
                  </Link>
                ) : (
                  <>
                    <Link
                      to="/register"
                      className="btn btn-primary btn-lg gap-2 px-8 text-base shadow-lg shadow-primary/20"
                    >
                      Start for free
                      <ArrowRightIcon className="size-4" />
                    </Link>
                    <Link
                      to="/login"
                      className="btn btn-ghost btn-lg text-base"
                    >
                      Sign in instead
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        </m.section>
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
