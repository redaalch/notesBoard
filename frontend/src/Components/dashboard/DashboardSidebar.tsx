import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  HomeIcon,
  FileTextIcon,
  PinIcon,
  InboxIcon,
  LayoutTemplateIcon,
  Trash2Icon,
  SearchIcon,
  PanelLeftIcon,
  HashIcon,
  PlusIcon,
  MoreHorizontalIcon,
  PencilIcon,
  Share2Icon,
  Globe2Icon,
  HistoryIcon,
  BarChart3Icon,
  BookmarkIcon,
  DownloadIcon,
  TrashIcon,
} from "lucide-react";
import useAuth from "../../hooks/useAuth";
import { useCommandPalette } from "../../contexts/CommandPaletteContext";
import { useDashboardShell } from "./DashboardShell";

export type DashboardView =
  | "dashboard"
  | "all"
  | "pinned"
  | "uncategorized"
  | "templates"
  | "trash"
  | `notebook:${string}`
  | `tag:${string}`;

export interface SidebarNotebook {
  id: string;
  name: string;
  color?: string | null;
  noteCount?: number;
}

export interface SidebarTag {
  tag: string;
  count: number;
}

export interface NotebookMenuActions {
  onRename?: (id: string) => void;
  onShare?: (id: string) => void;
  onPublish?: (id: string) => void;
  onHistory?: (id: string) => void;
  onAnalytics?: (id: string) => void;
  onSaveAsTemplate?: (id: string) => void;
  onExport?: (id: string) => void;
  onDelete?: (id: string) => void;
}

interface DashboardSidebarProps {
  notebooks: SidebarNotebook[];
  tags: SidebarTag[];
  allNotesCount: number;
  pinnedCount: number;
  uncategorizedCount: number;
  trashCount?: number;
  templatesCount?: number;
  activeView?: DashboardView;
  onSelectView?: (view: DashboardView) => void;
  onCreateNotebook?: () => void;
  notebookActions?: NotebookMenuActions;
}

const initials = (name?: string | null): string => {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const second = parts[1]?.[0] ?? "";
  return (first + second).toUpperCase() || first.toUpperCase() || "?";
};

