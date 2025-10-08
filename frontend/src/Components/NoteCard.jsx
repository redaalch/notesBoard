import { useState } from "react";
import {
  BookmarkIcon,
  BookmarkPlusIcon,
  CalendarClockIcon,
  EyeIcon,
  LoaderIcon,
  NotebookPenIcon,
  TrashIcon,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  formatDate,
  formatRelativeTime,
  formatTagLabel,
  normalizeTag,
} from "../lib/Utils.js";
import api from "../lib/axios.js";
import toast from "react-hot-toast";
import ConfirmDialog from "./ConfirmDialog.jsx";

function NoteCard({
  note,
  setNotes,
  onTagClick,
  selectedTags = [],
  onNoteChange,
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pinning, setPinning] = useState(false);

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
      setNotes((prev) => prev.filter((item) => item._id !== note._id));
      toast.success("Your note has been deleted successfully");
      setConfirmOpen(false);
      onNoteChange?.();
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
        : note.tags ?? [];

      setNotes((prev) =>
        prev.map((item) =>
          item._id === note._id
            ? {
                ...item,
                ...responseData,
                pinned: updatedPinned,
                tags: updatedTags,
              }
            : item
        )
      );

      toast.success(
        updatedPinned ? "Note pinned to top" : "Note removed from pinned"
      );
      onNoteChange?.();
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

  return (
    <>
      <article className="card bg-base-100/90 backdrop-blur border border-base-200/70 shadow-md hover:shadow-xl hover:border-primary/30 transition-all duration-200">
        <div className="card-body space-y-5">
          <header className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg md:text-xl font-semibold text-base-content">
                  {note.title || "Untitled note"}
                </h3>
                {isRecentlyUpdated && (
                  <span className="badge badge-success badge-sm">New</span>
                )}
                {note.pinned && (
                  <span className="badge badge-warning badge-sm">Pinned</span>
                )}
              </div>
              <p className="text-xs md:text-sm text-base-content/70 flex items-center gap-1">
                <CalendarClockIcon className="size-4" />
                Updated {formatRelativeTime(updatedAt)}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
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
                <Link to={`/note/${note._id}`} className="btn btn-ghost btn-sm">
                  <NotebookPenIcon className="size-4" />
                </Link>
              </div>
            </div>
          </header>

          <div className="rounded-lg bg-base-200/40 p-4 border border-base-200/60">
            <p className="text-sm md:text-base leading-relaxed text-base-content/80 whitespace-pre-line line-clamp-6">
              {note.content?.trim() ||
                "No content yet. Tap to open and start writing."}
            </p>
          </div>

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

          <footer className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="text-xs text-base-content/60 space-y-1">
              <p>Created {formatRelativeTime(createdAt)}</p>
              <p className="hidden sm:block">
                Last updated {formatDate(updatedAt)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="tooltip tooltip-bottom"
                data-tip="Open note details"
              >
                <Link
                  to={`/note/${note._id}`}
                  className="btn btn-primary btn-sm gap-2"
                >
                  <EyeIcon className="size-4" />
                  View note
                </Link>
              </div>
              <div className="tooltip tooltip-bottom" data-tip="Delete note">
                <button
                  className="btn btn-outline btn-error btn-sm"
                  onClick={openConfirm}
                >
                  <TrashIcon className="size-4" />
                </button>
              </div>
            </div>
          </footer>
        </div>
      </article>

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
