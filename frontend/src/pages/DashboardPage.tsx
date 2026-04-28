import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { PinIcon, ArrowUpRightIcon, LayoutPanelTopIcon } from "lucide-react";
import useAuth from "../hooks/useAuth";
import api from "../lib/axios";
import { countWords } from "../lib/Utils";
import { noteTemplates } from "../lib/noteTemplates";
import { useCommandPalette } from "../contexts/CommandPaletteContext";
import DashboardShell, {
  useDashboardShell,
} from "../Components/dashboard/DashboardShell";
import DashboardSidebar from "../Components/dashboard/DashboardSidebar";
import DashboardTopbar from "../Components/dashboard/DashboardTopbar";
import TweaksPanel from "../Components/dashboard/TweaksPanel";
import ActivityHeatmap from "../Components/dashboard/ActivityHeatmap";
import { useActivityHeatmap } from "../hooks/useActivityHeatmap";

interface Note {
  _id: string;
  title?: string;
  content?: string;
  tags?: string[];
  pinned?: boolean;
  updatedAt: string;
  createdAt?: string;
  notebookId?: string | null;
}

interface Notebook {
  id: string;
  name: string;
  color?: string | null;
  noteCount?: number;
}

const getGreeting = (): string => {
  const h = new Date().getHours();
  if (h < 5) return "Good night";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 21) return "Good evening";
  return "Good night";
};

const getFirstName = (name?: string): string => {
  const first = name?.trim().split(/\s+/)[0];
  return first || "there";
};

