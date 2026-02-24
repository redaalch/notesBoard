import { type ReactNode, useCallback, useMemo, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BookmarkIcon,
  ChevronDownIcon,
  FolderPlusIcon,
  LayoutTemplateIcon,
  MoreVerticalIcon,
  PencilLineIcon,
  Trash2Icon,
  Share2Icon,
  GlobeIcon,
  HistoryIcon,
  BarChart3Icon,
  SparklesIcon,
  NotebookIcon,
  NotebookPenIcon,
  LightbulbIcon,
  StarIcon,
  RocketIcon,
  TargetIcon,
  PaletteIcon,
  LayersIcon,
  BookOpenIcon,
  WorkflowIcon,
  CalendarIcon,
  ListTodoIcon,
  BookmarkIcon as BookmarkIconAlt,
  BriefcaseBusinessIcon,
  BrainIcon,
  XIcon,
  SearchIcon,
  TagIcon,
  ListTodoIcon as ListTodoAlt,
} from "lucide-react";
import { cn } from "../lib/cn";
import { formatTagLabel, normalizeTag } from "../lib/Utils";

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
    children: (props: { setNodeRef?: any; isOver: boolean }) => ReactNode,
  ) => ReactNode;
  /** Drag disabled */
  dragDisabled?: boolean;
}

// ─── Icon mapping ────────────────────────────────────────────────────────────

const notebookIconComponents: Record<string, React.ElementType> = {
  Notebook: NotebookIcon,
  NotebookPen: NotebookPenIcon,
  Sparkles: SparklesIcon,
  Lightbulb: LightbulbIcon,
  Star: StarIcon,
  Rocket: RocketIcon,
  Target: TargetIcon,
  Palette: PaletteIcon,
  Layers: LayersIcon,
  BookOpen: BookOpenIcon,
  Workflow: WorkflowIcon,
  Calendar: CalendarIcon,
  ListTodo: ListTodoIcon,
  Bookmark: BookmarkIconAlt,
  BriefcaseBusiness: BriefcaseBusinessIcon,
  Brain: BrainIcon,
};

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
        setNodeRef?: any;
        isOver: boolean;
      }) => (
        <div className="relative group" ref={dropProps?.setNodeRef}>
          <button
            type="button"
            onClick={() => onSelectNotebook(id)}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150",
              isActive
                ? "bg-primary/10 text-primary border-l-[3px] border-primary pl-[calc(0.75rem-3px)]"
                : "text-base-content/70 hover:bg-base-200/60 hover:text-base-content",
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
                "text-xs font-semibold tabular-nums",
                isActive ? "text-primary/80" : "text-base-content/40",
              )}
            >
              {count}
            </span>
          </button>

          {/* Context menu for custom notebooks */}
          {notebook && (
            <div className="dropdown dropdown-end dropdown-bottom absolute right-1 top-1/2 -translate-y-1/2 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                type="button"
                tabIndex={0}
                className="btn btn-ghost btn-xs btn-circle"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVerticalIcon className="size-3.5" />
              </button>
              <ul className="dropdown-content z-30 min-w-[12rem] space-y-0.5 rounded-xl border border-base-300/80 bg-base-100 p-1.5 shadow-xl">
                {onShareNotebook && (
                  <li>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-base-content transition-colors hover:bg-base-200/80"
                      onClick={(e) => {
                        e.stopPropagation();
                        onShareNotebook(notebook);
                      }}
                    >
                      <Share2Icon className="size-4 text-base-content/70" />
                      Share & members
                    </button>
                  </li>
                )}
                {onPublishNotebook && (
                  <li>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-base-content transition-colors hover:bg-base-200/80"
                      onClick={(e) => {
                        e.stopPropagation();
                        onPublishNotebook(notebook);
                      }}
                    >
                      <GlobeIcon className="size-4 text-base-content/70" />
                      Publish
                    </button>
                  </li>
                )}
                {onHistoryNotebook && (
                  <li>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-base-content transition-colors hover:bg-base-200/80"
                      onClick={(e) => {
                        e.stopPropagation();
                        onHistoryNotebook(notebook);
                      }}
                    >
                      <HistoryIcon className="size-4 text-base-content/70" />
                      History & undo
                    </button>
                  </li>
                )}
                {analyticsEnabled && onAnalyticsNotebook && (
                  <li>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-base-content transition-colors hover:bg-base-200/80"
                      onClick={(e) => {
                        e.stopPropagation();
                        onAnalyticsNotebook(notebook);
                      }}
                    >
                      <BarChart3Icon className="size-4 text-base-content/70" />
                      Analytics
                    </button>
                  </li>
                )}
                {onRenameNotebook && (
                  <li>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-base-content transition-colors hover:bg-base-200/80"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRenameNotebook(notebook);
                      }}
                    >
                      <PencilLineIcon className="size-4 text-base-content/70" />
                      Rename
                    </button>
                  </li>
                )}
                {onSaveAsTemplate && (
                  <li>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-base-content transition-colors hover:bg-base-200/80"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSaveAsTemplate(notebook);
                      }}
                    >
                      <LayoutTemplateIcon className="size-4 text-base-content/70" />
                      Save as template
                    </button>
                  </li>
                )}
                {onDeleteNotebook && (
                  <>
                    <div className="my-1 h-px bg-base-300/50" />
                    <li>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-error transition-colors hover:bg-error/10"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteNotebook(notebook);
                        }}
                      >
                        <Trash2Icon className="size-4" />
                        Delete
                      </button>
                    </li>
                  </>
                )}
              </ul>
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
      analyticsEnabled,
      onShareNotebook,
      onPublishNotebook,
      onHistoryNotebook,
      onAnalyticsNotebook,
      onRenameNotebook,
      onSaveAsTemplate,
      onDeleteNotebook,
      renderNotebookDropZone,
      dragDisabled,
    ],
  );

  return (
    <div className="flex h-full flex-col">
      {/* ── Notebooks section ────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <div className="mb-3 flex items-center justify-between px-1">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-base-content/50">
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
            {renderItem("all", "All notes", totalCount)}
            {renderItem("uncategorized", "Uncategorized", uncategorizedCount)}
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
          </nav>
        )}

        {/* ── Saved views ────────────────────────────────────────── */}
        {savedQueriesEnabled && (
          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-base-content/50">
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
                            : "text-base-content/60 hover:bg-base-200/60 hover:text-base-content",
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
      <div className="border-t border-base-300/40 px-4 py-3">
        <div className="flex items-center justify-between text-xs text-base-content/50 tabular-nums">
          <span>{noteCount} notes</span>
          <span className="text-base-content/20" aria-hidden="true">
            ·
          </span>
          <span>{pinnedCount} pinned</span>
          <span className="text-base-content/20" aria-hidden="true">
            ·
          </span>
          <span>{avgWords} avg words</span>
        </div>
      </div>
    </div>
  );
}

// ─── Main Sidebar export ─────────────────────────────────────────────────────

function Sidebar(props: SidebarProps) {
  const { mobileOpen, onMobileClose, ...contentProps } = props;

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:w-[240px] lg:flex-shrink-0 lg:flex-col border-r border-base-300/40 bg-base-100/50 h-[calc(100vh-73px)] sticky top-[73px]">
        <SidebarContent {...contentProps} />
      </aside>

      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              key="sidebar-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm lg:hidden"
              onClick={onMobileClose}
            />
            <motion.aside
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
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

export default Sidebar;
