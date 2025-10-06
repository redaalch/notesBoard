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
  const headerBadgeClass = hasChanges ? "badge-warning" : "badge-success";

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
      <div className="min-h-screen bg-base-200">
        <header className="sticky top-0 z-30 border-b border-base-content/10 bg-base-100/80 backdrop-blur">
          <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-4">
            <div className="flex items-center gap-3">
              <Link to="/" className="btn btn-ghost btn-sm sm:btn">
                <ArrowLeftIcon className="size-4" />
                <span className="hidden sm:inline">Back to notes</span>
              </Link>
              <div className="hidden sm:flex flex-col gap-1">
                <span className="flex items-center gap-2 text-sm font-semibold text-base-content">
                  {sanitizedTitle}
                  {note?.pinned && (
                    <span className="badge badge-warning badge-sm">Pinned</span>
                  )}
                </span>
                <span
                  className="flex items-center gap-1 text-xs text-base-content/60"
                  title={lastSavedTooltip ?? undefined}
                >
                  <ClockIcon className="size-3.5" />
                  {lastSavedDisplay}
                </span>
              </div>
              <span className={`badge sm:hidden ${headerBadgeClass}`}>
                {hasChanges ? "Unsaved" : "Saved"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`badge hidden sm:inline-flex ${headerBadgeClass}`}
              >
                {hasChanges ? "Unsaved changes" : "Up to date"}
              </span>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={handleTogglePinned}
                disabled={pinning}
                title={note?.pinned ? "Unpin note" : "Pin note"}
                aria-label={note?.pinned ? "Unpin note" : "Pin note"}
              >
                {pinning ? (
                  <LoaderIcon className="size-4 animate-spin" />
                ) : note?.pinned ? (
                  <PinOffIcon className="size-4" />
                ) : (
                  <PinIcon className="size-4" />
                )}
                <span className="hidden sm:inline">
                  {note?.pinned ? "Unpin" : "Pin"}
                </span>
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={handleRevert}
                disabled={disableRevert}
              >
                <RefreshCwIcon className="size-4" />
                <span className="hidden sm:inline">Revert</span>
              </button>
              <button
                type="button"
                className="btn btn-sm sm:btn border border-error/80 bg-transparent text-error hover:bg-error hover:text-error-content focus-visible:bg-error focus-visible:text-error-content"
                onClick={openConfirm}
                title="Delete note"
                aria-label="Delete note"
              >
                <Trash2Icon className="size-4" strokeWidth={2.2} />
                <span className="hidden sm:inline">Delete</span>
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm sm:btn font-semibold !text-white hover:!text-white focus-visible:!text-white disabled:bg-primary/50 disabled:!text-white/70 disabled:border-transparent"
                onClick={handleSave}
                disabled={disableSave}
              >
                {saving ? (
                  <LoaderIcon className="size-4 animate-spin" />
                ) : (
                  <SaveIcon className="size-4" />
                )}
                <span className="hidden sm:inline">Save changes</span>
                <span className="sm:hidden">{saving ? "Saving" : "Save"}</span>
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8">
          <section className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-base-300/60 bg-base-100 p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase text-base-content/60">
                Status
              </p>
              <p
                className="mt-2 flex items-center gap-2 text-sm font-medium text-base-content"
                title={lastSavedTooltip ?? undefined}
              >
                <ClockIcon className="size-4 text-primary" />
                {lastSavedDisplay}
              </p>
              <p className="mt-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-base-content/60">
                {note?.pinned ? (
                  <>
                    <PinIcon className="size-3.5 text-warning" />
                    <span>Pinned to top</span>
                  </>
                ) : (
                  <>
                    <PinOffIcon className="size-3.5" />
                    <span>Not pinned</span>
                  </>
                )}
              </p>
              <p className="mt-1 text-xs text-base-content/60">
                Shortcut {shortcutLabel} to save
              </p>
            </div>
            <div className="rounded-xl border border-base-300/60 bg-base-100 p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase text-base-content/60">
                Word count
              </p>
              <p className="mt-2 text-2xl font-semibold text-base-content">
                {wordCount}
              </p>
              <p className="text-xs text-base-content/60">
                {characterCount} characters
              </p>
            </div>
            <div className="rounded-xl border border-base-300/60 bg-base-100 p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase text-base-content/60">
                Timeline
              </p>
              <p className="mt-2 text-sm font-medium text-base-content">
                {updatedAt ? `Updated ${formatRelativeTime(updatedAt)}` : "–"}
              </p>
              <p className="text-xs text-base-content/60">
                Created {createdAt ? formatDate(createdAt) : "–"}
              </p>
            </div>
          </section>

          <section className="space-y-6">
            <div className="card border border-base-300/60 bg-base-100 shadow-sm">
              <div className="card-body space-y-5">
                <label className="form-control gap-2">
                  <span className="label-text text-sm font-semibold">
                    Title
                  </span>
                  <input
                    type="text"
                    placeholder="Note title"
                    className="input input-bordered input-lg bg-base-200/60"
                    value={note.title ?? ""}
                    onChange={handleTitleChange}
                  />
                </label>
                <label className="form-control gap-2">
                  <span className="label-text text-sm font-semibold">
                    Content
                  </span>
                  <textarea
                    placeholder="Write your note here..."
                    className="textarea textarea-bordered min-h-[18rem] leading-relaxed"
                    value={note.content ?? ""}
                    onChange={handleContentChange}
                  />
                  <span className="text-right text-xs text-base-content/60">
                    {wordCount} words · {characterCount} characters
                  </span>
                </label>
              </div>
            </div>

            <div className="card border border-base-300/60 bg-base-100 shadow-sm">
              <div className="card-body space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold">Tags</h3>
                    <p className="text-xs text-base-content/60">
                      Press Enter or comma to add up to {tagLimit} tags
                    </p>
                  </div>
                  <span className="badge badge-outline text-xs">
                    {tagCount}/{tagLimit}
                  </span>
                </div>
                <TagInput value={note.tags ?? []} onChange={handleTagsChange} />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-base-300/60 bg-base-100/80 px-4 py-4 text-xs text-base-content/70">
              <span>
                Tip: Use{" "}
                <span className="font-semibold text-base-content">
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
