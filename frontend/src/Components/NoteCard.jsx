import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useSwipeable } from "react-swipeable";
import {
  BookmarkIcon,
  BookmarkPlusIcon,
  CalendarClockIcon,
  EyeIcon,
  GripVerticalIcon,
  LoaderIcon,
  NotebookPenIcon,
  PinIcon,
  PinOffIcon,
  TrashIcon,
  UsersIcon,
  SparklesIcon,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  formatDate,
  formatRelativeTime,
  formatTagLabel,
  normalizeTag,
} from "../lib/Utils";
import api from "../lib/axios";
import { toast } from "sonner";
import ConfirmDialog from "./ConfirmDialog.jsx";

const formatAccessRole = (role) => {
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
}) {
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pinning, setPinning] = useState(false);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [showActions, setShowActions] = useState(false);

  const handleSelectionChange = (checked, event = null) => {
    if (typeof onSelectionChange === "function") {
      onSelectionChange(note._id, checked, { event });
    }
  };

  const toggleSelection = (event) => {
    handleSelectionChange(!selected, event);
  };

  const updateNotesCache = (updater) => {
    queryClient.setQueryData(["notes"], (previous) => {
      if (!Array.isArray(previous)) return previous;
      return updater(previous);
    });
  };

  const invalidateNotesQueries = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["notes"] }),
      queryClient.invalidateQueries({ queryKey: ["tag-stats"] }),
    ]);

  const openConfirm = (event) => {
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

  const handleTogglePin = async (event) => {
    event.preventDefault();
    event.stopPropagation();
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
    } catch (error) {
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
          ref={innerRef}
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
            selectionMode ? (event) => toggleSelection(event) : undefined
          }
          role="group"
          aria-pressed={selectionMode ? selected : undefined}
        >
          <div className="card-body space-y-5 flex flex-col h-full">
            <header className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                {selectionMode && !customizeMode && (
                  <div className="pt-1">
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
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg md:text-xl font-semibold text-base-content">
                      {note.title || "Untitled note"}
                    </h3>
                    {isRecentlyUpdated && (
                      <span className="badge badge-success badge-sm">New</span>
                    )}
                    {note.pinned && (
                      <span className="badge badge-warning badge-sm">
                        Pinned
                      </span>
                    )}
                    {notebookBadgeLabel ? (
                      <span className="badge badge-info badge-sm gap-1">
                        <UsersIcon className="size-3" />
                        {notebookBadgeLabel}
                      </span>
                    ) : null}
                    {isViewOnly ? (
                      <span className="badge badge-outline badge-sm">
                        View only
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs md:text-sm text-base-content/70 flex items-center gap-1">
                    <CalendarClockIcon className="size-4" />
                    Updated {formatRelativeTime(updatedAt)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {customizeMode ? (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm btn-circle cursor-grab active:cursor-grabbing"
                    aria-label="Drag note"
                    ref={dragHandleRef}
                    {...(dragHandleProps ?? {})}
                  >
                    <GripVerticalIcon className="size-4" />
                  </button>
                ) : (
                  !selectionMode && (
                    <>
                      <div
                        className="tooltip tooltip-left"
                        data-tip={note.pinned ? "Unpin note" : "Pin note"}
                      >
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={handleTogglePin}
                          disabled={pinning}
                          aria-label={note.pinned ? "Unpin note" : "Pin note"}
                        >
                          {pinning ? (
                            <LoaderIcon className="size-4 animate-spin" />
                          ) : note.pinned ? (
                            <BookmarkIcon className="size-4" />
                          ) : (
                            <BookmarkPlusIcon className="size-4" />
                          )}
                        </button>
                      </div>
                      <div
                        className="tooltip tooltip-left"
                        data-tip="Open note details"
                      >
                        <Link
                          to={`/note/${note._id}`}
                          className="btn btn-ghost btn-sm"
                        >
                          <NotebookPenIcon className="size-4" />
                        </Link>
                      </div>
                    </>
                  )
                )}
              </div>
            </header>

            <div className="rounded-lg bg-base-200/40 p-4 border border-base-200/60 flex-grow">
              <p className="text-sm md:text-base leading-relaxed text-base-content/80 whitespace-pre-line line-clamp-6">
                {note.content?.trim() ||
                  "No content yet. Tap to open and start writing."}
              </p>
            </div>

            <div className="min-h-[2rem]">
              {Array.isArray(note.tags) && note.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {note.tags.map((tag) => {
                    const normalized = normalizeTag(tag);
                    const isActive = selectedTags.includes(normalized);

                    return (
                      <button
                        key={tag}
                        type="button"
                        className={`badge badge-sm gap-1 transition ${
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
            </div>

            <footer className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mt-auto">
              <div className="text-xs text-base-content/60 space-y-1">
                <p>Created {formatRelativeTime(createdAt)}</p>
                <p className="hidden sm:block">
                  Last updated {formatDate(updatedAt)}
                </p>
              </div>
              {!selectionMode && !customizeMode && (
                <div className="flex items-center gap-2 flex-shrink-0">
                  {typeof onOpenInsights === "function" ? (
                    <div
                      className="tooltip tooltip-bottom"
                      data-tip="Recommendations & smart view"
                    >
                      <button
                        className="btn btn-outline btn-sm flex-shrink-0"
                        onClick={(event) => {
                          event.preventDefault();
                          onOpenInsights(note);
                        }}
                        aria-label="Open recommendations and smart view"
                      >
                        <SparklesIcon className="size-4" />
                      </button>
                    </div>
                  ) : null}
                  <div
                    className="tooltip tooltip-bottom"
                    data-tip="Open note details"
                  >
                    <Link
                      to={`/note/${note._id}`}
                      className="btn btn-primary btn-sm gap-2 whitespace-nowrap"
                    >
                      <EyeIcon className="size-4 flex-shrink-0" />
                      <span>View note</span>
                    </Link>
                  </div>
                  <div
                    className="tooltip tooltip-bottom"
                    data-tip="Delete note"
                  >
                    <button
                      className="btn btn-outline btn-error btn-sm flex-shrink-0"
                      onClick={openConfirm}
                      aria-label="Delete note"
                    >
                      <TrashIcon className="size-4" />
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
