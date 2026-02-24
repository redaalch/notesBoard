import { useState, type CSSProperties, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
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
import { Link } from "react-router-dom";
import { formatRelativeTime, formatTagLabel, normalizeTag } from "../lib/Utils";
import api from "../lib/axios";
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

const formatAccessRole = (role: string | null | undefined): string => {
  switch (role) {
    case "owner":
      return "Owner";
    case "editor":
      return "Editor";
    case "viewer":
      return "Viewer";
    default:
      return role ?? "Viewer";
  }
};

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
    queryClient.setQueryData(
      ["notes"],
      (previous: NoteObject[] | undefined) => {
        if (!Array.isArray(previous)) return previous;
        return updater(previous);
      },
    );
  };

  const invalidateNotesQueries = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["notes"] }),
      queryClient.invalidateQueries({ queryKey: ["tag-stats"] }),
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
      await invalidateNotesQueries();
    } catch (error) {
      console.error("Error deleting the note", error);
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
    } catch (error: any) {
      console.error("Error toggling pin state", error);
      const message =
        error.response?.data?.message ?? "Failed to update pin status";
      toast.error(message);
    } finally {
      setPinning(false);
    }
  };

  const createdAt = new Date(note.createdAt);
  const updatedAt = note.updatedAt ? new Date(note.updatedAt) : createdAt;
  const isRecentlyUpdated = Date.now() - updatedAt.getTime() < 172_800_000; // 48h
  const notebookRole = note?.notebookRole ?? null;
  const effectiveRole = note?.effectiveRole ?? null;
  const notebookBadgeLabel = notebookRole
    ? `Notebook ${formatAccessRole(notebookRole)}`
    : null;
  const isViewOnly = effectiveRole === "viewer";

  // Swipe gesture handlers for mobile
  const swipeHandlers = useSwipeable({
    onSwiping: (eventData) => {
      if (selectionMode || customizeMode || dragging) return;
      const offset = Math.min(0, eventData.deltaX);
      if (offset < -10) {
        setSwipeOffset(offset);
        setShowActions(true);
      }
    },
    onSwiped: (eventData) => {
      if (selectionMode || customizeMode || dragging) return;
      if (eventData.deltaX < -80) {
        // Keep actions visible if swiped far enough
        setSwipeOffset(-120);
      } else {
        // Reset if not swiped far enough
        setSwipeOffset(0);
        setShowActions(false);
      }
    },
    trackMouse: false,
    trackTouch: true,
  });

  return (
    <>
      <div className="relative overflow-hidden h-full">
        {/* Swipe action buttons (behind card) */}
        {showActions && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-y-0 right-0 flex items-center gap-2 pr-4 z-0"
          >
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
            </button>
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
            </button>
          </motion.div>
        )}

        {/* Card content (slides on swipe) */}
        <motion.article
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
          whileHover={
            !dragging && !selectionMode
              ? {
                  y: -4,
                  boxShadow: "0 12px 24px -8px rgba(0,0,0,0.15)",
                }
              : {}
          }
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className={`card bg-base-100/90 backdrop-blur border border-base-200/70 shadow-md h-full relative z-10 ${
            selected
              ? "border-primary/60 ring-1 ring-primary/40"
              : "hover:border-primary/30"
          } ${dragging ? "opacity-80 shadow-2xl ring-1 ring-primary/50" : ""}`}
          onClick={
            selectionMode
              ? (event: React.MouseEvent) => toggleSelection(event)
              : undefined
          }
          role="group"
          aria-pressed={selectionMode ? selected : undefined}
        >
          <div className="card-body gap-3 p-4 flex flex-col h-full">
            <header className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2 min-w-0">
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
                  <div className="flex flex-wrap items-center gap-1.5">
                    <h3 className="text-base font-semibold text-base-content truncate">
                      {note.title || "Untitled note"}
                    </h3>
                    {isRecentlyUpdated && (
                      <span className="badge badge-success badge-xs">New</span>
                    )}
                    {note.pinned && (
                      <span className="badge badge-warning badge-xs">
                        Pinned
                      </span>
                    )}
                    {notebookBadgeLabel ? (
                      <span className="badge badge-info badge-xs gap-0.5">
                        <UsersIcon className="size-2.5" />
                        {notebookBadgeLabel}
                      </span>
                    ) : null}
                    {isViewOnly ? (
                      <span className="badge badge-outline badge-xs">
                        View only
                      </span>
                    ) : null}
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

            <div className="rounded-lg bg-base-200/40 px-3 py-2.5 border border-base-200/60 flex-grow">
              <p className="text-sm leading-relaxed text-base-content/80 whitespace-pre-line line-clamp-4">
                {note.content?.trim() ||
                  "No content yet. Tap to open and start writing."}
              </p>
            </div>

            {Array.isArray(note.tags) && note.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {note.tags.map((tag) => {
                  const normalized = normalizeTag(tag);
                  const isActive = selectedTags.includes(normalized);

                  return (
                    <button
                      key={tag}
                      type="button"
                      className={`badge badge-xs gap-0.5 transition ${
                        isActive
                          ? "badge-primary"
                          : "badge-outline hover:bg-base-200"
                      }`}
                      onClick={() => onTagClick?.(normalized)}
                      aria-pressed={isActive}
                      aria-label={`Filter by tag ${formatTagLabel(tag)}`}
                    >
                      {formatTagLabel(tag)}
                    </button>
                  );
                })}
              </div>
            )}

            <footer className="flex items-center justify-between gap-2 mt-auto pt-1 border-t border-base-200/50">
              <span className="text-[11px] text-base-content/50 whitespace-nowrap">
                {note.updatedAt
                  ? `Updated ${formatRelativeTime(updatedAt)}`
                  : `Created ${formatRelativeTime(createdAt)}`}
              </span>
              {!selectionMode && !customizeMode && (
                <div className="flex items-center gap-0.5 shrink-0">
                  {typeof onOpenInsights === "function" ? (
                    <div
                      className="tooltip tooltip-bottom"
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
                    className="tooltip tooltip-bottom"
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
                  <div className="tooltip tooltip-bottom" data-tip="View note">
                    <Link
                      to={`/note/${note._id}`}
                      className="btn btn-ghost btn-xs btn-circle"
                      aria-label="View note"
                    >
                      <EyeIcon className="size-3.5" />
                    </Link>
                  </div>
                  <div className="tooltip tooltip-bottom" data-tip="Delete">
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
          </div>
        </motion.article>
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
