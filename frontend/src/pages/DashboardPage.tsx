import { useMemo, useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import {
  PlusIcon,
  ClipboardListIcon,
  CalendarIcon,
  SparklesIcon,
  PinIcon,
  ArrowRightIcon,
  TagIcon,
  TrendingUpIcon,
  ClockIcon,
  FileTextIcon,
  BookOpenIcon,
  ChevronRightIcon,
  PenLineIcon,
  LightbulbIcon,
  ZapIcon,
  LayoutListIcon,
  LayoutGridIcon,
  LayoutTemplateIcon,
  FlameIcon,
  EditIcon,
  EyeIcon,
  ExternalLinkIcon,
} from "lucide-react";
import Navbar from "../Components/Navbar";
import useAuth from "../hooks/useAuth";
import api from "../lib/axios";
import { cn } from "../lib/cn";
import { countWords, formatTagLabel } from "../lib/Utils";
import { noteTemplates } from "../lib/noteTemplates";

// ── Helpers ──────────────────────────────────────────────────────────────────

const getGreeting = (): string => {
  const h = new Date().getHours();
  if (h < 5) return "Good night";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 21) return "Good evening";
  return "Good night";
};

const getFirstName = (name: string): string => {
  const first = name?.trim().split(/\s+/)[0];
  return first || "there";
};

const relativeTime = (dateStr: string): string => {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
};

// ── Animation variants ───────────────────────────────────────────────────────

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: "easeOut" as const },
  },
};

// ── Quick-action templates ───────────────────────────────────────────────────

const QUICK_TEMPLATES = [
  {
    id: "blank",
    label: "Blank Note",
    icon: PlusIcon,
    color: "text-primary",
    bg: "bg-primary/10",
  },
  {
    id: "daily-standup",
    label: "Daily Standup",
    icon: CalendarIcon,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
  },
  {
    id: "meeting-agenda",
    label: "Meeting Notes",
    icon: ClipboardListIcon,
    color: "text-amber-500",
    bg: "bg-amber-500/10",
  },
  {
    id: "project-brief",
    label: "Project Brief",
    icon: BookOpenIcon,
    color: "text-violet-500",
    bg: "bg-violet-500/10",
  },
];

// ── Tag color palette ────────────────────────────────────────────────────────

// Ghost-tag dot colors for the premium tag pill style
const TAG_DOT_COLORS = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-violet-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-orange-500",
  "bg-indigo-500",
];

// ── Small activity sparkline ─────────────────────────────────────────────────

