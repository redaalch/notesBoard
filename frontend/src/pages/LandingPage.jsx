import { Link } from "react-router-dom";
import {
  ArrowRightIcon,
  CheckCircle2Icon,
  ClockIcon,
  LayoutDashboardIcon,
  FeatherIcon,
  LineChartIcon,
  NotebookPenIcon,
  RocketIcon,
  ShieldCheckIcon,
  SparklesIcon,
  Wand2Icon,
} from "lucide-react";
import useAuth from "../hooks/useAuth.js";

const HERO_BACKGROUND = "https://bg.ibelick.com/backgrounds/bg-44.svg";
const SECTION_BACKGROUND = "https://bg.ibelick.com/backgrounds/bg-24.svg";

const metrics = [
  { value: "45k+", label: "Notes captured every week" },
  { value: "3m", label: "Avg. time to first note" },
  { value: "99.9%", label: "Sync reliability" },
  { value: "120+", label: "Teams collaborating" },
];

const featureHighlights = [
  {
    title: "Focus-first editor",
    description:
      "A fast, keyboard-friendly writing surface with Markdown shortcuts, slash commands, and distraction-free mode.",
    bullets: [
      "Live preview with inline formatting",
      "Keyboard palette for quick actions",
    ],
    icon: NotebookPenIcon,
  },
  {
    title: "Smarter organization",
    description:
      "Saved filters, tag analytics, and pinboards keep the right ideas at the top without manual sorting marathons.",
    bullets: [
      "Auto-tag suggestions from recent notes",
      "Filter presets that remember your view",
    ],
    icon: LineChartIcon,
  },
  {
    title: "Peace-of-mind security",
    description:
      "Granular session controls, secure sharing links, and privacy-first defaults keep sensitive projects protected.",
    bullets: [
      "Session refresh on sensitive changes",
      "Encryption in transit and at rest",
    ],
    icon: ShieldCheckIcon,
  },
];

const workflowSteps = [
  {
    label: "Capture",
    description:
      "Open NotesBoard and jot ideas instantly with keyboard-first shortcuts and auto-save.",
    icon: FeatherIcon,
  },
  {
    label: "Organize",
    description:
      "Tag topics, sort by priority, and filter by word count or recency in seconds.",
    icon: ClockIcon,
  },
  {
    label: "Create",
    description:
      "Transform raw thoughts into polished notes and share-ready content with confidence.",
    icon: SparklesIcon,
  },
];

const testimonials = [
  {
    quote:
      "“NotesBoard replaced three different tools for our team. We capture meeting notes, daily standups, and personal ideas in one calm space.”",
    author: "Isabela Quinn",
    role: "Product Lead @ Aurora Labs",
  },
  {
    quote:
      "“The themes and filters are brilliant. I can switch from creative brainstorming to analytical planning without breaking focus.”",
    author: "Darius Cole",
    role: "Freelance Creative Director",
  },
];

