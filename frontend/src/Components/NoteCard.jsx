import { useState } from "react";
import { CalendarClockIcon, PenSquareIcon, Trash2Icon } from "lucide-react";
import { Link } from "react-router-dom";
import { countWords, formatDate, formatRelativeTime } from "../lib/Utils.js";
import api from "../lib/axios.js";
import toast from "react-hot-toast";
import ConfirmDialog from "./ConfirmDialog.jsx";

const normalizeTag = (tag) =>
  String(tag).trim().toLowerCase().replace(/\s+/g, " ");

const prettifyTag = (tag) =>
  normalizeTag(tag)
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

function NoteCard({
  note,
  setNotes,
  onTagClick,
  selectedTags = [],
  onNoteChange,
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
      console.log("Error in deleting the note ", error);
      toast.error("Failed to delete the note");
    } finally {
      setDeleting(false);
    }
  };

  const createdAt = new Date(note.createdAt);
  const updatedAt = note.updatedAt ? new Date(note.updatedAt) : createdAt;
  const wordCount = countWords(note.content);
  const isRecentlyUpdated = Date.now() - updatedAt.getTime() < 172_800_000; // 48h

  return (
    <>
      <article className="card bg-base-100 hover:shadow-xl transition-all duration-200 border border-base-200">
        <div className="card-body space-y-4">
          <header className="flex items-start justify-between gap-2">
            <div>
              <h3 className="card-title text-base-content flex items-center gap-2">
                {note.title}
                {isRecentlyUpdated && (
                  <span className="badge badge-success badge-sm">New</span>
                )}
              </h3>
              <p className="text-sm text-base-content/60 flex items-center gap-1">
                <CalendarClockIcon className="size-4" />
                Updated {formatRelativeTime(updatedAt)}
              </p>
            </div>
            <div className="tooltip tooltip-left" data-tip="Open note details">
              <Link to={`/note/${note._id}`} className="btn btn-ghost btn-sm">
                <PenSquareIcon className="size-4" />
              </Link>
            </div>
          </header>

          <p className="text-base-content/70 line-clamp-3 leading-relaxed">
            {note.content}
          </p>

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
                    aria-label={`Filter by tag ${prettifyTag(tag)}`}
                  >
                    {prettifyTag(tag)}
                  </button>
                );
              })}
            </div>
          )}

          <div className="collapse collapse-arrow bg-base-200/60">
            <input type="checkbox" />
            <div className="collapse-title text-sm font-medium">
              Quick note insights
            </div>
            <div className="collapse-content text-sm text-base-content/70">
              <dl className="space-y-2">
                <div className="flex justify-between">
                  <dt className="font-semibold">Created</dt>
                  <dd>{formatDate(createdAt)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="font-semibold">Last updated</dt>
                  <dd>{formatDate(updatedAt)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="font-semibold">Word count</dt>
                  <dd>
                    <span className="badge badge-outline badge-sm">
                      {wordCount} words
                    </span>
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          <footer className="card-actions justify-between items-center">
            <span className="text-xs text-base-content/60">
              Created {formatRelativeTime(createdAt)}
            </span>
            <div className="flex items-center gap-2">
              <div
                className="tooltip tooltip-bottom"
                data-tip="Open note details"
              >
                <Link
                  to={`/note/${note._id}`}
                  className="btn btn-primary btn-sm"
                >
                  View note
                </Link>
              </div>
              <div className="tooltip tooltip-bottom" data-tip="Delete note">
                <button
                  className="btn btn-outline btn-error btn-sm"
                  onClick={openConfirm}
                >
                  <Trash2Icon className="size-4" />
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
