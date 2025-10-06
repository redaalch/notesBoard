import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import {
  ArrowLeftIcon,
  CheckIcon,
  ClockIcon,
  LoaderIcon,
  PinIcon,
  PinOffIcon,
  RefreshCwIcon,
  SaveIcon,
  Trash2Icon,
} from "lucide-react";
import api from "../lib/axios";
import ConfirmDialog from "../Components/ConfirmDialog.jsx";
import TagInput from "../Components/TagInput.jsx";
import { countWords, formatDate, formatRelativeTime } from "../lib/Utils.js";

function NoteDetailPage() {
  const [note, setNote] = useState(null);
  const [originalNote, setOriginalNote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pinning, setPinning] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(null);

  const navigate = useNavigate();
  const { id } = useParams();

  const tagsEqual = (first = [], second = []) => {
    if (first.length !== second.length) return false;
    return first.every((tag, index) => tag === second[index]);
  };

  useEffect(() => {
    const fetchNote = async () => {
      try {
        const res = await api.get(`/notes/${id}`);
        const normalized = {
          ...res.data,
          tags: Array.isArray(res.data.tags) ? res.data.tags : [],
          pinned: Boolean(res.data.pinned),
        };
        setNote(normalized);
        setOriginalNote({
          ...normalized,
          tags: [...normalized.tags],
          pinned: Boolean(normalized.pinned),
        });
        setLastSavedAt(new Date(normalized.updatedAt ?? normalized.createdAt));
      } catch (error) {
        console.log("Error in fetching Note", error);

        toast.error("Failed to fetch the Note");
      } finally {
        setLoading(false);
      }
    };
    fetchNote();
  }, [id]);

  useEffect(() => {
    if (!note || !originalNote) {
      setHasChanges(false);
      return;
    }

    const noteTags = Array.isArray(note.tags) ? note.tags : [];
    const originalTags = Array.isArray(originalNote.tags)
      ? originalNote.tags
      : [];

    const changed =
      note.title !== originalNote.title ||
      note.content !== originalNote.content ||
      note.pinned !== originalNote.pinned ||
      !tagsEqual(noteTags, originalTags);

    setHasChanges(changed);
  }, [note, originalNote]);

  const createdAt = useMemo(() => {
    if (!note?.createdAt) return null;
    return new Date(note.createdAt);
  }, [note?.createdAt]);

  const updatedAt = useMemo(() => {
    if (note?.updatedAt) return new Date(note.updatedAt);
    return createdAt;
  }, [note?.updatedAt, createdAt]);

  const wordCount = useMemo(
    () => countWords(note?.content ?? ""),
    [note?.content]
  );

  const characterCount = useMemo(
    () => (note?.content ? note.content.length : 0),
    [note?.content]
  );

  const lastSavedDisplay = useMemo(() => {
    if (hasChanges) return "Unsaved changes";
    if (saving) return "Saving…";
    if (lastSavedAt) {
      return `Saved ${formatRelativeTime(lastSavedAt)}`;
    }
    if (updatedAt) {
      return `Updated ${formatRelativeTime(updatedAt)}`;
    }
    return "All changes saved";
  }, [hasChanges, saving, lastSavedAt, updatedAt]);

  const lastSavedTooltip = useMemo(() => {
    if (hasChanges) return "You have pending edits";
    if (lastSavedAt) return formatDate(lastSavedAt);
    if (updatedAt) return formatDate(updatedAt);
    return null;
  }, [hasChanges, lastSavedAt, updatedAt]);

  const shortcutLabel = useMemo(() => {
    if (typeof navigator === "undefined") return "Ctrl+S";
    const platform = navigator?.platform ?? "";
    return /Mac|iPhone|iPad/i.test(platform) ? "⌘S" : "Ctrl+S";
  }, []);

  const tagLimit = 8;
  const tagCount = Array.isArray(note?.tags) ? note.tags.length : 0;
  const disableSave = saving || !hasChanges;
  const disableRevert = saving || !hasChanges;
  const sanitizedTitle = note?.title?.trim() ? note.title : "Untitled note";

  const statusBadge = useMemo(() => {
    if (hasChanges) {
      return {
        className: "badge-warning",
        label: "Unsaved changes",
        shortLabel: "Unsaved",
        Icon: RefreshCwIcon,
        iconClassName: "size-3 text-warning-content shrink-0",
      };
    }

    return {
      className: "badge-success",
      label: "Up to date",
      shortLabel: "Saved",
      Icon: CheckIcon,
      iconClassName: "size-3 text-success-content shrink-0",
    };
  }, [hasChanges]);
  const StatusBadgeIcon = statusBadge.Icon;

  const handleTitleChange = useCallback((event) => {
    const { value } = event.target;
    setNote((prev) => (prev ? { ...prev, title: value } : prev));
  }, []);

  const handleContentChange = useCallback((event) => {
    const { value } = event.target;
    setNote((prev) => (prev ? { ...prev, content: value } : prev));
  }, []);

  const handleTagsChange = useCallback((nextTags) => {
    setNote((prev) =>
      prev ? { ...prev, tags: Array.isArray(nextTags) ? nextTags : [] } : prev
    );
  }, []);

  const handleSave = useCallback(async () => {
    if (!note) return;

    const trimmedTitle = note.title?.trim() ?? "";
    const trimmedContent = note.content?.trim() ?? "";

    if (!trimmedTitle && !trimmedContent) {
      toast.error("Add a title or content before saving");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: trimmedTitle || "Untitled note",
        content: trimmedContent,
        tags: Array.isArray(note.tags)
          ? note.tags.map((tag) => tag.trim()).filter((tag) => Boolean(tag))
          : [],
        pinned: Boolean(note.pinned),
      };

      const response = await api.put(`/notes/${id}`, payload);
      const responseData = response?.data ?? {};
      const merged = {
        ...note,
        ...responseData,
        title: responseData.title ?? payload.title,
        content: responseData.content ?? payload.content,
        tags: Array.isArray(responseData.tags)
          ? responseData.tags
          : payload.tags,
        pinned:
          typeof responseData.pinned === "boolean"
            ? responseData.pinned
            : payload.pinned,
      };

      const normalizedTags = Array.isArray(merged.tags) ? merged.tags : [];

      setNote({
        ...merged,
        tags: [...normalizedTags],
      });

      setOriginalNote({
        ...merged,
        tags: [...normalizedTags],
      });

      const savedAt = merged.updatedAt
        ? new Date(merged.updatedAt)
        : new Date();
      setLastSavedAt(savedAt);

      toast.success("Note updated successfully");
    } catch (error) {
      console.log("Error saving the note", error);
      const message = error.response?.data?.message ?? "Failed to update note";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }, [id, note]);

  const handleRevert = useCallback(() => {
    if (!originalNote) return;
    setNote({
      ...originalNote,
      tags: [...(originalNote.tags ?? [])],
      pinned: Boolean(originalNote.pinned),
    });
    toast.success("Changes reverted");
  }, [originalNote]);

  const handleTogglePinned = useCallback(async () => {
    if (!note) return;

    const nextPinned = !note.pinned;
    setPinning(true);
    try {
      const response = await api.put(`/notes/${id}`, { pinned: nextPinned });
      const responseData = response?.data ?? {};

      const resolvedPinned =
        typeof responseData.pinned === "boolean"
          ? responseData.pinned
          : nextPinned;
      const resolvedUpdatedAt = responseData.updatedAt ?? note.updatedAt;

      setNote((prev) =>
        prev
          ? {
              ...prev,
              pinned: resolvedPinned,
              updatedAt: resolvedUpdatedAt,
              tags: Array.isArray(prev.tags) ? [...prev.tags] : [],
            }
          : prev
      );

      setOriginalNote((prev) =>
        prev
          ? {
              ...prev,
              pinned: resolvedPinned,
              updatedAt: resolvedUpdatedAt,
              tags: Array.isArray(prev.tags) ? [...prev.tags] : [],
            }
          : prev
      );

      const savedAt = resolvedUpdatedAt
        ? new Date(resolvedUpdatedAt)
        : new Date();
      setLastSavedAt(savedAt);

      toast.success(
        resolvedPinned ? "Note pinned to top" : "Note removed from pinned"
      );
    } catch (error) {
      console.log("Error toggling pinned state", error);
      const message =
        error.response?.data?.message ?? "Failed to update pin status";
      toast.error(message);
    } finally {
      setPinning(false);
    }
  }, [id, note]);

  const openConfirm = () => setConfirmOpen(true);

  const closeConfirm = () => {
    if (!deleting) {
      setConfirmOpen(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/notes/${id}`);
      toast.success("Note deleted");
      navigate("/");
    } catch (error) {
      console.log("Error deleting the note:", error);
      toast.error("Failed to delete note");
    } finally {
      setDeleting(false);
      setConfirmOpen(false);
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const handleKeyDown = (event) => {
      if (
        (event.ctrlKey || event.metaKey) &&
        (event.key === "s" || event.key === "S")
      ) {
        event.preventDefault();
        if (!saving && hasChanges) {
          void handleSave();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSave, hasChanges, saving]);

  if (loading) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <LoaderIcon className="animate-spin size-10" />
      </div>
    );
  }

  if (!note) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body text-center">
            <h2 className="card-title justify-center">Note not found</h2>
            <p className="text-base-content/70">
              The note you're looking for might have been deleted or never
              existed.
            </p>
            <div className="card-actions justify-center mt-4">
              <Link to="/" className="btn btn-primary">
                Go back home
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-base-200 via-base-100 to-base-300">
        <header className="sticky top-0 z-30 mx-auto max-w-3xl rounded-b-2xl shadow-lg border border-base-300/30 bg-base-100/90 backdrop-blur-lg mt-2">
          <div className="flex w-full flex-col gap-4 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 min-w-0 items-start gap-4">
              <Link
                to="/"
                className="btn btn-ghost btn-circle shadow-md hover:bg-primary/10"
                aria-label="Back to notes"
              >
                <ArrowLeftIcon className="size-5" />
              </Link>
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-lg font-bold text-base-content truncate">
                    {sanitizedTitle}
                  </span>
                  {note?.pinned && (
                    <span className="badge badge-warning badge-lg flex items-center gap-2">
                      <PinIcon className="size-4" />
                      Pinned
                    </span>
                  )}
                </div>
                <div
                  className="flex flex-wrap items-center gap-2 text-xs text-base-content/60"
                  title={lastSavedTooltip ?? undefined}
                >
                  <ClockIcon className="size-4" />
                  <span className="truncate">{lastSavedDisplay}</span>
                  <span
                    className={`badge items-center gap-2 ${statusBadge.className} whitespace-nowrap`}
                  >
                    <StatusBadgeIcon className={statusBadge.iconClassName} />
                    {statusBadge.label}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
              <button
                type="button"
                className={`btn btn-outline btn-md gap-2 ${
                  note?.pinned ? "border-warning text-warning" : ""
                }`}
                onClick={handleTogglePinned}
                disabled={pinning}
                title={note?.pinned ? "Unpin note" : "Pin note"}
              >
                {pinning ? (
                  <LoaderIcon className="size-4 animate-spin" />
                ) : note?.pinned ? (
                  <PinOffIcon className="size-4" />
                ) : (
                  <PinIcon className="size-4" />
                )}
                <span>{note?.pinned ? "Unpin" : "Pin"}</span>
              </button>
              <button
                type="button"
                className="btn btn-outline btn-md gap-2"
                onClick={handleRevert}
                disabled={disableRevert}
                title="Revert changes"
              >
                <RefreshCwIcon className="size-4" />
                <span>Revert</span>
              </button>
              <button
                type="button"
                className="btn btn-outline btn-error btn-md gap-2"
                onClick={openConfirm}
                title="Delete note"
              >
                <Trash2Icon className="size-4" strokeWidth={2.2} />
                <span>Delete</span>
              </button>
              <button
                type="button"
                className="btn btn-primary btn-md font-semibold gap-2 shadow-lg hover:scale-[1.02] transition-all duration-150"
                onClick={handleSave}
                disabled={disableSave}
                title="Save changes"
              >
                {saving ? (
                  <LoaderIcon className="size-4 animate-spin" />
                ) : (
                  <SaveIcon className="size-4" />
                )}
                <span>{saving ? "Saving" : "Save changes"}</span>
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-3xl space-y-8 px-4 py-10">
          <section className="grid gap-6 sm:grid-cols-3">
            <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-base-100 via-base-200 to-primary/10 p-5 shadow-lg">
              <p className="text-xs font-bold uppercase text-primary tracking-wide mb-1">
                Status
              </p>
              <p
                className="mt-2 flex items-center gap-2 text-base font-semibold text-base-content"
                title={lastSavedTooltip ?? undefined}
              >
                <ClockIcon className="size-5 text-primary" />
                {lastSavedDisplay}
              </p>
              <p className="mt-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-warning">
                {note?.pinned ? (
                  <>
                    <PinIcon className="size-4 mr-1" />
                    <span>Pinned to top</span>
                  </>
                ) : (
                  <span className="text-base-content/60 flex items-center gap-1">
                    <PinOffIcon className="size-4" />
                    Not pinned
                  </span>
                )}
              </p>
              <p className="mt-3 text-xs text-base-content/60">
                <span className="bg-base-300/40 rounded px-2 py-1 font-mono">
                  {shortcutLabel}
                </span>{" "}
                to save
              </p>
            </div>
            <div className="rounded-2xl border border-secondary/30 bg-gradient-to-br from-base-100 via-base-200 to-secondary/10 p-5 shadow-lg">
              <p className="text-xs font-bold uppercase text-secondary tracking-wide mb-1">
                Word count
              </p>
              <p className="mt-2 text-3xl font-bold text-secondary">
                {wordCount}
              </p>
              <p className="text-xs text-base-content/60 mt-1">
                {characterCount} characters
              </p>
            </div>
            <div className="rounded-2xl border border-accent/30 bg-gradient-to-br from-base-100 via-base-200 to-accent/10 p-5 shadow-lg">
              <p className="text-xs font-bold uppercase text-accent tracking-wide mb-1">
                Timeline
              </p>
              <p className="mt-2 text-base font-semibold text-accent">
                {updatedAt ? `Updated ${formatRelativeTime(updatedAt)}` : "–"}
              </p>
              <p className="text-xs text-base-content/60 mt-1">
                Created {createdAt ? formatDate(createdAt) : "–"}
              </p>
            </div>
          </section>

          <section className="space-y-6">
            <div className="card border border-base-300/60 bg-base-100/90 shadow-lg rounded-2xl">
              <div className="card-body space-y-6">
                <label className="form-control gap-2">
                  <span className="label-text text-base font-bold text-primary">
                    Title
                  </span>
                  <input
                    type="text"
                    placeholder="Note title"
                    className="input input-bordered input-lg bg-base-200/60 rounded-xl focus:ring-2 focus:ring-primary/40 transition-all"
                    value={note.title ?? ""}
                    onChange={handleTitleChange}
                  />
                </label>
                <label className="form-control gap-2">
                  <span className="label-text text-base font-bold text-secondary">
                    Content
                  </span>
                  <textarea
                    placeholder="Write your note here..."
                    className="textarea textarea-bordered min-h-[18rem] leading-relaxed rounded-xl focus:ring-2 focus:ring-secondary/40 transition-all"
                    value={note.content ?? ""}
                    onChange={handleContentChange}
                  />
                  <span className="text-right text-xs text-base-content/60 mt-1">
                    {wordCount} words · {characterCount} characters
                  </span>
                </label>
              </div>
            </div>

            <div className="card border border-base-300/60 bg-base-100/90 shadow-lg rounded-2xl">
              <div className="card-body space-y-5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-base font-bold text-accent">Tags</h3>
                    <p className="text-xs text-base-content/60">
                      Press Enter or comma to add up to {tagLimit} tags
                    </p>
                  </div>
                  <span className="badge badge-accent badge-outline text-xs px-3 py-1">
                    {tagCount}/{tagLimit}
                  </span>
                </div>
                <TagInput value={note.tags ?? []} onChange={handleTagsChange} />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-primary/30 bg-base-100/80 px-6 py-4 text-xs text-base-content/70 shadow">
              <span>
                <span className="font-semibold text-primary">Tip:</span> Use{" "}
                <span className="bg-base-300/40 rounded px-2 py-1 font-mono">
                  {shortcutLabel}
                </span>{" "}
                to save without leaving the editor.
              </span>
              <span className="flex items-center gap-2">
                <CheckIcon className="size-4 text-primary" />
                Changes sync after each save
              </span>
            </div>
          </section>
        </main>
      </div>
      <ConfirmDialog
        open={confirmOpen}
        title="Delete this note?"
        description="This will permanently remove the note and all of its content."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        confirmLoading={deleting}
        onCancel={closeConfirm}
        onConfirm={handleDelete}
      />
    </>
  );
}

export default NoteDetailPage;
