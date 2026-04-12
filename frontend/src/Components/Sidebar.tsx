import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, m } from "framer-motion";
import {
  BookmarkIcon,
  FolderPlusIcon,
  LayoutTemplateIcon,
  MoreVerticalIcon,
  PencilLineIcon,
  Trash2Icon,
  Share2Icon,
  GlobeIcon,
  HistoryIcon,
  BarChart3Icon,
  NotebookIcon,
  LayersIcon,
  XIcon,
  HomeIcon,
  InboxIcon,
  ChevronRightIcon,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "../lib/cn";
import { formatTagLabel, normalizeTag } from "../lib/Utils";
import { notebookIconComponents } from "../pages/home/homePageUtils";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Notebook {
  id: string;
  name: string;
  color?: string | null;
  icon?: string | null;
  noteCount?: number;
}

export interface SavedQuery {
  id: string;
  name: string;
  query?: string;
  filters?: {
    tags?: string[];
    minWords?: number;
  };
  sort?: Record<string, unknown>;
}

export interface SidebarProps {
  /** Which notebook is currently active */
  activeNotebookId: string;
  /** Called when user clicks a notebook */
  onSelectNotebook: (id: string) => void;
  /** List of notebooks */
  notebooks: Notebook[];
  /** Number of uncategorized notes */
  uncategorizedCount: number;
  /** Total notes across all notebooks */
  totalCount: number;
  /** Loading state */
  loading?: boolean;
  /** Error state */
  error?: boolean;
  /** Notebook actions */
  onCreateNotebook: () => void;
  onBrowseTemplates: () => void;
  onShareNotebook?: (notebook: Notebook) => void;
  onPublishNotebook?: (notebook: Notebook) => void;
  onHistoryNotebook?: (notebook: Notebook) => void;
  onAnalyticsNotebook?: (notebook: Notebook) => void;
  onRenameNotebook?: (notebook: Notebook) => void;
  onSaveAsTemplate?: (notebook: Notebook) => void;
  onDeleteNotebook?: (notebook: Notebook) => void;
  /** Analytics enabled */
  analyticsEnabled?: boolean;
  /** Saved views */
  savedQueriesEnabled?: boolean;
  savedQueries?: SavedQuery[];
  savedQueriesLoading?: boolean;
  appliedSavedQuery?: SavedQuery | null;
  onApplySavedQuery?: (query: SavedQuery) => void;
  onDeleteSavedQuery?: (queryId: string) => void;
  onSaveCurrentView?: () => void;
  savingView?: boolean;
  /** Compact stats */
  noteCount?: number;
  pinnedCount?: number;
  avgWords?: number;
  /** Mobile overlay state */
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  /** Drop zone integration */
  renderNotebookDropZone?: (
    notebookId: string,
    children: (props: { setNodeRef?: ((node: HTMLElement | null) => void); isOver: boolean }) => ReactNode,
  ) => ReactNode;
  /** Drag disabled */
  dragDisabled?: boolean;
}

// ─── Collapsible section (for notebook groups) ──────────────────────────────

function CollapsibleSection({
  title,
  defaultOpen = true,
  count,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  count?: number;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center gap-1.5 px-1 py-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-base-content/40 hover:text-base-content/60 transition-colors"
      >
        <ChevronRightIcon
          className={cn(
            "size-3 transition-transform duration-200",
            open && "rotate-90",
          )}
        />
        <span>{title}</span>
        {typeof count === "number" && (
          <span className="text-[10px] tabular-nums text-base-content/30">
            {count}
          </span>
        )}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <m.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="mt-0.5 space-y-0.5">{children}</div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Sidebar content (shared between desktop & mobile) ───────────────────────

function SidebarContent({
  activeNotebookId,
  onSelectNotebook,
  notebooks,
  uncategorizedCount,
  totalCount,
  loading,
  error,
  onCreateNotebook,
  onBrowseTemplates,
  onShareNotebook,
  onPublishNotebook,
  onHistoryNotebook,
  onAnalyticsNotebook,
  onRenameNotebook,
  onSaveAsTemplate,
  onDeleteNotebook,
  analyticsEnabled,
  savedQueriesEnabled,
  savedQueries = [],
  savedQueriesLoading,
  appliedSavedQuery,
  onApplySavedQuery,
  onDeleteSavedQuery,
  onSaveCurrentView,
  savingView,
  noteCount = 0,
  pinnedCount = 0,
  avgWords = 0,
  renderNotebookDropZone,
  dragDisabled,
}: Omit<SidebarProps, "mobileOpen" | "onMobileClose">) {
  // Portal-based context menu — escapes the overflow-y-auto scroll container
  const [menuState, setMenuState] = useState<{
    notebook: Notebook;
    style: React.CSSProperties;
  } | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setIsMounted(true); }, []);
  useEffect(() => {
    if (!menuState) return;
    const handleDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) {
        setMenuState(null);
      }
    };
    document.addEventListener("mousedown", handleDown);
    return () => document.removeEventListener("mousedown", handleDown);
  }, [menuState]);

  const renderItem = useCallback(
    (
      id: string,
      label: string,
      count: number,
      icon?: ReactNode,
      color?: string | null,
      notebook?: Notebook | null,
    ) => {
      const isActive = activeNotebookId === id;

      const itemContent = (dropProps?: {
        setNodeRef?: ((node: HTMLElement | null) => void);
        isOver: boolean;
      }) => (
        <div className="relative group" ref={dropProps?.setNodeRef}>
          <button
            type="button"
            onClick={() => onSelectNotebook(id)}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-150",
              isActive
                ? "bg-primary/10 text-primary"
                : "text-base-content/60 hover:bg-base-content/[0.04] hover:text-base-content/80",
              dropProps?.isOver && "ring-2 ring-primary/40 bg-primary/5",
            )}
          >
            {icon && (
              <span
                className={cn(
                  "flex-shrink-0",
                  isActive ? "text-primary" : "text-base-content/50",
                )}
                style={color ? { color } : undefined}
              >
                {icon}
              </span>
            )}
            <span className="flex-1 truncate text-left">{label}</span>
            <span
              className={cn(
                "text-[11px] font-medium tabular-nums rounded-full min-w-[1.25rem] text-center",
                isActive ? "text-primary/70" : "text-base-content/30",
                notebook ? "group-hover:opacity-0 transition-opacity" : "",
              )}
            >
              {count}
            </span>
          </button>

          {/* Context menu trigger — menu rendered via portal to escape overflow-y-auto */}
          {notebook && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                type="button"
                className="btn btn-ghost btn-xs btn-circle"
                onClick={(e) => {
                  e.stopPropagation();
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  setMenuState({
                    notebook,
                    style: {
                      top: rect.bottom + 4,
                      left: Math.max(8, rect.right - 192),
                    },
                  });
                }}
              >
                <MoreVerticalIcon className="size-3.5" />
              </button>
            </div>
          )}
        </div>
      );

      if (renderNotebookDropZone && !dragDisabled) {
        return renderNotebookDropZone(id, (props) => itemContent(props));
      }

      return itemContent({ isOver: false });
    },
    [
      activeNotebookId,
      onSelectNotebook,
      setMenuState,
      renderNotebookDropZone,
      dragDisabled,
    ],
  );

  return (
    <>
      <div className="flex h-full flex-col">
      {/* ── Notebooks section ────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <div className="mb-3 flex items-center justify-between px-1">
          <span className="section-label">
            Notebooks
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onBrowseTemplates}
              className="btn btn-ghost btn-xs btn-circle"
              title="Templates"
            >
              <LayoutTemplateIcon className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={onCreateNotebook}
              className="btn btn-ghost btn-xs btn-circle"
              title="New notebook"
            >
              <FolderPlusIcon className="size-3.5" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="space-y-1.5 px-1">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={`skel-${i}`}
                className="h-9 w-full animate-pulse rounded-lg bg-base-200/60"
              />
            ))}
          </div>
        ) : error ? (
          <p className="px-3 py-2 text-xs text-error">
            Unable to load notebooks.
          </p>
        ) : (
          <nav
            className="space-y-0.5"
            aria-label="Notebooks"
            onKeyDown={(e) => {
              if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
              e.preventDefault();
              const buttons = Array.from(
                e.currentTarget.querySelectorAll<HTMLButtonElement>(
                  ":scope > div > .relative > button, :scope > div > button, :scope > button",
                ),
              );
              const idx = buttons.indexOf(
                document.activeElement as HTMLButtonElement,
              );
              if (idx === -1) return;
              const next =
                e.key === "ArrowDown"
                  ? buttons[(idx + 1) % buttons.length]
                  : buttons[(idx - 1 + buttons.length) % buttons.length];
              next?.focus();
            }}
          >
            {/* Home dashboard link */}
            <Link
              to="/home"
              className={cn(
                "flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-150",
                "text-base-content/60 hover:bg-base-content/[0.04] hover:text-base-content/80",
              )}
            >
              <HomeIcon className="size-4" />
              Home
            </Link>

            <div className="my-1.5 border-t border-base-content/[0.05]" />

            {renderItem(
              "all",
              "All notes",
              totalCount,
              <LayersIcon className="size-4" />,
            )}
            {renderItem(
              "uncategorized",
              "Uncategorized",
              uncategorizedCount,
              <InboxIcon className="size-4" />,
            )}

            {/* ── My Notebooks (collapsible) ────────────────────── */}
            {notebooks.length > 0 && (
              <CollapsibleSection
                title="My Notebooks"
                defaultOpen
                count={notebooks.length}
              >
                {notebooks.map((nb) => {
                  const IconComp: React.ElementType =
                    (nb.icon ? notebookIconComponents[nb.icon] : undefined) ??
                    NotebookIcon;
                  const hasColor =
                    typeof nb.color === "string" && nb.color.length > 0;
                  return (
                    <div key={nb.id}>
                      {renderItem(
                        nb.id,
                        nb.name,
                        nb.noteCount ?? 0,
                        <IconComp
                          className="size-4"
                          style={hasColor ? { color: nb.color! } : undefined}
                        />,
                        nb.color,
                        nb,
                      )}
                    </div>
                  );
                })}
              </CollapsibleSection>
            )}
          </nav>
        )}

        {/* ── Saved views ────────────────────────────────────────── */}
        {savedQueriesEnabled && (
          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="section-label">
                Saved views
              </span>
              {onSaveCurrentView && (
                <button
                  type="button"
                  onClick={onSaveCurrentView}
                  disabled={savingView}
                  className="btn btn-ghost btn-xs btn-circle"
                  title="Save current view"
                >
                  <BookmarkIcon className="size-3.5" />
                </button>
              )}
            </div>

            {savedQueriesLoading ? (
              <div className="space-y-1.5 px-1">
                {[1, 2].map((k) => (
                  <div
                    key={k}
                    className="h-8 w-full animate-pulse rounded-lg bg-base-200/60"
                  />
                ))}
              </div>
            ) : savedQueries.length > 0 ? (
              <div className="space-y-0.5">
                {savedQueries.map((q) => {
                  const isActive = appliedSavedQuery?.id === q.id;
                  return (
                    <div
                      key={q.id}
                      className="group relative flex items-center"
                    >
                      <button
                        type="button"
                        onClick={() => onApplySavedQuery?.(q)}
                        className={cn(
                          "flex-1 truncate rounded-lg px-3 py-2 text-left text-sm transition-colors",
                          isActive
                            ? "bg-primary/10 font-semibold text-primary"
                            : "text-base-content/60 hover:bg-base-300/20 hover:text-base-content",
                        )}
                      >
                        {q.name}
                      </button>
                      {onDeleteSavedQuery && (
                        <button
                          type="button"
                          onClick={() => onDeleteSavedQuery(q.id)}
                          className="btn btn-ghost btn-xs btn-circle opacity-0 group-hover:opacity-100 transition-opacity absolute right-1"
                          title="Delete saved view"
                        >
                          <Trash2Icon className="size-3" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="px-3 py-2 text-xs text-base-content/40">
                Save a set of filters to reopen them with one click.
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── Compact stats footer ─────────────────────────────────── */}
      <div className="border-t border-base-content/[0.06] px-4 py-3">
        <div className="flex items-center gap-2 text-[11px] text-base-content/40 tabular-nums">
          <span className="rounded-md bg-base-content/[0.04] px-1.5 py-0.5 font-medium">{noteCount}</span>
          <span>notes</span>
          <span className="text-base-content/15">·</span>
          <span className="rounded-md bg-base-content/[0.04] px-1.5 py-0.5 font-medium">{pinnedCount}</span>
          <span>pinned</span>
          <span className="text-base-content/15">·</span>
          <span className="rounded-md bg-base-content/[0.04] px-1.5 py-0.5 font-medium">{avgWords}</span>
          <span>avg</span>
        </div>
      </div>
    </div>

    {/* Portal context menu — renders at body level to escape overflow-y-auto clipping */}
    {isMounted && menuState && createPortal(
      <div
        ref={menuRef}
        className="fixed z-[200] min-w-[12rem] space-y-0.5 rounded-xl border border-base-300/80 bg-base-100 p-1.5 shadow-xl"
        style={menuState.style}
      >
        {onShareNotebook && (
          <button
            type="button"
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-base-content transition-colors hover:bg-base-300/25"
            onClick={(e) => { e.stopPropagation(); onShareNotebook(menuState.notebook); setMenuState(null); }}
          >
            <Share2Icon className="size-4 text-base-content/70" />
            Share & members
          </button>
        )}
        {onPublishNotebook && (
          <button
            type="button"
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-base-content transition-colors hover:bg-base-300/25"
            onClick={(e) => { e.stopPropagation(); onPublishNotebook(menuState.notebook); setMenuState(null); }}
          >
            <GlobeIcon className="size-4 text-base-content/70" />
            Publish
          </button>
        )}
        {onHistoryNotebook && (
          <button
            type="button"
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-base-content transition-colors hover:bg-base-300/25"
            onClick={(e) => { e.stopPropagation(); onHistoryNotebook(menuState.notebook); setMenuState(null); }}
          >
            <HistoryIcon className="size-4 text-base-content/70" />
            History & undo
          </button>
        )}
        {analyticsEnabled && onAnalyticsNotebook && (
          <button
            type="button"
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-base-content transition-colors hover:bg-base-300/25"
            onClick={(e) => { e.stopPropagation(); onAnalyticsNotebook(menuState.notebook); setMenuState(null); }}
          >
            <BarChart3Icon className="size-4 text-base-content/70" />
            Analytics
          </button>
        )}
        {onRenameNotebook && (
          <button
            type="button"
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-base-content transition-colors hover:bg-base-300/25"
            onClick={(e) => { e.stopPropagation(); onRenameNotebook(menuState.notebook); setMenuState(null); }}
          >
            <PencilLineIcon className="size-4 text-base-content/70" />
            Rename
          </button>
        )}
        {onSaveAsTemplate && (
          <button
            type="button"
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-base-content transition-colors hover:bg-base-300/25"
            onClick={(e) => { e.stopPropagation(); onSaveAsTemplate(menuState.notebook); setMenuState(null); }}
          >
            <LayoutTemplateIcon className="size-4 text-base-content/70" />
            Save as template
          </button>
        )}
        {onDeleteNotebook && (
          <>
            <div className="my-1 h-px bg-base-300/50" />
            <button
              type="button"
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-error transition-colors hover:bg-error/10"
              onClick={(e) => { e.stopPropagation(); onDeleteNotebook(menuState.notebook); setMenuState(null); }}
            >
              <Trash2Icon className="size-4" />
              Delete
            </button>
          </>
        )}
      </div>,
      document.body,
    )}
    </>
  );
}

// ─── Main Sidebar export ─────────────────────────────────────────────────────

function Sidebar(props: SidebarProps) {
  const { mobileOpen, onMobileClose, ...contentProps } = props;

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:w-[210px] wide:w-[240px] lg:flex-shrink-0 lg:flex-col border-r border-base-content/[0.06] bg-base-100 h-[calc(100vh-73px)] sticky top-[73px]">
        <SidebarContent {...contentProps} />
      </aside>

      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <m.div
              key="sidebar-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm lg:hidden"
              onClick={onMobileClose}
            />
            <m.aside
              key="sidebar-panel"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="fixed inset-y-0 left-0 z-[61] w-[280px] max-w-[85vw] bg-base-100 shadow-2xl lg:hidden"
            >
              <div className="flex items-center justify-between border-b border-base-300/40 px-4 py-3">
                <span className="text-sm font-semibold text-base-content">
                  Notebooks
                </span>
                <button
                  type="button"
                  onClick={onMobileClose}
                  className="btn btn-ghost btn-sm btn-circle"
                >
                  <XIcon className="size-4" />
                </button>
              </div>
              <div className="h-[calc(100%-57px)]">
                <SidebarContent {...contentProps} />
              </div>
            </m.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

export default Sidebar;