export default function DashboardSidebar({
  notebooks,
  tags,
  allNotesCount,
  pinnedCount,
  uncategorizedCount,
  trashCount = 0,
  templatesCount = 0,
  activeView = "dashboard",
  onSelectView,
  onCreateNotebook,
  notebookActions,
}: DashboardSidebarProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { openPalette } = useCommandPalette();
  const { toggleSidebar } = useDashboardShell();
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!openMenuId) return;
    const onDocClick = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpenMenuId(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenMenuId(null);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [openMenuId]);

  const go = (view: DashboardView, fallbackPath: string) => {
    if (onSelectView) onSelectView(view);
    else navigate(fallbackPath);
  };

  const isActive = (v: DashboardView) => activeView === v;

  const hasMenu =
    !!notebookActions &&
    Object.values(notebookActions).some((fn) => typeof fn === "function");

  return (
    <aside className="ds-sb">
      <div className="ds-sb-top">
        <div className="ds-brand">
          <div className="ds-brand-mark">N</div>
          <span>NOTES</span>
          <b>Board</b>
        </div>
        <button
          type="button"
          className="ds-chip"
          title="Collapse sidebar"
          onClick={toggleSidebar}
        >
          <PanelLeftIcon size={14} />
        </button>
      </div>

      <button type="button" className="ds-sb-search" onClick={openPalette}>
        <SearchIcon size={14} />
        <span>Search notes</span>
        <span className="ds-kbd">
          <kbd>⌘</kbd>
          <kbd>K</kbd>
        </span>
      </button>

      <div className="ds-sb-section">
        <span>WORKSPACE</span>
      </div>
      <nav className="ds-sb-list">
        <button
          type="button"
          className={`ds-sb-item${isActive("dashboard") ? " active" : ""}`}
          onClick={() => navigate("/home")}
        >
          <span className="ds-ico">
            <HomeIcon size={14} />
          </span>
          <span>Dashboard</span>
          <span className="ds-kbd">
            <kbd>G</kbd>
            <kbd>D</kbd>
          </span>
        </button>
        <button
          type="button"
          className={`ds-sb-item${isActive("all") ? " active" : ""}`}
          onClick={() => go("all", "/app")}
        >
          <span className="ds-ico">
            <FileTextIcon size={14} />
          </span>
          <span>All notes</span>
          <span className="ds-num">{allNotesCount}</span>
        </button>
        <button
          type="button"
          className={`ds-sb-item${isActive("pinned") ? " active" : ""}`}
          onClick={() => go("pinned", "/app?pinned=1")}
        >
          <span className="ds-ico">
            <PinIcon size={14} />
          </span>
          <span>Pinned</span>
          <span className="ds-num">{pinnedCount}</span>
        </button>
        <button
          type="button"
          className={`ds-sb-item${isActive("uncategorized") ? " active" : ""}`}
          onClick={() => go("uncategorized", "/app?notebook=uncategorized")}
        >
          <span className="ds-ico">
            <InboxIcon size={14} />
          </span>
          <span>Uncategorized</span>
          <span className="ds-num">{uncategorizedCount}</span>
        </button>
        <button
          type="button"
          className={`ds-sb-item${isActive("templates") ? " active" : ""}`}
          onClick={() => navigate("/create")}
        >
          <span className="ds-ico">
            <LayoutTemplateIcon size={14} />
          </span>
          <span>Templates</span>
          <span className="ds-num">{templatesCount}</span>
        </button>
        <button
          type="button"
          className={`ds-sb-item${isActive("trash") ? " active" : ""}`}
          onClick={() => go("trash", "/app?view=trash")}
        >
          <span className="ds-ico">
            <Trash2Icon size={14} />
          </span>
          <span>Trash</span>
          <span className="ds-num">{trashCount}</span>
        </button>
      </nav>

      <div className="ds-sb-section">
        <span>NOTEBOOKS</span>
        <span className="ds-count">{notebooks.length}</span>
        {onCreateNotebook && (
          <button
            type="button"
            onClick={onCreateNotebook}
            title="New notebook"
            style={{
              background: "transparent",
              border: "none",
              color: "var(--ds-ink-3)",
              cursor: "pointer",
              marginLeft: 4,
              padding: 2,
            }}
          >
            <PlusIcon size={12} />
          </button>
        )}
      </div>
      {notebooks.length > 0 ? (
        <nav className="ds-sb-list" style={{ position: "relative" }}>
          {notebooks.slice(0, 16).map((nb) => {
            const active = isActive(`notebook:${nb.id}` as DashboardView);
            return (
              <div
                key={nb.id}
                className="ds-sb-row"
                style={{ position: "relative" }}
              >
                <button
                  type="button"
                  className={`ds-sb-item${active ? " active" : ""}${hasMenu ? " has-menu" : ""}`}
                  onClick={() =>
                    go(
                      `notebook:${nb.id}` as DashboardView,
                      `/app?notebook=${encodeURIComponent(nb.id)}`,
                    )
                  }
                >
                  <span className="ds-ico">
                    <span
                      className="ds-sb-dot"
                      style={nb.color ? { background: nb.color } : undefined}
                    />
                  </span>
                  <span>{nb.name}</span>
                  {!hasMenu && (
                    <span className="ds-num">{nb.noteCount ?? 0}</span>
                  )}
                </button>
                {hasMenu && (
                  <button
                    type="button"
                    className="ds-sb-menu"
                    aria-label={`Actions for ${nb.name}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenMenuId((id) => (id === nb.id ? null : nb.id));
                    }}
                  >
                    <MoreHorizontalIcon size={12} />
                  </button>
                )}
                {openMenuId === nb.id && notebookActions && (
                  <div
                    ref={menuRef}
                    className="ds-menu"
                    style={{ top: "100%", left: 12, marginTop: 2 }}
                  >
                    {notebookActions.onRename && (
                      <button
                        type="button"
                        onClick={() => {
                          setOpenMenuId(null);
                          notebookActions.onRename!(nb.id);
                        }}
                      >
                        <PencilIcon size={12} /> Rename
                      </button>
                    )}
                    {notebookActions.onShare && (
                      <button
                        type="button"
                        onClick={() => {
                          setOpenMenuId(null);
                          notebookActions.onShare!(nb.id);
                        }}
                      >
                        <Share2Icon size={12} /> Share
                      </button>
                    )}
                    {notebookActions.onPublish && (
                      <button
                        type="button"
                        onClick={() => {
                          setOpenMenuId(null);
                          notebookActions.onPublish!(nb.id);
                        }}
                      >
                        <Globe2Icon size={12} /> Publish
                      </button>
                    )}
                    {notebookActions.onHistory && (
                      <button
                        type="button"
                        onClick={() => {
                          setOpenMenuId(null);
                          notebookActions.onHistory!(nb.id);
                        }}
                      >
                        <HistoryIcon size={12} /> History
                      </button>
                    )}
                    {notebookActions.onAnalytics && (
                      <button
                        type="button"
                        onClick={() => {
                          setOpenMenuId(null);
                          notebookActions.onAnalytics!(nb.id);
                        }}
                      >
                        <BarChart3Icon size={12} /> Analytics
                      </button>
                    )}
                    {notebookActions.onSaveAsTemplate && (
                      <button
                        type="button"
                        onClick={() => {
                          setOpenMenuId(null);
                          notebookActions.onSaveAsTemplate!(nb.id);
                        }}
                      >
                        <BookmarkIcon size={12} /> Save as template
                      </button>
                    )}
                    {notebookActions.onExport && (
                      <button
                        type="button"
                        onClick={() => {
                          setOpenMenuId(null);
                          notebookActions.onExport!(nb.id);
                        }}
                      >
                        <DownloadIcon size={12} /> Export
                      </button>
                    )}
                    {notebookActions.onDelete && (
                      <>
                        <hr />
                        <button
                          type="button"
                          className="danger"
                          onClick={() => {
                            setOpenMenuId(null);
                            notebookActions.onDelete!(nb.id);
                          }}
                        >
                          <TrashIcon size={12} /> Delete
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      ) : null}

      {tags.length > 0 && (
        <>
          <div className="ds-sb-section">
            <span>TAGS</span>
          </div>
          <nav className="ds-sb-list">
            {tags.slice(0, 8).map((t) => {
              const active = isActive(`tag:${t.tag}` as DashboardView);
              return (
                <button
                  key={t.tag}
                  type="button"
                  className={`ds-sb-item${active ? " active" : ""}`}
                  onClick={() =>
                    go(
                      `tag:${t.tag}` as DashboardView,
                      `/app?tag=${encodeURIComponent(t.tag)}`,
                    )
                  }
                >
                  <span className="ds-ico" style={{ color: "var(--ds-ink-4)" }}>
                    <HashIcon size={12} />
                  </span>
                  <span>{t.tag}</span>
                  <span className="ds-num">{t.count}</span>
                </button>
              );
            })}
          </nav>
        </>
      )}

      <div className="ds-sb-footer">
        <div className="ds-avatar">{initials(user?.name)}</div>
        <div className="ds-who">
          <b>{user?.name ?? "You"}</b>
          <span>{user?.email ?? ""}</span>
        </div>
      </div>
    </aside>
  );
}