const monoDate = (d: Date): string => {
  const day = d.toLocaleDateString(undefined, { weekday: "short" });
  const rest = d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  const time = d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${day} · ${rest} · ${time}`;
};

const relTime = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
};

const inferOp = (n: Note): "edit" | "create" | "pin" => {
  if (n.pinned) return "pin";
  const updated = new Date(n.updatedAt).getTime();
  const created = n.createdAt ? new Date(n.createdAt).getTime() : updated;
  return updated - created > 60_000 ? "edit" : "create";
};

// ══════════════════════════════════════════════════════════════════════════
// Inner component — rendered inside DashboardShell so it can consume context
// ══════════════════════════════════════════════════════════════════════════

function DashboardInner() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { registerCommands } = useCommandPalette();
  const { tweaks, toggleTweaks, toggleSidebar } = useDashboardShell();

  // ── Data queries ─────────────────────────────────────────────────────
  const notesQuery = useQuery({
    queryKey: ["notes", "all"],
    queryFn: async () => {
      const res = await api.get("/notes", { params: { limit: "200" } });
      return Array.isArray(res.data?.data) ? (res.data.data as Note[]) : [];
    },
    staleTime: 30_000,
  });

  const tagStatsQuery = useQuery({
    queryKey: ["tag-stats"],
    queryFn: async () => {
      const res = await api.get("/notes/tags/stats");
      return res.data ?? {};
    },
    staleTime: 300_000,
    enabled: (notesQuery.data?.length ?? 0) > 0,
  });

  const notebooksQuery = useQuery({
    queryKey: ["notebooks"],
    queryFn: async () => {
      const response = await api.get("/notebooks");
      const payload = response.data ?? {};
      return {
        notebooks: Array.isArray(payload.notebooks)
          ? (payload.notebooks as Array<{
              id?: string;
              _id?: string;
              name: string;
              color?: string;
              noteCount?: number;
            }>)
          : [],
        uncategorizedCount: (payload.uncategorizedCount ?? 0) as number,
      };
    },
    staleTime: 120_000,
  });

  const heatmap = useActivityHeatmap(98);

  const notes = useMemo(() => notesQuery.data ?? [], [notesQuery.data]);
  const tagStats = useMemo<{ tag: string; count: number }[]>(() => {
    const raw = tagStatsQuery.data;
    const list = Array.isArray(raw) ? raw : (raw?.tags ?? []);
    if (!Array.isArray(list)) return [];
    return list.map(
      (t: { tag?: string; _id?: string; count?: number }) => ({
        tag: t.tag ?? t._id ?? "",
        count: t.count ?? 0,
      }),
    );
  }, [tagStatsQuery.data]);

  const notebooks = useMemo<Notebook[]>(
    () =>
      (notebooksQuery.data?.notebooks ?? [])
        .map((nb) => ({
          id: (nb.id ?? nb._id) as string,
          name: nb.name,
          color: nb.color,
          noteCount: nb.noteCount,
        }))
        .filter((nb) => Boolean(nb.id)),
    [notebooksQuery.data],
  );

  // ── Derived data ─────────────────────────────────────────────────────
  const recentNotes = useMemo(
    () =>
      [...notes]
        .sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        )
        .slice(0, 10),
    [notes],
  );

  const jumpBackInNotes = useMemo(
    () => recentNotes.filter((n) => !n.pinned).slice(0, 3),
    [recentNotes],
  );

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

  const focusHero = pinnedNotes[0];
  const focusStack = pinnedNotes.slice(1, 3);

  const topTags = useMemo(
    () =>
      tagStats
        .filter((t) => Boolean(t.tag))
        .sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
        .slice(0, 8),
    [tagStats],
  );

  const notebookById = useMemo(() => {
    const m = new Map<string, Notebook>();
    notebooks.forEach((nb) => m.set(nb.id, nb));
    return m;
  }, [notebooks]);

  const lastSynced = useMemo(() => {
    const d = notesQuery.dataUpdatedAt || notebooksQuery.dataUpdatedAt;
    return d ? new Date(d) : null;
  }, [notesQuery.dataUpdatedAt, notebooksQuery.dataUpdatedAt]);

  // ── Command palette dynamic registrations ────────────────────────────
  useEffect(() => {
    return registerCommands([
      {
        id: "dash:new-note",
        label: "New note",
        section: "Quick actions",
        shortcut: "N",
        action: () => navigate("/create"),
      },
      {
        id: "dash:toggle-sidebar",
        label: "Toggle sidebar",
        section: "Quick actions",
        action: () => toggleSidebar(),
      },
      {
        id: "dash:toggle-tweaks",
        label: "Toggle tweaks panel",
        section: "Quick actions",
        action: () => toggleTweaks(),
      },
    ]);
  }, [registerCommands, navigate, toggleSidebar, toggleTweaks]);

  useEffect(() => {
    if (!pinnedNotes.length) return;
    return registerCommands(
      pinnedNotes.slice(0, 8).map((n) => ({
        id: `dash:pinned:${n._id}`,
        label: n.title || "Untitled",
        section: "Pinned",
        action: () => navigate(`/note/${n._id}`),
      })),
    );
  }, [registerCommands, pinnedNotes, navigate]);

  useEffect(() => {
    if (!recentNotes.length) return;
    return registerCommands(
      recentNotes.slice(0, 10).map((n) => ({
        id: `dash:recent:${n._id}`,
        label: n.title || "Untitled",
        description: relTime(n.updatedAt),
        section: "Recent",
        action: () => navigate(`/note/${n._id}`),
      })),
    );
  }, [registerCommands, recentNotes, navigate]);

  useEffect(() => {
    if (!notebooks.length) return;
    return registerCommands(
      notebooks.slice(0, 8).map((nb) => ({
        id: `dash:nb:${nb.id}`,
        label: nb.name,
        section: "Notebooks",
        action: () =>
          navigate(`/app?notebook=${encodeURIComponent(nb.id)}`),
      })),
    );
  }, [registerCommands, notebooks, navigate]);

  // ── Render ───────────────────────────────────────────────────────────
  const now = new Date();
  const wordsWk = heatmap.data?.wordsLastWeek ?? 0;
  const streak = heatmap.data?.currentStreak ?? 0;

  return (
    <>
      <DashboardSidebar
        notebooks={notebooks}
        tags={topTags}
        allNotesCount={notes.length}
        pinnedCount={pinnedNotes.length}
        uncategorizedCount={notebooksQuery.data?.uncategorizedCount ?? 0}
        trashCount={0}
        templatesCount={noteTemplates.length}
      />
      <div style={{ minWidth: 0 }}>
        <DashboardTopbar lastSynced={lastSynced} />
        <div className="ds-content">
          {/* ── Page header ───────────────────────────────────────────── */}
          <header className="ds-pg-head">
            <div>
              <span className="ds-hello">
                {getGreeting()}, {getFirstName(user?.name)}
              </span>
              <h1>Your workspace is quiet today.</h1>
              <div className="ds-sub">
                <span>{monoDate(now)}</span>
                {recentNotes[0] && (
                  <>
                    <span>·</span>
                    <span>
                      resume{" "}
                      <Link to={`/note/${recentNotes[0]._id}`}>
                        {recentNotes[0].title?.slice(0, 40) || "Untitled"}
                      </Link>
                    </span>
                  </>
                )}
              </div>
            </div>
            <div className="ds-pg-stats">
              <div className="ds-s">
                <span className="ds-v">{notes.length}</span>
                <span className="ds-l">notes</span>
              </div>
              <div className="ds-s">
                <span className="ds-v">{pinnedNotes.length}</span>
                <span className="ds-l">pinned</span>
              </div>
              <div className="ds-s">
                <span className="ds-v">{wordsWk.toLocaleString()}</span>
                <span className="ds-l">words/wk</span>
              </div>
              <div className="ds-s">
                <span className="ds-v">{streak}</span>
                <span className="ds-l">streak</span>
              </div>
            </div>
          </header>

          {/* ── Today's focus ─────────────────────────────────────────── */}
          <section className="ds-sec" style={{ marginTop: 0 }}>
            <div className="ds-sec-head">
              <h2>
                Today&rsquo;s focus
                {pinnedNotes.length > 0 && (
                  <span className="ds-count">
                    {pinnedNotes.length} pinned
                  </span>
                )}
              </h2>
              <Link to="/app?pinned=1" className="ds-link">
                view all
              </Link>
            </div>

            {focusHero ? (
              <div className="ds-focus">
                <Link
                  to={`/note/${focusHero._id}`}
                  className="ds-focus-card primary"
                >
                  <div className="ds-focus-meta">
                    <span className="ds-pin">
                      <PinIcon size={11} /> PINNED
                    </span>
                    <span className="ds-dotsep">·</span>
                    <span>{relTime(focusHero.updatedAt)}</span>
                    {focusHero.notebookId &&
                      notebookById.get(focusHero.notebookId) && (
                        <>
                          <span className="ds-dotsep">·</span>
                          <span>
                            {notebookById.get(focusHero.notebookId)!.name}
                          </span>
                        </>
                      )}
                  </div>
                  <h3>{focusHero.title || "Untitled"}</h3>
                  <p>
                    {(focusHero.content || "").slice(0, 220) ||
                      "Start writing to fill this card."}
                  </p>
                  {!!focusHero.tags?.length && (
                    <div className="ds-tags">
                      {Array.from(new Set(focusHero.tags))
                        .slice(0, 4)
                        .map((t) => (
                          <span key={t} className="ds-tag">
                            <span className="ds-sw" />
                            {t}
                          </span>
                        ))}
                    </div>
                  )}
                  <div className="ds-foot">
                    <span>
                      {countWords(focusHero.content).toLocaleString()} words
                    </span>
                    <span style={{ color: "var(--ds-accent)" }}>
                      open <ArrowUpRightIcon size={11} />
                    </span>
                  </div>
                </Link>

                <div className="ds-focus-stack">
                  {focusStack.length > 0 ? (
                    focusStack.map((n) => (
                      <Link
                        key={n._id}
                        to={`/note/${n._id}`}
                        className="ds-focus-card"
                      >
                        <div className="ds-focus-meta">
                          <span className="ds-pin">
                            <PinIcon size={10} /> PINNED
                          </span>
                          <span className="ds-dotsep">·</span>
                          <span>{relTime(n.updatedAt)}</span>
                        </div>
                        <h3>{n.title || "Untitled"}</h3>
                        <p>{(n.content || "").slice(0, 140)}</p>
                      </Link>
                    ))
                  ) : (
                    <div className="ds-focus-card">
                      <div className="ds-focus-meta">
                        <span>no second pin yet</span>
                      </div>
                      <p style={{ color: "var(--ds-ink-4)" }}>
                        Pin another note to see it here.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="ds-focus-empty">
                Nothing pinned. Pin a note from the notes list to feature it
                here.
              </div>
            )}
          </section>

          {/* ── Continue writing ──────────────────────────────────────── */}
          <section className="ds-sec">
            <div className="ds-sec-head">
              <h2>
                Continue writing
                {jumpBackInNotes.length > 0 && (
                  <span className="ds-count">
                    {jumpBackInNotes.length} drafts
                  </span>
                )}
              </h2>
              <Link to="/app" className="ds-link">
                all notes
              </Link>
            </div>

            {jumpBackInNotes.length > 0 ? (
              <div className="ds-cw-row">
                {jumpBackInNotes.map((n) => (
                  <Link key={n._id} to={`/note/${n._id}`} className="ds-cw">
                    <div className="ds-cw-top">
                      <span>{relTime(n.updatedAt)}</span>
                      <span>{countWords(n.content)}w</span>
                    </div>
                    <h4>{n.title || "Untitled"}</h4>
                    <p className="ds-preview">
                      {(n.content || "").slice(0, 140) || "Empty draft"}
                    </p>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="ds-focus-empty">
                Your drafts will appear here once you start editing.
              </div>
            )}
          </section>

          {/* ── Split-3: heatmap / templates / notebooks ──────────────── */}
          <div className="ds-split-3">
            <ActivityHeatmap days={98} />

            <div className="ds-panel" style={{ padding: 0, overflow: "hidden" }}>
              <div className="ds-p-head" style={{ padding: "14px 16px 10px" }}>
                <span className="ds-p-title">Templates</span>
                <button
                  type="button"
                  onClick={() => navigate("/create")}
                  className="ds-link"
                >
                  browse all
                </button>
              </div>
              <div className="ds-tpl-list">
                {noteTemplates.slice(0, 5).map((t, idx) => (
                  <button
                    key={t.id}
                    type="button"
                    className="ds-tpl"
                    onClick={() =>
                      navigate("/create", {
                        state: {
                          title: t.title,
                          content: t.content,
                          tags: t.tags,
                        },
                      })
                    }
                  >
                    <span className="ds-ix">{String(idx + 1).padStart(2, "0")}</span>
                    <div className="ds-tpl-body">
                      <span className="ds-t">{t.name}</span>
                      <span className="ds-d">{t.description}</span>
                    </div>
                    <span className="ds-go">
                      use <ArrowUpRightIcon size={10} />
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="ds-panel">
              <div className="ds-p-head">
                <span className="ds-p-title">Notebooks</span>
                <span className="ds-p-meta">{notebooks.length}</span>
              </div>
              {notebooks.length > 0 ? (
                <div className="ds-nb-list">
                  {notebooks.slice(0, 4).map((nb) => (
                    <button
                      key={nb.id}
                      type="button"
                      className="ds-nb"
                      onClick={() =>
                        navigate(
                          `/app?notebook=${encodeURIComponent(nb.id)}`,
                        )
                      }
                    >
                      <span
                        className="ds-nb-sw"
                        style={
                          nb.color ? { background: nb.color } : undefined
                        }
                      />
                      <div>
                        <div className="ds-nb-name">{nb.name}</div>
                        <div className="ds-nb-sub">
                          {(nb.noteCount ?? 0).toLocaleString()} notes
                        </div>
                      </div>
                      <span className="ds-nb-count">
                        {nb.noteCount ?? 0}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div
                  style={{
                    color: "var(--ds-ink-4)",
                    fontFamily: "var(--ds-mono)",
                    fontSize: 11,
                    padding: "12px 0",
                  }}
                >
                  No notebooks yet.
                </div>
              )}
            </div>
          </div>

          {/* ── Recent activity log ───────────────────────────────────── */}
          <section className="ds-sec">
            <div className="ds-sec-head">
              <h2>
                <LayoutPanelTopIcon size={11} /> Recent activity
              </h2>
              <Link to="/app" className="ds-link">
                open notes
              </Link>
            </div>

            <div className="ds-log">
              <div className="ds-row head">
                <span>time</span>
                <span>op</span>
                <span>note</span>
                <span className="ds-nb-col">notebook</span>
                <span className="ds-words">words</span>
              </div>
              {recentNotes.slice(0, 6).map((n) => {
                const op = inferOp(n);
                const nb = n.notebookId
                  ? notebookById.get(n.notebookId)
                  : null;
                return (
                  <Link
                    key={n._id}
                    to={`/note/${n._id}`}
                    className="ds-row"
                  >
                    <span className="ds-ts">{relTime(n.updatedAt)}</span>
                    <span className="ds-op">
                      <span className={`ds-op-pill ${op}`}>{op}</span>
                    </span>
                    <span className="ds-name">
                      {n.title || "Untitled"}
                    </span>
                    <span className="ds-nb-col">
                      {nb?.name ?? "—"}
                    </span>
                    <span className="ds-words">
                      {countWords(n.content).toLocaleString()}
                    </span>
                  </Link>
                );
              })}
              {recentNotes.length === 0 && (
                <div
                  className="ds-row"
                  style={{ color: "var(--ds-ink-4)", cursor: "default" }}
                >
                  <span>—</span>
                  <span>—</span>
                  <span>No activity yet</span>
                  <span className="ds-nb-col">—</span>
                  <span className="ds-words">—</span>
                </div>
              )}
            </div>
          </section>

          {/* ── Keyboard hint bar ─────────────────────────────────────── */}
          <div className="ds-kbar">
            <span className="ds-k">
              <kbd>⌘</kbd>
              <kbd>K</kbd> palette
            </span>
            <span className="ds-k">
              <kbd>N</kbd> new note
            </span>
            <span className="ds-k">
              <kbd>G</kbd>
              <kbd>D</kbd> dashboard
            </span>
            <span className="ds-k">
              <kbd>?</kbd> shortcuts
            </span>
            <span className="ds-k" style={{ marginLeft: "auto" }}>
              tweaks: {tweaks.theme} · {tweaks.accent} · {tweaks.density}
            </span>
          </div>
        </div>
      </div>
      <TweaksPanel />
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// Outer wrapper — applies the shell's data-attr and CSS tokens
// ══════════════════════════════════════════════════════════════════════════

export default function DashboardPage() {
  return (
    <DashboardShell>
      <DashboardInner />
    </DashboardShell>
  );
}
