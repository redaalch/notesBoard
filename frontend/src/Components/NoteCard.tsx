import { useState, type CSSProperties } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { m } from "framer-motion";
import { useSwipeable } from "react-swipeable";
import {
  BookmarkIcon,
  BookmarkPlusIcon,
  EyeIcon,
  GripVerticalIcon,
  LoaderIcon,
  PinIcon,
  PinOffIcon,
  TrashIcon,
  UsersIcon,
  SparklesIcon,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import {
  formatRelativeTime,
  formatTagLabel,
  normalizeTag,
  stripMarkdown,
} from "../lib/Utils";
import api from "../lib/axios";
import { extractApiError } from "../lib/sanitize";
import { toast } from "sonner";
import ConfirmDialog from "./ConfirmDialog";

// ── Tag helpers ──────────────────────────────────────────────────────────────
// Monochrome tags — color is reserved for semantic meaning only (active filter)

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

  // Swipe gesture handlers for mobile — left = delete, right = pin
  const swipeHandlers = useSwipeable({
    onSwiping: (eventData) => {
      if (selectionMode || customizeMode || dragging) return;
      // Allow swiping in both directions
      if (Math.abs(eventData.deltaX) > 10) {
        setSwipeOffset(eventData.deltaX);
        setShowActions(true);
      }
    },
    onSwiped: (eventData) => {
      if (selectionMode || customizeMode || dragging) return;
      if (eventData.deltaX < -80) {
        // Swiped left far enough → show delete
        setSwipeOffset(-120);
      } else if (eventData.deltaX > 80) {
        // Swiped right far enough → show pin
        setSwipeOffset(120);
      } else {
        setSwipeOffset(0);
        setShowActions(false);
      }
    },
    trackMouse: false,
    trackTouch: true,
  });

  return (
    <>
      <div className="relative h-full">
        {/* Swipe action buttons (behind card) */}
        {showActions && (
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-y-0 flex items-center z-0"
            style={{
              ...(swipeOffset < 0
                ? { right: 0, paddingRight: "1rem" }
                : { left: 0, paddingLeft: "1rem" }),
            }}
          >
            {swipeOffset < 0 ? (
              /* Left-swipe → delete */
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirmOpen(true);
                  setSwipeOffset(0);
                  setShowActions(false);
                }}
                className="btn btn-sm btn-error gap-1"
                aria-label="Delete note"
              >
                <TrashIcon className="size-4" />
                Delete
              </button>
            ) : (
              /* Right-swipe → pin/unpin */
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleTogglePin();
                  setSwipeOffset(0);
                  setShowActions(false);
                }}
                disabled={pinning}
                className="btn btn-sm btn-warning gap-1"
                aria-label={note.pinned ? "Unpin note" : "Pin note"}
              >
                {note.pinned ? (
                  <PinOffIcon className="size-4" />
                ) : (
                  <PinIcon className="size-4" />
                )}
                {note.pinned ? "Unpin" : "Pin"}
              </button>
            )}
          </m.div>
        )}

        {/* Card content (slides on swipe) */}
        <m.article
          {...swipeHandlers}
          ref={innerRef as React.Ref<HTMLElement>}
          style={style}
          {...(cardDragProps ?? {})}
          initial={{ opacity: 0, y: 20 }}
          animate={{
            opacity: 1,
            y: 0,
            x: swipeOffset,
          }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className={`group/card card premium-card relative z-10 md:h-[180px] cursor-pointer ${
            note.pinned ? "premium-card--pinned" : ""
          } ${
            selected
              ? "premium-card--selected"
              : "md:hover:-translate-y-px"
          } ${dragging ? "opacity-80 shadow-2xl ring-1 ring-primary/50" : ""}`}
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
          <div className="card-body gap-1 px-3 py-2 md:gap-1.5 md:px-3.5 md:py-3 flex flex-row md:flex-col h-full">
            {/* ── Mobile: compact horizontal list item ─────────── */}
            {/* Left side: title + one-line preview + timestamp */}
            <div className="flex-1 min-w-0 md:contents">
              {/* Header */}
              <header className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5 min-w-0">
                  {selectionMode && !customizeMode && (
                    <div className="pt-0.5 shrink-0">
                      <input
                        type="checkbox"
                        className="checkbox checkbox-primary checkbox-sm"
                        checked={selected}
                        onChange={(event) => {
                          event.stopPropagation();
                          handleSelectionChange(event.target.checked, event);
                        }}
                        aria-label={selected ? "Deselect note" : "Select note"}
                      />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <h3 className="text-sm font-bold leading-snug tracking-[-0.01em] text-base-content truncate">
                        {note.title || "Untitled note"}
                      </h3>
                      {note.pinned && (
                        <PinIcon
                          className="size-3.5 text-amber-500 shrink-0"
                          aria-label="Pinned"
                        />
                      )}
                      {isShared && (
                        <UsersIcon
                          className="size-3 text-base-content/30 shrink-0"
                          aria-label="Shared"
                        />
                      )}
                      {isViewOnly && (
                        <span className="text-[10px] font-medium text-base-content/40 shrink-0">
                          View only
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {customizeMode && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs btn-circle cursor-grab active:cursor-grabbing shrink-0"
                    aria-label="Drag note"
                    ref={dragHandleRef as React.Ref<HTMLButtonElement>}
                    {...(dragHandleProps ?? {})}
                  >
                    <GripVerticalIcon className="size-4" />
                  </button>
                )}
              </header>

              {/* Content preview — markdown stripped, 2-line max */}
              <p className="hidden md:block text-[13px] leading-relaxed text-base-content/65 line-clamp-2">
                {cleanContent?.replace(/\n+/g, " ") ||
                  "No content yet. Tap to open and start writing."}
              </p>
              {/* Mobile: one-line preview */}
              <p className="md:hidden text-xs leading-normal text-base-content/60 truncate">
                {cleanContent || "No content yet"}
              </p>

              {/* Tags — monochrome, max 2 visible */}
              {Array.isArray(note.tags) && note.tags.length > 0 && (
                <div className="hidden md:flex items-center gap-1 mt-0.5">
                  {note.tags.slice(0, 2).map((tag) => {
                    const normalized = normalizeTag(tag);
                    const isActive = selectedTags.includes(normalized);

                    return (
                      <button
                        key={tag}
                        type="button"
                        className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold transition-colors ${
                          isActive
                            ? "bg-primary/15 text-primary"
                            : "bg-base-content/[0.06] text-base-content/55 hover:text-base-content/75 hover:bg-base-content/[0.1]"
                        }`}
                        onClick={() => onTagClick?.(normalized)}
                        aria-pressed={isActive}
                        aria-label={`Filter by tag ${formatTagLabel(tag)}`}
                      >
                        {formatTagLabel(tag)}
                      </button>
                    );
                  })}
                  {note.tags.length > 2 && (
                    <span className="text-[10px] text-base-content/40 font-medium self-center">
                      +{note.tags.length - 2}
                    </span>
                  )}
                </div>
              )}

              {/* Footer: timestamp left, hover-revealed actions right */}
              <footer className="hidden md:flex items-center justify-between gap-2 mt-auto pt-1.5 border-t border-base-content/[0.08]">
                <span className="text-[10px] text-base-content/45 whitespace-nowrap tabular-nums">
                  {formatRelativeTime(updatedAt)}
                </span>
                {!selectionMode && !customizeMode && (
                  <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover/card:opacity-100 focus-within:opacity-100 transition-opacity duration-150">
                    {typeof onOpenInsights === "function" ? (
                      <div
                        className="tooltip tooltip-top"
                        data-tip="Smart view"
                      >
                        <button
                          className="btn btn-ghost btn-xs btn-circle"
                          onClick={(event) => {
                            event.preventDefault();
                            onOpenInsights(note);
                          }}
                          aria-label="Open recommendations and smart view"
                        >
                          <SparklesIcon className="size-3.5" />
                        </button>
                      </div>
                    ) : null}
                    <div
                      className="tooltip tooltip-top"
                      data-tip={note.pinned ? "Unpin" : "Pin"}
                    >
                      <button
                        className="btn btn-ghost btn-xs btn-circle"
                        onClick={handleTogglePin}
                        disabled={pinning}
                        aria-label={note.pinned ? "Unpin note" : "Pin note"}
                      >
                        {pinning ? (
                          <LoaderIcon className="size-3.5 animate-spin" />
                        ) : note.pinned ? (
                          <BookmarkIcon className="size-3.5" />
                        ) : (
                          <BookmarkPlusIcon className="size-3.5" />
                        )}
                      </button>
                    </div>
                    <div
                      className="tooltip tooltip-top"
                      data-tip="View note"
                    >
                      <Link
                        to={`/note/${note._id}`}
                        className="btn btn-ghost btn-xs btn-circle"
                        aria-label="View note"
                      >
                        <EyeIcon className="size-3.5" />
                      </Link>
                    </div>
                    <div className="tooltip tooltip-top" data-tip="Delete">
                      <button
                        className="btn btn-ghost btn-xs btn-circle text-error/70 hover:text-error hover:bg-error/10"
                        onClick={openConfirm}
                        aria-label="Delete note"
                      >
                        <TrashIcon className="size-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </footer>

              {/* Mobile footer — just timestamp */}
              <span className="md:hidden text-[10px] text-base-content/50 whitespace-nowrap">
                {note.updatedAt
                  ? formatRelativeTime(updatedAt)
                  : formatRelativeTime(createdAt)}
              </span>
            </div>
            {/* end mobile wrapper */}

            {/* Mobile: pin + tag count (right side) */}
            <div className="flex md:hidden flex-col items-end justify-between gap-1 shrink-0 pl-2">
              {note.pinned && (
                <PinIcon
                  className="size-3 text-amber-500/70"
                  aria-label="Pinned"
                />
              )}
              {Array.isArray(note.tags) && note.tags.length > 0 && (
                <span className="text-[10px] text-base-content/30">
                  {note.tags.length} tag{note.tags.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>
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