function LandingPage() {
  const { user, initializing } = useAuth();

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/80 backdrop-blur supports-[backdrop-filter:blur(0px)]:bg-white/70">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4">
          <Link to="/" className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl bg-gradient-to-br from-primary via-secondary to-accent text-primary-content shadow-lg shadow-primary/30">
              <Wand2Icon className="size-5" />
            </span>
            <div className="flex flex-col leading-tight">
              <span className="text-xs uppercase tracking-[0.45em] text-slate-500">
                Notes
              </span>
              <span className="text-2xl font-bold bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
                Board
              </span>
            </div>
          </Link>

          <nav className="hidden items-center gap-6 text-sm font-medium md:flex">
            <a href="#features" className="hover:text-primary">
              Features
            </a>
            <a href="#workflow" className="hover:text-primary">
              Workflow
            </a>
            <a href="#testimonials" className="hover:text-primary">
              Voices
            </a>
          </nav>

          <div className="flex items-center gap-3">
            {initializing ? null : user ? (
              <Link
                to="/app"
                className="btn btn-primary gap-2"
                aria-label="Go to dashboard"
              >
                <LayoutDashboardIcon className="size-4" />
                Dashboard
              </Link>
            ) : (
              <>
                <Link to="/login" className="btn btn-ghost">
                  Sign in
                </Link>
                <Link
                  to="/register"
                  className="btn btn-primary hidden md:inline-flex"
                >
                  Create free account
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main id="main-content" tabIndex={-1}>
        <section
          className="relative overflow-hidden"
          style={{
            backgroundImage: `url(${HERO_BACKGROUND})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-white/90 via-white/45 to-white/90" />
          <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-24 lg:flex-row lg:items-center lg:gap-16">
            <div className="flex-1 space-y-6 text-center lg:text-left">
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-xs font-semibold text-primary">
                <RocketIcon className="size-4" />
                Productivity without the noise
              </span>
              <h1 className="text-4xl font-bold leading-tight sm:text-5xl">
                Build a second brain that actually sparks ideas.
              </h1>
              <p className="text-lg text-slate-600 sm:text-xl">
                NotesBoard blends intuitive note-taking, rich organization, and
                a calm aesthetic so you can focus on thinking—not fighting your
                tools.
              </p>
              <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-start">
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
                    <Link
                      to="/login"
                      className="btn btn-ghost btn-lg border border-slate-200/70"
                    >
                      Explore my workspace
                    </Link>
                  </>
                )}
              </div>
              <div className="flex flex-col gap-2 text-sm text-slate-600 sm:flex-row sm:items-center">
                <div className="flex items-center gap-2">
                  <ShieldCheckIcon className="size-4 text-success" />
                  <span>No credit card required</span>
                </div>
                <div className="flex items-center gap-2">
                  <SparklesIcon className="size-4 text-warning" />
                  <span>10+ crafted themes included</span>
                </div>
              </div>
              <div className="mt-10 grid w-full gap-4 sm:grid-cols-2">
                {metrics.map((metric) => (
                  <div
                    key={metric.label}
                    className="rounded-2xl border border-slate-200/60 bg-white/90 px-5 py-4 text-left shadow-sm"
                  >
                    <p className="text-3xl font-semibold text-slate-900">
                      {metric.value}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {metric.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex-1">
              <div className="rounded-3xl border border-slate-200/70 bg-white/85 p-6 shadow-2xl shadow-primary/20 backdrop-blur">
                <div className="space-y-4">
                  <h2 className="text-xl font-semibold text-slate-900">
                    Why teams switch to NotesBoard
                  </h2>
                  <div className="space-y-3 text-sm text-slate-600">
                    <p>
                      • Filter notes by recency, length, or tags in a single
                      click.
                    </p>
                    <p>
                      • Track writing streaks and spot top tags with live stats.
                    </p>
                    <p>
                      • Share-ready formatting with Markdown support built-in.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-primary/30 bg-primary/10 p-4 text-sm text-primary">
                    “It feels like my brain finally has a place to breathe.”
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="mx-auto w-full max-w-6xl px-4 py-20">
          <div className="mx-auto max-w-3xl space-y-4 text-center text-slate-700">
            <span className="badge badge-outline badge-lg">
              Built for clarity
            </span>
            <h2 className="text-3xl font-bold">
              Everything you need to stay in flow
            </h2>
            <p className="text-base text-slate-600">
              NotesBoard combines power-user tooling with a welcoming interface
              so capturing and crafting ideas feels effortless.
            </p>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {featureHighlights.map((feature) => {
              const IconComponent = feature.icon;
              return (
                <article
                  key={feature.title}
                  className="flex h-full flex-col gap-4 rounded-3xl border border-slate-200/70 bg-white/90 p-6 text-left shadow-lg shadow-primary/10 transition hover:-translate-y-1 hover:shadow-primary/30"
                >
                  <span className="inline-flex size-12 items-center justify-center rounded-full bg-primary/15 text-primary">
                    <IconComponent className="size-6" />
                  </span>
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold text-slate-900">
                      {feature.title}
                    </h3>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                  <ul className="space-y-2 text-sm text-slate-600">
                    {feature.bullets.map((bullet) => (
                      <li key={bullet} className="flex items-start gap-2">
                        <CheckCircle2Icon className="mt-0.5 size-4 text-primary" />
                        <span className="leading-relaxed">{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              );
            })}
          </div>
        </section>

        <section
          id="workflow"
          className="relative overflow-hidden border-y border-slate-200/70"
        >
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `url(${SECTION_BACKGROUND})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
          <div className="absolute inset-0 bg-white/85" />
          <div className="relative mx-auto w-full max-w-6xl px-4 py-20">
            <div className="mx-auto max-w-2xl text-center space-y-4 text-slate-700">
              <span className="badge badge-secondary badge-lg">Workflow</span>
              <h2 className="text-3xl font-bold">
                Capture → Organize → Create
              </h2>
              <p className="text-base text-slate-600">
                A simple rhythm keeps your thoughts moving forward without
                losing the spark along the way.
              </p>
            </div>
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {workflowSteps.map((step) => {
                const IconComponent = step.icon;
                return (
                  <div
                    key={step.label}
                    className="rounded-3xl border border-slate-200/70 bg-white/85 p-6 shadow-lg"
                  >
                    <div className="flex items-center gap-4">
                      <span className="grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-primary via-secondary to-accent text-primary-content shadow">
                        <IconComponent className="size-6" />
                      </span>
                      <h3 className="text-xl font-semibold">{step.label}</h3>
                    </div>
                    <p className="mt-4 text-sm text-slate-600 leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section
          id="testimonials"
          className="mx-auto w-full max-w-6xl px-4 py-20"
        >
          <div className="mx-auto max-w-3xl text-center space-y-4 text-slate-700">
            <span className="badge badge-outline badge-lg">
              Loved by writers & teams
            </span>
            <h2 className="text-3xl font-bold">
              People are shipping more ideas with NotesBoard
            </h2>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-2">
            {testimonials.map(({ quote, author, role }) => (
              <blockquote
                key={author}
                className="rounded-3xl border border-slate-200/70 bg-white/85 p-6 text-left shadow-lg shadow-primary/10"
              >
                <p className="text-lg text-slate-700 leading-relaxed">
                  {quote}
                </p>
                <footer className="mt-6 space-y-1">
                  <div className="text-sm font-semibold">{author}</div>
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                    {role}
                  </div>
                </footer>
              </blockquote>
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-5xl px-4 pb-20">
          <div className="rounded-3xl border border-primary/30 bg-primary/10 p-10 text-center shadow-2xl shadow-primary/20">
            <div className="mx-auto max-w-2xl space-y-4">
              <h2 className="text-3xl font-bold">
                Ready to write with more clarity?
              </h2>
              <p className="text-base text-slate-600">
                Create a free account, explore the workspace, and invite your
                team when you’re ready. You’ll keep unlimited notes, pin your
                favorites, and design your ideal theme.
              </p>
              <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
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
                      Start my workspace
                      <ArrowRightIcon className="size-4" />
                    </Link>
                    <Link to="/login" className="btn btn-ghost btn-lg">
                      I already have an account
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200/70 bg-white/80">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-slate-600 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2 text-slate-700">
            <SparklesIcon className="size-4 text-primary" />
            Crafted for thinkers, writers, and product teams.
          </div>
          <div className="flex items-center gap-4">
            <Link to="/privacy" className="hover:text-primary">
              Privacy
            </Link>
            <Link to="/terms" className="hover:text-primary">
              Terms
            </Link>
            <a
              href="mailto:hello@notesboard.xyz"
              className="hover:text-primary"
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