function MiniActivityChart({ notes }: { notes: any[] }) {
  const points = useMemo(() => {
    const now = new Date();
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now);
      d.setDate(d.getDate() - (6 - i));
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    });

    return days.map((dayStart, idx) => {
      const dayEnd = idx < 6 ? days[idx + 1] : Date.now();
      const count = notes.filter((n) => {
        const t = new Date(n.updatedAt).getTime();
        return t >= dayStart && t < dayEnd;
      }).length;
      return { day: dayStart, count };
    });
  }, [notes]);

  const max = Math.max(...points.map((p) => p.count), 1);
  const peakIdx = points.reduce(
    (mi, p, i, arr) => (p.count > arr[mi].count ? i : mi),
    0,
  );
  const dayLabels = ["M", "T", "W", "T", "F", "S", "S"];

  // Catmull-Rom → cubic Bézier sparkline
  const w = 200,
    h = 36,
    pad = 4;
  const step = (w - pad * 2) / (points.length - 1);
  const pts = points.map((p, i) => ({
    x: pad + i * step,
    y: h - pad - (p.count / max) * (h - pad * 2),
  }));

  let line = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(i - 1, 0)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(i + 2, pts.length - 1)];
    line += ` C ${p1.x + (p2.x - p0.x) / 6} ${p1.y + (p2.y - p0.y) / 6}, ${p2.x - (p3.x - p1.x) / 6} ${p2.y - (p3.y - p1.y) / 6}, ${p2.x} ${p2.y}`;
  }
  const area = `${line} L ${pts[pts.length - 1].x} ${h} L ${pts[0].x} ${h} Z`;

  return (
    <div className="space-y-2.5">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="w-full h-9"
        preserveAspectRatio="none"
      >
        <path d={area} className="fill-primary/10" />
        <path
          d={line}
          fill="none"
          className="stroke-primary/60"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {pts.map((pt, i) => {
          const isPeak = i === peakIdx && points[peakIdx].count > 0;
          const dayName = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][
            new Date(points[i].day).getDay()
          ];
          return (
            <circle
              key={i}
              cx={pt.x}
              cy={pt.y}
              r={isPeak ? 3.5 : 2.5}
              fill={isPeak ? "currentColor" : "white"}
              className={cn(
                isPeak ? "text-primary" : "stroke-primary",
                "cursor-pointer hover:r-4",
              )}
              strokeWidth={isPeak ? 0 : 1.5}
            >
              <title>
                {dayName}: {points[i].count} note
                {points[i].count !== 1 ? "s" : ""} edited
              </title>
            </circle>
          );
        })}
      </svg>
      <div className="flex justify-between px-0.5">
        {points.map((p, i) => {
          const dow = new Date(p.day).getDay();
          return (
            <span
              key={i}
              className="text-[10px] text-gray-500 dark:text-base-content/50 font-medium"
            >
              {dayLabels[dow === 0 ? 6 : dow - 1]}
            </span>
          );
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ═  DashboardPage
// ══════════════════════════════════════════════════════════════════════════════

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // ── Data queries ─────────────────────────────────────────────────────────
  const notesQuery = useQuery({
    queryKey: ["notes", "all"],
    queryFn: async () => {
      const res = await api.get("/notes", { params: { limit: "200" } });
      return Array.isArray(res.data?.data) ? res.data.data : [];
    },
    staleTime: 30_000,
  });

  const tagStatsQuery = useQuery({
    queryKey: ["tag-stats"],
    queryFn: async () => {
      const res = await api.get("/notes/tags/stats");
      return res.data?.tags ?? [];
    },
    staleTime: 300_000,
    enabled: (notesQuery.data?.length ?? 0) > 0,
  });

  const notes: any[] = notesQuery.data ?? [];
  const tagStats: any[] = tagStatsQuery.data ?? [];

  // ── Derived data ─────────────────────────────────────────────────────────
  const recentNotes = useMemo(
    () =>
      [...notes]
        .sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        )
        .slice(0, 8),
    [notes],
  );

  // Jump-back-in: exclude pinned notes to avoid redundancy with Pinned section
  const jumpBackInNotes = useMemo(
    () => recentNotes.filter((n) => !n.pinned).slice(0, 3),
    [recentNotes],
  );

  const [pinnedViewMode, setPinnedViewMode] = useState<"grid" | "list">("grid");

  const pinnedNotes = useMemo(
    () =>
      notes
        .filter((n) => n.pinned)
        .sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        ),
    [notes],
  );

  const priorityNotes = useMemo(
    () =>
      notes.filter(
        (n) =>
          !n.pinned &&
          n.tags?.some((t: string) =>
            ["priority", "project", "important"].includes(t.toLowerCase()),
          ),
      ),
    [notes],
  );

  const featuredNotes = useMemo(
    () => [...pinnedNotes, ...priorityNotes].slice(0, 6),
    [pinnedNotes, priorityNotes],
  );

  const topTags = useMemo(
    () =>
      [...tagStats]
        .sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
        .slice(0, 10),
    [tagStats],
  );

  // AI-style briefing
  const briefing = useMemo(() => {
    if (!notes.length) return null;

    const parts: string[] = [];

    // Action items count
    const actionItemCount = notes.reduce((sum, n) => {
      const items = n.aiSummary?.actionItems ?? [];
      return sum + items.filter((i: any) => !i.completed).length;
    }, 0);

    if (actionItemCount > 0) {
      parts.push(
        `You have **${actionItemCount}** open action item${actionItemCount !== 1 ? "s" : ""}`,
      );
    }

    // Last worked on
    if (recentNotes.length > 0) {
      const last = recentNotes[0];
      parts.push(
        `You were last working on **${last.title}** ${relativeTime(last.updatedAt)}`,
      );
    }

    // Weekly word count
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const weekNotes = notes.filter(
      (n) => new Date(n.updatedAt).getTime() > weekAgo,
    );
    const wordCount = weekNotes.reduce(
      (sum, n) => sum + countWords(n.content),
      0,
    );
    if (wordCount > 0) {
      parts.push(`**${wordCount.toLocaleString()}** words written this week`);
    }

    return parts.join(". ") + ".";
  }, [notes, recentNotes]);

  // Weekly word counts for the stats card
  const weeklyWordCount = useMemo(() => {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return notes
      .filter((n) => new Date(n.updatedAt).getTime() > weekAgo)
      .reduce((sum, n) => sum + countWords(n.content), 0);
  }, [notes]);

  const totalPinned = pinnedNotes.length;

  const thisWeekEditCount = useMemo(() => {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return notes.filter((n) => new Date(n.updatedAt).getTime() > weekAgo)
      .length;
  }, [notes]);

  const lastWeekEditCount = useMemo(() => {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
    return notes.filter((n) => {
      const t = new Date(n.updatedAt).getTime();
      return t > twoWeeksAgo && t <= weekAgo;
    }).length;
  }, [notes]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleQuickAction = useCallback(
    (templateId: string) => {
      if (templateId === "blank") {
        navigate("/create");
        return;
      }
      const tmpl = noteTemplates.find((t) => t.id === templateId);
      if (tmpl) {
        navigate("/create", {
          state: {
            title: tmpl.title,
            content: tmpl.content,
            tags: tmpl.tags,
          },
        });
      } else {
        navigate("/create");
      }
    },
    [navigate],
  );

  const handleTagFilter = useCallback(
    (tag: string) => {
      navigate(`/app?tag=${encodeURIComponent(tag)}`);
    },
    [navigate],
  );

  const loading = notesQuery.isLoading;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen flex-col bg-[#FAFAFA] dark:bg-base-200">
      <Navbar />

      <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-4 sm:px-6 lg:px-8">
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="space-y-4"
        >
          {/* ═══════════════════════════════════════════════════════════════
              1. HERO — Welcome + Quick Actions
          ═══════════════════════════════════════════════════════════════ */}
          <motion.section variants={fadeUp} className="space-y-2.5">
            {/* ── Welcome Panel ───────────────────────────────────────── */}
            <div className="rounded-xl bg-white dark:bg-base-100 px-5 py-4 sm:px-6 sm:py-4 shadow-[0_4px_12px_rgba(0,0,0,0.05)] ring-1 ring-gray-200 dark:ring-base-content/10">
              <h1 className="text-2xl sm:text-[1.65rem] font-bold text-slate-900 dark:text-base-content tracking-tight leading-tight">
                {getGreeting()},{" "}
                <span className="bg-gradient-to-r from-indigo-600 to-violet-500 bg-clip-text text-transparent">
                  {getFirstName(user?.name ?? "")}
                </span>
                <span className="text-slate-900 dark:text-base-content">.</span>
              </h1>

              {briefing && (
                <p className="mt-1.5 flex items-center gap-2 text-[13px] text-gray-500 dark:text-base-content/60 leading-relaxed">
                  <SparklesIcon className="size-3.5 flex-shrink-0 text-indigo-400" />
                  <span
                    dangerouslySetInnerHTML={{
                      __html: briefing.replace(
                        /\*\*(.*?)\*\*/g,
                        '<strong class="text-slate-700 dark:text-base-content/80 font-semibold">$1</strong>',
                      ),
                    }}
                  />
                </p>
              )}

              {recentNotes.length > 0 && (
                <div className="mt-2.5 pt-2.5 border-t border-gray-200/80 dark:border-base-300/30 flex items-center gap-4 flex-wrap">
                  <Link
                    to={`/note/${recentNotes[0]._id}`}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
                  >
                    <PenLineIcon className="size-3.5" />
                    Resume &ldquo;{recentNotes[0].title?.slice(0, 22)}
                    {recentNotes[0].title?.length > 22 ? "\u2026" : ""}&rdquo;
                    <ArrowRightIcon className="size-3" />
                  </Link>
                  <span className="hidden sm:flex items-center gap-3 text-xs text-gray-500 dark:text-base-content/55">
                    <span className="inline-flex items-center gap-1">
                      <ZapIcon className="size-3 text-emerald-500" />
                      <strong className="text-gray-700 dark:text-base-content/80 font-semibold tabular-nums">
                        {thisWeekEditCount}
                      </strong>
                      edited this week
                    </span>
                    <span className="text-gray-300 dark:text-base-content/20">
                      ·
                    </span>
                    <span>
                      <strong className="text-gray-700 dark:text-base-content/80 font-semibold tabular-nums">
                        {totalPinned}
                      </strong>{" "}
                      pinned
                    </span>
                  </span>
                </div>
              )}
            </div>

            {/* ── Quick Actions — horizontal strip ────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {QUICK_TEMPLATES.map((tmpl) => {
                const Icon = tmpl.icon;
                return (
                  <button
                    key={tmpl.id}
                    type="button"
                    onClick={() => handleQuickAction(tmpl.id)}
                    className={cn(
                      "group flex items-center gap-2.5 rounded-xl px-3.5 py-3",
                      "bg-white dark:bg-base-100 ring-1 ring-gray-200 dark:ring-base-content/10",
                      "shadow-sm hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] transition-all duration-150",
                      "hover:-translate-y-1 hover:ring-gray-300 dark:hover:ring-base-content/20",
                      "active:translate-y-0 active:shadow-sm active:ring-primary/30 active:bg-primary/[0.04] dark:active:bg-base-200",
                    )}
                  >
                    <span
                      className={cn(
                        "rounded-lg p-2 transition-transform duration-150 group-hover:scale-110 group-active:scale-95",
                        tmpl.bg,
                      )}
                    >
                      <Icon className={cn("size-[18px]", tmpl.color)} />
                    </span>
                    <span className="text-[13px] font-semibold text-gray-700 dark:text-base-content/75 group-hover:text-gray-900 dark:group-hover:text-base-content transition-colors">
                      {tmpl.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </motion.section>

          {/* ═══════════════════════════════════════════════════════════════
              2. MAIN SPLIT — Content (70%) + Right Rail (30%)
          ═══════════════════════════════════════════════════════════════ */}
          <motion.section
            variants={fadeUp}
            className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4"
          >
            {/* ── Left Column: Jump Back In + Pinned & Priority ───────── */}
            <div className="space-y-6">
              {/* ── Jump Back In (compact 2×2 grid) ───────────────────── */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-[13px] font-semibold text-gray-600 dark:text-base-content/60 flex items-center gap-1.5">
                    <ClockIcon className="size-3.5" />
                    Jump back in
                  </h2>
                  <Link
                    to="/app"
                    className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
                  >
                    View all <ArrowRightIcon className="size-3" />
                  </Link>
                </div>

                {loading ? (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div
                        key={i}
                        className="h-[72px] rounded-xl bg-base-300/20 animate-pulse"
                      />
                    ))}
                  </div>
                ) : recentNotes.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-gray-200 dark:border-base-300 bg-white/50 dark:bg-base-100/50 py-10 text-center">
                    <FileTextIcon className="mx-auto size-8 text-gray-300 dark:text-base-content/25 mb-2" />
                    <p className="text-sm text-gray-500 dark:text-base-content/50">
                      No notes yet. Create your first one!
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {jumpBackInNotes.map((note, idx) => (
                      <Link
                        key={note._id}
                        to={`/note/${note._id}`}
                        className={cn(
                          "group relative flex items-start gap-3 rounded-xl bg-white dark:bg-base-100 px-3.5 py-3",
                          "ring-1 ring-gray-200 dark:ring-base-content/10",
                          "shadow-sm hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] hover:ring-gray-300 dark:hover:ring-base-content/20",
                          "transition-all duration-200 cursor-pointer",
                          "hover:-translate-y-0.5 active:translate-y-0",
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <h3 className="text-[13px] font-semibold text-gray-900 dark:text-base-content truncate group-hover:text-primary transition-colors">
                              {note.title}
                            </h3>
                            <span className="text-[11px] text-gray-500 dark:text-base-content/50 whitespace-nowrap flex-shrink-0">
                              {relativeTime(note.updatedAt)}
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs text-gray-500 dark:text-base-content/55 line-clamp-1 leading-normal">
                            {note.content?.slice(0, 70) || "Empty note"}
                          </p>
                          {idx === 0 && (
                            <span className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-semibold text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                              Continue writing{" "}
                              <ArrowRightIcon className="size-2.5" />
                            </span>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Pinned & Priority ─────────────────────────────────── */}
              <div>
                <div className="mb-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <PinIcon className="size-3.5 text-amber-500" />
                    <h2 className="text-[13px] font-semibold text-gray-600 dark:text-base-content/60">
                      Pinned & priority
                    </h2>
                  </div>
                  <div className="flex items-center gap-3">
                    {featuredNotes.length > 0 && (
                      <span className="text-[11px] text-gray-500 dark:text-base-content/45 tabular-nums">
                        {featuredNotes.length} note
                        {featuredNotes.length !== 1 ? "s" : ""}
                      </span>
                    )}
                    <span className="h-3.5 w-px bg-gray-200 dark:bg-base-content/10" />
                    <div className="flex items-center rounded-lg ring-1 ring-gray-200 dark:ring-base-content/10 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setPinnedViewMode("grid")}
                        className={cn(
                          "p-1.5 transition-colors",
                          pinnedViewMode === "grid"
                            ? "bg-gray-100 dark:bg-base-300/50 text-gray-700 dark:text-base-content/80"
                            : "text-gray-400 dark:text-base-content/30 hover:text-gray-500 dark:hover:text-base-content/50",
                        )}
                        aria-label="Grid view"
                      >
                        <LayoutGridIcon className="size-3.5" />
                      </button>
                      <span className="w-px h-4 bg-gray-200 dark:bg-base-content/10" />
                      <button
                        type="button"
                        onClick={() => setPinnedViewMode("list")}
                        className={cn(
                          "p-1.5 transition-colors",
                          pinnedViewMode === "list"
                            ? "bg-gray-100 dark:bg-base-300/50 text-gray-700 dark:text-base-content/80"
                            : "text-gray-400 dark:text-base-content/30 hover:text-gray-500 dark:hover:text-base-content/50",
                        )}
                        aria-label="List view"
                      >
                        <LayoutListIcon className="size-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {loading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div
                        key={i}
                        className="h-44 rounded-xl bg-base-300/20 animate-pulse"
                      />
                    ))}
                  </div>
                ) : featuredNotes.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-gray-200 dark:border-base-300 bg-white/50 dark:bg-base-100/50 py-12 text-center">
                    <PinIcon className="mx-auto size-8 text-gray-300 dark:text-base-content/25 mb-2" />
                    <p className="text-sm text-gray-500 dark:text-base-content/50">
                      Pin notes or tag them with &ldquo;priority&rdquo; to see
                      them here.
                    </p>
                  </div>
                ) : (
                  <div
                    className={cn(
                      pinnedViewMode === "grid"
                        ? featuredNotes.length <= 2
                          ? "grid grid-cols-1 gap-3"
                          : "grid grid-cols-1 md:grid-cols-2 gap-3"
                        : "flex flex-col gap-2",
                    )}
                  >
                    {featuredNotes.map((note, noteIdx) => (
                      <Link
                        key={note._id}
                        to={`/note/${note._id}`}
                        className={cn(
                          "group rounded-xl cursor-pointer overflow-hidden",
                          "transition-all duration-200 hover:-translate-y-0.5",
                          note.pinned && noteIdx === 0
                            ? "bg-blue-50/40 dark:bg-primary/5 shadow-[0_4px_12px_rgba(0,0,0,0.05)] ring-1 ring-blue-200/40 dark:ring-primary/20 border-l-[3px] border-l-blue-500 dark:border-l-primary hover:shadow-[0_8px_20px_rgba(0,0,0,0.08)] hover:ring-blue-300/50"
                            : note.pinned
                              ? "bg-blue-50/25 dark:bg-primary/[0.03] shadow-[0_2px_8px_rgba(0,0,0,0.04)] ring-1 ring-blue-100/30 dark:ring-primary/15 border-l-[3px] border-l-blue-400/60 dark:border-l-primary/60 hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)] hover:ring-blue-200/40"
                              : "bg-white dark:bg-base-100 shadow-sm ring-1 ring-gray-200 dark:ring-base-content/10 border-l-[3px] border-l-transparent hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] hover:ring-gray-300",
                          pinnedViewMode === "list"
                            ? "px-3.5 py-2.5 pl-3"
                            : "px-3.5 py-3 pl-3",
                        )}
                      >
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <h3 className="text-[13px] font-semibold text-gray-900 dark:text-base-content group-hover:text-primary transition-colors truncate">
                            {note.title}
                          </h3>
                          <span className="flex items-center gap-1.5 flex-shrink-0">
                            {note.pinned && (
                              <PinIcon className="size-3 text-amber-500/70 dark:text-amber-400/70" />
                            )}
                            <span className="text-[11px] text-gray-500 dark:text-base-content/50 whitespace-nowrap">
                              {relativeTime(note.updatedAt)}
                            </span>
                          </span>
                        </div>

                        {pinnedViewMode === "grid" && (
                          <p className="text-xs text-gray-500 dark:text-base-content/55 line-clamp-2 leading-relaxed">
                            {note.content?.slice(0, 120) || "Empty note"}
                          </p>
                        )}

                        {note.tags?.length > 0 && (
                          <div
                            className={cn(
                              "flex flex-wrap gap-1",
                              pinnedViewMode === "grid" ? "mt-2" : "mt-1",
                            )}
                          >
                            {note.tags
                              .slice(0, 3)
                              .map((tag: string, tIdx: number) => (
                                <span
                                  key={tag}
                                  className={cn(
                                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
                                    "bg-gray-100 dark:bg-base-300/40 text-gray-600 dark:text-base-content/65",
                                  )}
                                >
                                  <span
                                    className={cn(
                                      "size-1.5 rounded-full flex-shrink-0",
                                      TAG_DOT_COLORS[
                                        tIdx % TAG_DOT_COLORS.length
                                      ],
                                    )}
                                  />
                                  {formatTagLabel(tag)}
                                </span>
                              ))}
                          </div>
                        )}
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Getting started — checklist (hidden at 8+ notes) ── */}
              {!loading &&
                notes.length < 8 &&
                (() => {
                  const steps = [
                    {
                      done: notes.length >= 3,
                      label: "Create a few notes",
                      desc: "Write your first thoughts or use a template",
                      to: "/create",
                      icon: PlusIcon,
                      color: "text-primary",
                      bg: "bg-primary/10",
                    },
                    {
                      done: totalPinned > 0,
                      label: "Pin something important",
                      desc: "Pinned notes stay at the top of your board",
                      to: "/app",
                      icon: PinIcon,
                      color: "text-amber-500",
                      bg: "bg-amber-500/10",
                    },
                    {
                      done: topTags.length >= 3,
                      label: "Add tags to organize",
                      desc: "Group related notes so they\u2019re easy to find",
                      to: "/app",
                      icon: TagIcon,
                      color: "text-violet-500",
                      bg: "bg-violet-500/10",
                    },
                  ];
                  const doneCount = steps.filter((s) => s.done).length;
                  if (doneCount === 3) return null;

                  return (
                    <div className="rounded-xl border-2 border-dashed border-gray-200 dark:border-base-content/10 bg-gray-50/50 dark:bg-base-100/50 p-4">
                      {/* Header + progress */}
                      <div className="flex items-start gap-2.5 mb-3">
                        <span className="rounded-lg bg-amber-50 dark:bg-amber-500/10 p-1.5 flex-shrink-0 mt-0.5">
                          <LightbulbIcon className="size-3.5 text-amber-500" />
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="text-[13px] font-semibold text-gray-600 dark:text-base-content/60">
                              Getting started
                            </h3>
                            <span className="text-[11px] text-gray-500 dark:text-base-content/45 tabular-nums flex-shrink-0">
                              {doneCount}/3 complete
                            </span>
                          </div>
                          <div className="mt-1.5 h-1 rounded-full bg-gray-200 dark:bg-base-300/30 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-primary/60 transition-all duration-500"
                              style={{
                                width: `${(doneCount / 3) * 100}%`,
                              }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Checklist */}
                      <div className="space-y-1">
                        {steps.map((step) => {
                          const StepIcon = step.icon;
                          return (
                            <Link
                              key={step.label}
                              to={step.to}
                              className={cn(
                                "group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all duration-150",
                                step.done
                                  ? "opacity-60"
                                  : "hover:bg-white dark:hover:bg-base-100/60 hover:shadow-sm hover:ring-1 hover:ring-gray-200 dark:hover:ring-base-content/10",
                              )}
                            >
                              <span
                                className={cn(
                                  "flex-shrink-0 size-6 rounded-full flex items-center justify-center transition-colors",
                                  step.done
                                    ? "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                    : cn(step.bg, step.color),
                                )}
                              >
                                {step.done ? (
                                  <span className="text-xs font-bold">
                                    \u2713
                                  </span>
                                ) : (
                                  <StepIcon className="size-3" />
                                )}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p
                                  className={cn(
                                    "text-[13px] font-medium transition-colors",
                                    step.done
                                      ? "text-gray-400 dark:text-base-content/35 line-through"
                                      : "text-gray-700 dark:text-base-content/75 group-hover:text-gray-900 dark:group-hover:text-base-content",
                                  )}
                                >
                                  {step.label}
                                </p>
                                {!step.done && (
                                  <p className="text-[11px] text-gray-500 dark:text-base-content/45 leading-snug mt-0.5">
                                    {step.desc}
                                  </p>
                                )}
                              </div>
                              {!step.done && (
                                <ChevronRightIcon className="size-3.5 text-gray-300 dark:text-base-content/20 group-hover:text-primary/60 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                              )}
                            </Link>
                          );
                        })}
                      </div>

                      <p className="mt-2.5 text-[11px] text-gray-500 dark:text-base-content/40 text-center">
                        This section disappears once you reach 8 notes
                      </p>
                    </div>
                  );
                })()}

              {/* ── Recent activity ─────────────────────────────────── */}
              {!loading && recentNotes.length > 0 && notes.length >= 5 && (
                <div>
                  <h2 className="text-[13px] font-semibold text-gray-600 dark:text-base-content/60 flex items-center gap-1.5 mb-2">
                    <FlameIcon className="size-3.5 text-orange-400/70" />
                    Recent activity
                  </h2>
                  <div className="rounded-xl bg-white dark:bg-base-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)] ring-1 ring-gray-100 dark:ring-base-content/8 overflow-hidden">
                    {recentNotes.slice(0, 5).map((note) => {
                      const updatedMs = new Date(note.updatedAt).getTime();
                      const createdMs = new Date(note.createdAt).getTime();
                      const wasEdited = updatedMs - createdMs > 60_000;
                      return (
                        <Link
                          key={note._id}
                          to={`/note/${note._id}`}
                          className="group flex items-center gap-3 px-4 py-2.5 border-b border-gray-100/80 dark:border-base-300/15 last:border-b-0 hover:bg-gray-50/80 dark:hover:bg-base-300/15 transition-colors"
                        >
                          <span
                            className={cn(
                              "flex-shrink-0 size-6 rounded-lg flex items-center justify-center",
                              wasEdited
                                ? "bg-blue-50 dark:bg-blue-500/10 text-blue-400"
                                : "bg-gray-50 dark:bg-base-300/30 text-gray-400 dark:text-base-content/40",
                            )}
                          >
                            {wasEdited ? (
                              <EditIcon className="size-3" />
                            ) : (
                              <EyeIcon className="size-3" />
                            )}
                          </span>
                          <div className="flex-1 min-w-0 flex items-baseline justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-[13px] font-medium text-gray-700 dark:text-base-content/75 truncate group-hover:text-primary transition-colors">
                                {note.title}
                              </p>
                              <p className="text-[10px] text-gray-400 dark:text-base-content/35 mt-0.5">
                                {wasEdited ? "Edited" : "Created"}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className="text-[11px] text-gray-400 dark:text-base-content/40 whitespace-nowrap">
                                {relativeTime(note.updatedAt)}
                              </span>
                              <ExternalLinkIcon className="size-3 text-gray-300 dark:text-base-content/25 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── Templates — shown for early users ──────────────── */}
              {!loading && notes.length < 12 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-[13px] font-semibold text-gray-600 dark:text-base-content/60 flex items-center gap-1.5">
                      <LayoutTemplateIcon className="size-3.5 text-indigo-400/70" />
                      Start from a template
                    </h2>
                    <button
                      type="button"
                      onClick={() => navigate("/create")}
                      className="text-[11px] font-medium text-gray-400 dark:text-base-content/40 hover:text-primary dark:hover:text-primary transition-colors flex items-center gap-0.5"
                    >
                      Browse all
                      <ChevronRightIcon className="size-3" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {noteTemplates.slice(0, 3).map((tmpl) => (
                      <button
                        key={tmpl.id}
                        type="button"
                        onClick={() =>
                          navigate("/create", {
                            state: {
                              title: tmpl.title,
                              content: tmpl.content,
                              tags: tmpl.tags,
                            },
                          })
                        }
                        className={cn(
                          "group text-left rounded-lg px-3.5 py-3",
                          "bg-white dark:bg-base-100 ring-1 ring-gray-200/70 dark:ring-base-content/10",
                          "shadow-[0_1px_4px_rgba(0,0,0,0.03)] hover:shadow-[0_6px_16px_rgba(0,0,0,0.08)] hover:ring-primary/35 dark:hover:ring-primary/30",
                          "hover:bg-primary/[0.02] dark:hover:bg-primary/[0.04]",
                          "transition-all duration-150 hover:-translate-y-1 active:translate-y-0 active:shadow-sm",
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[13px] font-semibold text-gray-700 dark:text-base-content/80 group-hover:text-primary transition-colors truncate">
                            {tmpl.name}
                          </p>
                          <ArrowRightIcon className="size-3.5 text-gray-300 dark:text-base-content/25 flex-shrink-0 -translate-x-1 opacity-0 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200" />
                        </div>
                        <p className="mt-0.5 text-[11px] text-gray-500 dark:text-base-content/50 line-clamp-1 leading-snug">
                          {tmpl.description}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ── Right Rail: Analytics + Tags ─────────────────────── */}
            <div className="flex flex-col gap-4">
              {/* Stats card */}
              <div className="rounded-xl bg-white dark:bg-base-100 p-4 shadow-[0_4px_12px_rgba(0,0,0,0.05)] ring-1 ring-gray-200 dark:ring-base-content/10">
                <h3 className="text-[13px] font-semibold text-gray-600 dark:text-base-content/60 mb-3 flex items-center gap-1.5">
                  <TrendingUpIcon className="size-3.5 text-primary/60" />
                  This week
                </h3>

                <div className="grid grid-cols-3 gap-1 mb-3">
                  <div className="text-center py-1.5">
                    <p className="text-xl font-bold text-gray-800 dark:text-base-content/90 tabular-nums leading-none">
                      {notes.length}
                    </p>
                    <p className="mt-1 text-[10px] text-gray-500 dark:text-base-content/50 font-medium uppercase tracking-wider">
                      Notes
                    </p>
                  </div>
                  <div className="text-center py-1.5 border-x border-gray-100 dark:border-base-300/30">
                    <p className="text-xl font-bold text-amber-500/80 tabular-nums leading-none">
                      {totalPinned}
                    </p>
                    <p className="mt-1 text-[10px] text-gray-500 dark:text-base-content/50 font-medium uppercase tracking-wider">
                      Pinned
                    </p>
                  </div>
                  <div className="text-center py-1.5">
                    <p className="text-xl font-bold text-emerald-500/80 tabular-nums leading-none">
                      {weeklyWordCount.toLocaleString()}
                    </p>
                    <p className="mt-1 text-[10px] text-gray-500 dark:text-base-content/50 font-medium uppercase tracking-wider">
                      Words
                    </p>
                  </div>
                </div>

                {/* Mini activity sparkline */}
                <div className="pt-2.5 border-t border-gray-100 dark:border-base-300/30">
                  <div className="flex items-baseline justify-between mb-2">
                    <p className="text-[10px] text-gray-500 dark:text-base-content/50 font-medium">
                      Notes edited · 7 days
                    </p>
                    <div className="flex items-center gap-2">
                      {lastWeekEditCount > 0 &&
                        thisWeekEditCount !== lastWeekEditCount && (
                          <span
                            className={cn(
                              "text-[10px] font-medium",
                              thisWeekEditCount > lastWeekEditCount
                                ? "text-emerald-500"
                                : "text-rose-400",
                            )}
                          >
                            {thisWeekEditCount > lastWeekEditCount
                              ? "\u2191"
                              : "\u2193"}
                            {Math.abs(thisWeekEditCount - lastWeekEditCount)} vs
                            last wk
                          </span>
                        )}
                      <p className="text-[10px] text-gray-500 dark:text-base-content/50 font-medium tabular-nums">
                        {thisWeekEditCount} total
                      </p>
                    </div>
                  </div>
                  <MiniActivityChart notes={notes} />
                </div>
              </div>

              {/* Smart Tags */}
              <div className="rounded-xl bg-white dark:bg-base-100 p-4 shadow-[0_4px_12px_rgba(0,0,0,0.05)] ring-1 ring-gray-200 dark:ring-base-content/10">
                <h3 className="text-[13px] font-semibold text-gray-600 dark:text-base-content/60 mb-2.5 flex items-center gap-1.5">
                  <TagIcon className="size-3.5 text-violet-500" />
                  Smart tags
                </h3>

                {topTags.length === 0 ? (
                  <p className="text-xs text-gray-500 dark:text-base-content/45 py-2">
                    Tags will appear here as you label your notes.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {topTags.slice(0, 5).map((t: any, idx: number) => (
                      <button
                        key={t.tag ?? t._id}
                        type="button"
                        onClick={() => handleTagFilter(t.tag ?? t._id)}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                          "bg-gray-100 dark:bg-base-300/40 text-gray-600 dark:text-base-content/70",
                          "transition-all duration-150 hover:bg-gray-200 dark:hover:bg-base-300/60",
                        )}
                      >
                        <span
                          className={cn(
                            "size-1.5 rounded-full flex-shrink-0",
                            TAG_DOT_COLORS[idx % TAG_DOT_COLORS.length],
                          )}
                        />
                        {formatTagLabel(t.tag ?? t._id)}
                      </button>
                    ))}
                    {topTags.length > 5 && (
                      <button
                        type="button"
                        onClick={() => navigate("/app")}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
                          "bg-primary/10 text-primary hover:bg-primary/20 transition-colors",
                        )}
                      >
                        +{topTags.length - 5} more
                        <ChevronRightIcon className="size-3" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </motion.section>
        </motion.div>
      </main>
    </div>
  );
}
