import { useState, useRef, type CSSProperties } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { m } from "framer-motion";
import {
  EyeIcon,
  GripVerticalIcon,
  LoaderIcon,
  PinIcon,
  PinOffIcon,
  TrashIcon,
  UsersIcon,
  SparklesIcon,
  BookmarkIcon,
  BookmarkPlusIcon,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import {
  formatRelativeTime,
  formatTagLabel,
  normalizeTag,
  stripMarkdown,
} from "../lib/Utils";
import api from "../lib/axios";
import { extractApiError } from "../lib/extractApiError";
import { toast } from "sonner";
import ConfirmDialog from "./ConfirmDialog";

export interface NoteObject {
  _id: string;
  title?: string;
  content?: string;
  tags?: string[];
  pinned?: boolean;
  createdAt: string;
  updatedAt?: string;
  notebookRole?: string | null;
  effectiveRole?: string | null;
  [key: string]: unknown;
}

export interface NoteCardProps {
  note: NoteObject;
  onTagClick?: (tag: string) => void;
  selectedTags?: string[];
  selectionMode?: boolean;
  selected?: boolean;
  onSelectionChange?: (
    noteId: string,
    checked: boolean,
    meta: { event: React.MouseEvent | React.ChangeEvent | null },
  ) => void;
  customizeMode?: boolean;
  dragHandleProps?: Record<string, unknown> | null;
  dragHandleRef?: React.Ref<HTMLButtonElement> | null;
  innerRef?: React.Ref<HTMLElement> | null;
  style?: CSSProperties;
  dragging?: boolean;
  cardDragProps?: Record<string, unknown> | null;
  onOpenInsights?: ((note: NoteObject) => void) | null;
}

function NoteCard({
  note,
  onTagClick,
  selectedTags = [],
  selectionMode = false,
  selected = false,
  onSelectionChange,
  customizeMode = false,
  dragHandleProps = null,
  dragHandleRef = null,
  innerRef = null,
  style,
  dragging = false,
  cardDragProps = null,
  onOpenInsights = null,
}: NoteCardProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pinning, setPinning] = useState(false);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [showActions, setShowActions] = useState(false);
  const touchStartX = useRef(0);

  const handleSelectionChange = (
    checked: boolean,
    event: React.MouseEvent | React.ChangeEvent | null = null,
  ) => {
    if (typeof onSelectionChange === "function") {
      onSelectionChange(note._id, checked, { event });
    }
  };

  const toggleSelection = (event: React.MouseEvent) => {
    handleSelectionChange(!selected, event);
  };

  const updateNotesCache = (updater: (prev: NoteObject[]) => NoteObject[]) => {
    queryClient.setQueriesData<NoteObject[]>(
      { queryKey: ["notes"] },
      (previous) => {
        if (!Array.isArray(previous)) return previous;
        return updater(previous);
      },
    );
  };

  const invalidateNotesQueries = ({ tags = false } = {}) =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["notes"] }),
      ...(tags
        ? [queryClient.invalidateQueries({ queryKey: ["tag-stats"] })]
        : []),
    ]);

  const openConfirm = (event: React.MouseEvent) => {
    event.preventDefault();
    setConfirmOpen(true);
  };

  const closeConfirm = () => {
    if (!deleting) {
      setConfirmOpen(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/notes/${note._id}`);
      updateNotesCache((prev) => prev.filter((item) => item._id !== note._id));
      toast.success("Your note has been deleted successfully");
      setConfirmOpen(false);
      await invalidateNotesQueries({ tags: true });
    } catch (error) {
      if (import.meta.env.DEV) console.error("Error deleting the note", error);
      toast.error("Failed to delete the note");
    } finally {
      setDeleting(false);
    }
  };

  const handleTogglePin = async (event?: React.MouseEvent) => {
    event?.preventDefault();
    event?.stopPropagation();
    if (pinning) return;

    const desiredPinned = !note.pinned;
    setPinning(true);

    try {
      const response = await api.put(`/notes/${note._id}`, {
        pinned: desiredPinned,
      });

      const responseData = response?.data ?? {};
      const updatedPinned =
        typeof responseData.pinned === "boolean"
          ? responseData.pinned
          : desiredPinned;
      const updatedTags = Array.isArray(responseData.tags)
        ? responseData.tags
        : (note.tags ?? []);
      updateNotesCache((prev) =>
        prev.map((item) =>
          item._id === note._id
            ? {
                ...item,
                ...responseData,
                pinned: updatedPinned,
                tags: updatedTags,
              }
            : item,
        ),
      );

      toast.success(
        updatedPinned ? "Note pinned to top" : "Note removed from pinned",
      );
      await invalidateNotesQueries();
    } catch (error: unknown) {
      if (import.meta.env.DEV) console.error("Error toggling pin state", error);
      toast.error(extractApiError(error, "Failed to update pin status"));
    } finally {
      setPinning(false);
    }
  };

  const createdAt = new Date(note.createdAt);
  const updatedAt = note.updatedAt ? new Date(note.updatedAt) : createdAt;
  const effectiveRole = note?.effectiveRole ?? null;
  const isViewOnly = effectiveRole === "viewer";
  const isShared = Boolean(note?.notebookRole && note.notebookRole !== "owner");
  const cleanContent = stripMarkdown(note.content ?? "");

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (selectionMode || customizeMode || dragging) return;
    const deltaX = e.touches[0].clientX - touchStartX.current;
    if (Math.abs(deltaX) > 10) {
      setSwipeOffset(deltaX);
      setShowActions(true);
    }
  };

  const handleTouchEnd = () => {
    if (selectionMode || customizeMode || dragging) return;
    if (swipeOffset < -80) {
      setSwipeOffset(-120);
    } else if (swipeOffset > 80) {
      setSwipeOffset(120);
    } else {
      setSwipeOffset(0);
      setShowActions(false);
    }
  };

  const noteClass = [
    "ds-note",
    note.pinned ? "pinned" : "",
    selected ? "selected" : "",
    dragging ? "dragging" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <div style={{ position: "relative", height: "100%" }}>
        {showActions && (
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              zIndex: 0,
              ...(swipeOffset < 0
                ? { justifyContent: "flex-end", paddingRight: 16 }
                : { justifyContent: "flex-start", paddingLeft: 16 }),
            }}
          >
            {swipeOffset < 0 ? (
              <button
                type="button"
                className="ds-note-ibtn danger"
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirmOpen(true);
                  setSwipeOffset(0);
                  setShowActions(false);
                }}
                aria-label="Delete note"
              >
                <TrashIcon size={14} /> Delete
              </button>
            ) : (
              <button
                type="button"
                className="ds-note-ibtn"
                onClick={(e) => {
                  e.stopPropagation();
                  handleTogglePin();
                  setSwipeOffset(0);
                  setShowActions(false);
                }}
                disabled={pinning}
                aria-label={note.pinned ? "Unpin note" : "Pin note"}
              >
                {note.pinned ? <PinOffIcon size={14} /> : <PinIcon size={14} />}
                {note.pinned ? "Unpin" : "Pin"}
              </button>
            )}
          </m.div>
        )}

        <m.article
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          ref={innerRef as React.Ref<HTMLElement>}
          style={{ ...style, position: "relative", zIndex: 1 }}
          {...(cardDragProps ?? {})}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0, x: swipeOffset }}
          exit={{ opacity: 0, scale: 0.97 }}
          transition={{ type: "spring", stiffness: 300, damping: 24 }}
          className={noteClass}
          onClick={
            selectionMode
              ? (event: React.MouseEvent) => toggleSelection(event)
              : () => {
                  if (swipeOffset !== 0) {
                    setSwipeOffset(0);
                    setShowActions(false);
                    return;
                  }
                  navigate(`/note/${note._id}`);
                }
          }
          role="group"
          aria-pressed={selectionMode ? selected : undefined}
        >
          <header className="ds-note-head">
            {selectionMode && !customizeMode && (
              <input
                type="checkbox"
                className="ds-note-check"
                checked={selected}
                onChange={(event) => {
                  event.stopPropagation();
                  handleSelectionChange(event.target.checked, event);
                }}
                onClick={(e) => e.stopPropagation()}
                aria-label={selected ? "Deselect note" : "Select note"}
              />
            )}
            <h3 className="ds-note-title">{note.title || "Untitled note"}</h3>
            <div className="ds-note-marks">
              {note.pinned && (
                <span className="pin" aria-label="Pinned" title="Pinned">
                  <PinIcon size={12} />
                </span>
              )}
              {isShared && (
                <span aria-label="Shared" title="Shared">
                  <UsersIcon size={12} />
                </span>
              )}
              {isViewOnly && <span className="viewonly">View only</span>}
            </div>
            {customizeMode && (
              <button
                type="button"
                className="ds-grip"
                aria-label="Drag note"
                ref={dragHandleRef as React.Ref<HTMLButtonElement>}
                onClick={(e) => e.stopPropagation()}
                {...(dragHandleProps ?? {})}
              >
                <GripVerticalIcon size={12} />
              </button>
            )}
          </header>

          <p className="ds-note-body">
            {cleanContent?.replace(/\n+/g, " ") ||
              "No content yet. Tap to open and start writing."}
          </p>

          {Array.isArray(note.tags) && note.tags.length > 0 && (
            <div className="ds-note-tags">
              {note.tags.slice(0, 3).map((tag) => {
                const normalized = normalizeTag(tag);
                const isActive = selectedTags.includes(normalized);
                return (
                  <button
                    key={tag}
                    type="button"
                    className={`ds-note-tag${isActive ? " active" : ""}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onTagClick?.(normalized);
                    }}
                    aria-pressed={isActive}
                    aria-label={`Filter by tag ${formatTagLabel(tag)}`}
                  >
                    {formatTagLabel(tag)}
                  </button>
                );
              })}
              {note.tags.length > 3 && (
                <span className="ds-note-tag-more">
                  +{note.tags.length - 3}
                </span>
              )}
            </div>
          )}

          <footer className="ds-note-foot">
            <span className="ds-note-time">{formatRelativeTime(updatedAt)}</span>
            {!selectionMode && !customizeMode && (
              <div className="ds-note-actions">
                {typeof onOpenInsights === "function" && (
                  <button
                    type="button"
                    className="ds-note-ibtn"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onOpenInsights(note);
                    }}
                    aria-label="Open recommendations and smart view"
                    title="Smart view"
                  >
                    <SparklesIcon size={12} />
                  </button>
                )}
                <button
                  type="button"
                  className="ds-note-ibtn"
                  onClick={handleTogglePin}
                  disabled={pinning}
                  aria-label={note.pinned ? "Unpin note" : "Pin note"}
                  title={note.pinned ? "Unpin" : "Pin"}
                >
                  {pinning ? (
                    <LoaderIcon size={12} className="ds-spin" />
                  ) : note.pinned ? (
                    <BookmarkIcon size={12} />
                  ) : (
                    <BookmarkPlusIcon size={12} />
                  )}
                </button>
                <Link
                  to={`/note/${note._id}`}
                  className="ds-note-ibtn"
                  aria-label="View note"
                  title="View"
                  onClick={(e) => e.stopPropagation()}
                >
                  <EyeIcon size={12} />
                </Link>
                <button
                  type="button"
                  className="ds-note-ibtn danger"
                  onClick={openConfirm}
                  aria-label="Delete note"
                  title="Delete"
                >
                  <TrashIcon size={12} />
                </button>
              </div>
            )}
          </footer>
        </m.article>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Delete this note?"
        description="Deleting will remove this note permanently. You can't undo this action."
        confirmLabel="Delete"
        cancelLabel="Keep note"
        tone="error"
        confirmLoading={deleting}
        onCancel={closeConfirm}
        onConfirm={handleDelete}
      />
    </>
  );
}

export default NoteCard;
