import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  ArrowLeftIcon,
  CheckIcon,
  ClockIcon,
  HistoryIcon,
  LoaderIcon,
  PinIcon,
  PinOffIcon,
  RefreshCwIcon,
  SaveIcon,
  Trash2Icon,
  UsersIcon,
} from "lucide-react";
import * as Y from "yjs";
import { TiptapTransformer } from "@hocuspocus/transformer";

import api from "../lib/axios";
import ConfirmDialog from "../Components/ConfirmDialog.jsx";
import TagInput from "../Components/TagInput.jsx";
import CollaborativeEditor from "../Components/CollaborativeEditor.jsx";
import PresenceAvatars from "../Components/PresenceAvatars.jsx";
import TypingIndicator from "../Components/TypingIndicator.jsx";
import { countWords, formatDate, formatRelativeTime } from "../lib/Utils.js";
import useCollaborativeNote, {
  buildInitialNode,
} from "../hooks/useCollaborativeNote.js";
import useAuth from "../hooks/useAuth.js";

const HISTORY_REFRESH_MS = 15_000;
const MAX_HISTORY_RESULTS = 100;
const TAG_LIMIT = 8;

const computeStats = (text) => ({
  wordCount: countWords(text ?? ""),
  characterCount: text?.length ?? 0,
});

const mapCollabStatus = (status, participantCount) => {
  switch (status) {
    case "connected":
      return {
        className: "badge-success",
        label: participantCount
          ? `${participantCount} live${participantCount > 1 ? "s" : ""}`
          : "Live",
        Icon: CheckIcon,
      };
    case "connecting":
      return {
        className: "badge-warning",
        label: "Connecting…",
        Icon: LoaderIcon,
      };
    case "disconnected":
    default:
      return {
        className: "badge-outline",
        label: "Offline",
        Icon: RefreshCwIcon,
      };
  }
};

function NoteDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [title, setTitle] = useState("");
  const [tags, setTags] = useState([]);
  const [pinned, setPinned] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pinning, setPinning] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [contentStats, setContentStats] = useState({
    wordCount: 0,
    characterCount: 0,
  });
  const [showHistory, setShowHistory] = useState(false);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState(null);

  const editorRef = useRef(null);
  const originalSnapshotRef = useRef(null);
  const skipInitialUpdateRef = useRef(true);
  const allowNavigationRef = useRef(false);

  const noteQuery = useQuery({
    queryKey: ["note", id],
    queryFn: async () => {
      const response = await api.get(`/notes/${id}`);
      return {
        ...response.data,
        tags: Array.isArray(response.data.tags) ? response.data.tags : [],
        pinned: Boolean(response.data.pinned),
      };
    },
    enabled: Boolean(id),
    retry: 1,
  });

  const note = noteQuery.data ?? null;

  const {
    provider,
    doc,
    status: collabStatus,
    participants,
    typingUsers,
    color,
    signalTyping,
  } = useCollaborativeNote(id, note);

  const historyQuery = useQuery({
    queryKey: ["note-history", id],
    queryFn: async () => {
      const response = await api.get(`/notes/${id}/history`, {
        params: { limit: MAX_HISTORY_RESULTS },
      });
      return response.data?.history ?? [];
    },
    enabled: Boolean(id),
    refetchInterval: HISTORY_REFRESH_MS,
  });

  const history = historyQuery.data ?? [];

  useEffect(() => {
    if (!note) return;
    setTitle(note.title ?? "");
    setTags(Array.isArray(note.tags) ? [...note.tags] : []);
    setPinned(Boolean(note.pinned));
    const savedAt = note.updatedAt ?? note.createdAt;
    if (savedAt) {
      setLastSavedAt(new Date(savedAt));
    }
    originalSnapshotRef.current = note;
    skipInitialUpdateRef.current = true;
    setHasChanges(false);
    setContentStats(computeStats(note.content ?? ""));
  }, [note]);

  useEffect(() => {
    if (!doc) return undefined;

    const handleUpdate = () => {
      if (skipInitialUpdateRef.current) {
        skipInitialUpdateRef.current = false;
        return;
      }
      setHasChanges(true);
      const text = editorRef.current?.getText({ blockSeparator: "\n" }) ?? "";
      setContentStats(computeStats(text));
    };

    doc.on("update", handleUpdate);
    return () => {
      doc.off("update", handleUpdate);
    };
  }, [doc]);

  const handleEditorReady = useCallback((editor) => {
    editorRef.current = editor;
    const text = editor.getText({ blockSeparator: "\n" }) ?? "";
    setContentStats(computeStats(text));

    editor.on("update", () => {
      const value = editor.getText({ blockSeparator: "\n" }) ?? "";
      setContentStats(computeStats(value));
    });
  }, []);

  const handleTitleChange = useCallback((event) => {
    setTitle(event.target.value);
    setHasChanges(true);
  }, []);

  const handleTagsChange = useCallback((nextTags) => {
    setTags(Array.isArray(nextTags) ? nextTags.slice(0, TAG_LIMIT) : []);
    setHasChanges(true);
  }, []);

  const handleSave = useCallback(async () => {
    if (!id) return;
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      toast.error("Add a title before saving");
      return;
    }

    const snapshot = originalSnapshotRef.current;
    const richContent = doc
      ? TiptapTransformer.fromYdoc(doc, "default")
      : snapshot?.richContent ?? buildInitialNode(snapshot ?? note);
    const plainText =
      editorRef.current?.getText({ blockSeparator: "\n" }) ??
      note?.content ??
      "";

    const payload = {
      title: trimmedTitle,
      tags,
      pinned,
      richContent,
      content: plainText,
      contentText: plainText,
    };

    setSaving(true);
    try {
      const response = await api.put(`/notes/${id}`, payload);
      const normalized = {
        ...response.data,
        tags: Array.isArray(response.data.tags) ? response.data.tags : [],
        pinned: Boolean(response.data.pinned),
      };
      originalSnapshotRef.current = normalized;
      queryClient.setQueryData(["note", id], normalized);
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      setTitle(normalized.title ?? trimmedTitle);
      setTags(normalized.tags ?? []);
      setPinned(Boolean(normalized.pinned));
      setLastSavedAt(new Date(normalized.updatedAt ?? Date.now()));
      setHasChanges(false);
      toast.success("Note updated successfully");
    } catch (error) {
      const message =
        error.response?.data?.message ?? "Failed to update note. Please retry.";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }, [doc, id, note, pinned, queryClient, tags, title]);

  const handleRevert = useCallback(() => {
    const snapshot = originalSnapshotRef.current;
    if (!snapshot) return;

    setTitle(snapshot.title ?? "");
    setTags(Array.isArray(snapshot.tags) ? [...snapshot.tags] : []);
    setPinned(Boolean(snapshot.pinned));

    if (doc) {
      const fragment = doc.getXmlFragment("default");
      fragment.delete(0, fragment.length);
      const node = snapshot.richContent ?? buildInitialNode(snapshot);
      if (node) {
        const seedDoc = TiptapTransformer.toYdoc(node, "default");
        const update = Y.encodeStateAsUpdate(seedDoc);
        Y.applyUpdate(doc, update);
      }
    }

    const text = editorRef.current?.getText({ blockSeparator: "\n" }) ?? "";
    setContentStats(computeStats(text));
    setHasChanges(false);
    toast.success("Changes reverted");
  }, [doc]);

  const handleTogglePinned = useCallback(async () => {
    if (!id) return;
    const desiredPinned = !pinned;
    setPinning(true);
    try {
      const response = await api.put(`/notes/${id}`, { pinned: desiredPinned });
      const normalized = {
        ...response.data,
        tags: Array.isArray(response.data.tags) ? response.data.tags : [],
        pinned: Boolean(response.data.pinned ?? desiredPinned),
      };
      originalSnapshotRef.current = normalized;
      queryClient.setQueryData(["note", id], normalized);
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      setPinned(Boolean(normalized.pinned));
      setLastSavedAt(new Date(normalized.updatedAt ?? Date.now()));
      toast.success(
        normalized.pinned ? "Note pinned to top" : "Note removed from pinned"
      );
    } catch (error) {
      const message =
        error.response?.data?.message ?? "Failed to update pin status";
      toast.error(message);
    } finally {
      setPinning(false);
    }
  }, [id, pinned, queryClient]);

  const openConfirm = useCallback(() => {
    setConfirmOpen(true);
  }, []);

  const closeConfirm = useCallback(() => {
    if (!deleting) {
      setConfirmOpen(false);
    }
  }, [deleting]);

  const handleDelete = useCallback(async () => {
    if (!id) return;
    setDeleting(true);
    try {
      await api.delete(`/notes/${id}`);
      toast.success("Note deleted");
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      navigate("/app");
    } catch (error) {
      console.error("Failed to delete note", error);
      toast.error("Failed to delete note");
    } finally {
      setDeleting(false);
      setConfirmOpen(false);
    }
  }, [id, navigate, queryClient]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handleKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (!saving && hasChanges) {
          void handleSave();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSave, hasChanges, saving]);

  const createdAt = useMemo(() => {
    if (!note?.createdAt) return null;
    return new Date(note.createdAt);
  }, [note?.createdAt]);

  const updatedAt = useMemo(() => {
    if (note?.updatedAt) return new Date(note.updatedAt);
    return createdAt;
  }, [note?.updatedAt, createdAt]);

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

  // Navigation guard - prevent leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      // Allow navigation if we're intentionally saving and leaving
      if (hasChanges && !allowNavigationRef.current) {
        e.preventDefault();
        e.returnValue = "";
        return "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasChanges]);

  // Block React Router navigation when there are unsaved changes
  useEffect(() => {
    if (!hasChanges) return undefined;

    const handleClick = (e) => {
      // Check if clicking a link that would navigate away
      const link = e.target.closest("a");
      if (link && link.href && !link.href.includes(window.location.pathname)) {
        e.preventDefault();
        setPendingNavigation(link.href);
        setShowUnsavedModal(true);
      }
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [hasChanges]);

  const handleCancelNavigation = useCallback(() => {
    setShowUnsavedModal(false);
    setPendingNavigation(null);
  }, []);

  const handleConfirmNavigation = useCallback(() => {
    setShowUnsavedModal(false);
    allowNavigationRef.current = true;
    if (pendingNavigation) {
      window.location.href = pendingNavigation;
    }
  }, [pendingNavigation]);

  const handleSaveAndNavigate = useCallback(async () => {
    try {
      await handleSave();
      setShowUnsavedModal(false);
      allowNavigationRef.current = true;
      if (pendingNavigation) {
        // Use setTimeout to ensure hasChanges updates before navigation
        setTimeout(() => {
          window.location.href = pendingNavigation;
        }, 100);
      }
    } catch {
      toast.error("Failed to save changes");
      allowNavigationRef.current = false;
    }
  }, [handleSave, pendingNavigation]);

  const shortcutLabel = useMemo(() => {
    if (typeof navigator === "undefined") return "Ctrl+S";
    const platform = navigator?.platform ?? "";
    return /Mac|iPhone|iPad/i.test(platform) ? "⌘S" : "Ctrl+S";
  }, []);

  const statusBadge = useMemo(() => {
    if (hasChanges) {
      return {
        className: "badge-warning",
        label: "Unsaved changes",
        Icon: RefreshCwIcon,
        iconClassName: "size-3 text-warning-content shrink-0",
      };
    }

    return {
      className: "badge-success",
      label: "Up to date",
      Icon: CheckIcon,
      iconClassName: "size-3 text-success-content shrink-0",
    };
  }, [hasChanges]);
  const StatusBadgeIcon = statusBadge.Icon;

  const collabBadge = useMemo(
    () => mapCollabStatus(collabStatus, participants.length),
    [collabStatus, participants.length]
  );
  const CollabBadgeIcon = collabBadge.Icon;

  const sanitizedTitle = title.trim() ? title.trim() : "Untitled note";
  const { wordCount, characterCount } = contentStats;
  const tagCount = tags.length;
  const disableSave = saving || !hasChanges;
  const disableRevert = saving || !hasChanges;

  if (noteQuery.isLoading) {
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
              <Link to="/app" className="btn btn-primary">
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
        <header className="sticky top-0 z-30 mx-auto max-w-4xl rounded-b-2xl shadow-lg border border-base-300/30 bg-base-100/90 backdrop-blur-lg mt-2">
          <div className="flex w-full flex-col gap-3 px-3 py-3 sm:px-6 sm:py-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-1 min-w-0 items-start gap-2 sm:gap-4">
              <Link
                to="/app"
                className="btn btn-ghost btn-sm btn-circle sm:btn-md shadow-md hover:bg-primary/10"
                aria-label="Back to notes"
              >
                <ArrowLeftIcon className="size-4 sm:size-5" />
              </Link>
              <div className="flex-1 min-w-0 space-y-1.5 sm:space-y-2">
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <span className="text-base sm:text-lg font-bold text-base-content truncate">
                    {sanitizedTitle}
                  </span>
                  {pinned && (
                    <span className="badge badge-warning badge-sm sm:badge-lg flex items-center gap-1 sm:gap-2">
                      <PinIcon className="size-3 sm:size-4" />
                      <span className="hidden sm:inline">Pinned</span>
                    </span>
                  )}
                </div>
                <div
                  className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs text-base-content/60"
                  title={lastSavedTooltip ?? undefined}
                >
                  <ClockIcon className="size-3.5 sm:size-4" />
                  <span className="truncate text-[10px] sm:text-xs">{lastSavedDisplay}</span>
                  <span
                    className={`badge badge-xs sm:badge-sm items-center gap-1 ${statusBadge.className} whitespace-nowrap`}
                  >
                    <StatusBadgeIcon className={statusBadge.iconClassName} />
                    <span className="hidden sm:inline">{statusBadge.label}</span>
                  </span>
                </div>
              </div>
            </div>
            <div className="flex flex-col items-start lg:items-end gap-2">
              <div className="flex items-center gap-2">
                <PresenceAvatars participants={participants} />
                <span
                  className={`badge badge-xs sm:badge-sm gap-1 ${collabBadge.className} whitespace-nowrap`}
                >
                  <CollabBadgeIcon className="size-3" />
                  <span className="text-[10px] sm:text-xs">{collabBadge.label}</span>
                </span>
              </div>
              <div className="grid grid-cols-4 lg:flex lg:flex-wrap items-center gap-1.5 sm:gap-2 w-full lg:w-auto">
                <button
                  type="button"
                  className={`btn btn-outline btn-xs sm:btn-sm lg:btn-md gap-1 sm:gap-2 ${
                    pinned ? "border-warning text-warning" : ""
                  }`}
                  onClick={handleTogglePinned}
                  disabled={pinning}
                  title={pinned ? "Unpin note" : "Pin note"}
                >
                  {pinning ? (
                    <LoaderIcon className="size-3 sm:size-4 animate-spin" />
                  ) : pinned ? (
                    <PinOffIcon className="size-3 sm:size-4" />
                  ) : (
                    <PinIcon className="size-3 sm:size-4" />
                  )}
                  <span className="hidden sm:inline">{pinned ? "Unpin" : "Pin"}</span>
                </button>
                <button
                  type="button"
                  className="btn btn-outline btn-xs sm:btn-sm lg:btn-md gap-1 sm:gap-2"
                  onClick={handleRevert}
                  disabled={disableRevert}
                  title="Revert changes"
                >
                  <RefreshCwIcon className="size-3 sm:size-4" />
                  <span className="hidden sm:inline">Revert</span>
                </button>
                <button
                  type="button"
                  className="btn btn-outline btn-error btn-xs sm:btn-sm lg:btn-md gap-1 sm:gap-2"
                  onClick={openConfirm}
                  title="Delete note"
                >
                  <Trash2Icon className="size-3 sm:size-4" strokeWidth={2.2} />
                  <span className="hidden sm:inline">Delete</span>
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-xs sm:btn-sm lg:btn-md font-semibold gap-1 sm:gap-2 shadow-lg"
                  onClick={handleSave}
                  disabled={disableSave}
                  title="Save changes"
                >
                  {saving ? (
                    <LoaderIcon className="size-3 sm:size-4 animate-spin" />
                  ) : (
                    <SaveIcon className="size-3 sm:size-4" />
                  )}
                  <span className="hidden sm:inline">{saving ? "Saving" : "Save changes"}</span>
                </button>
              </div>
            </div>
          </div>
        </header>

        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto w-full max-w-4xl space-y-8 px-4 py-10"
        >
          <section className="grid gap-6 md:grid-cols-3">
            <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-base-100 via-base-200 to-primary/10 p-5 shadow-lg space-y-3">
              <p className="text-xs font-bold uppercase text-primary tracking-wide">
                Status
              </p>
              <p
                className="flex items-center gap-2 text-sm font-semibold text-base-content"
                title={lastSavedTooltip ?? undefined}
              >
                <ClockIcon className="size-4 text-primary" />
                {lastSavedDisplay}
              </p>
              <p className="text-xs text-base-content/60">
                Shortcut:
                <span className="ml-2 rounded px-2 py-1 font-mono bg-base-300/40">
                  {shortcutLabel}
                </span>
              </p>
            </div>
            <div className="rounded-2xl border border-secondary/30 bg-gradient-to-br from-base-100 via-base-200 to-secondary/10 p-5 shadow-lg space-y-3">
              <p className="text-xs font-bold uppercase text-secondary tracking-wide">
                Writing stats
              </p>
              <p className="text-3xl font-bold text-secondary">{wordCount}</p>
              <p className="text-xs text-base-content/60">
                {characterCount} characters
              </p>
            </div>
            <div className="rounded-2xl border border-accent/30 bg-gradient-to-br from-base-100 via-base-200 to-accent/10 p-5 shadow-lg space-y-3">
              <p className="text-xs font-bold uppercase text-accent tracking-wide">
                Timeline
              </p>
              <p className="text-sm font-semibold text-accent">
                {updatedAt ? `Updated ${formatRelativeTime(updatedAt)}` : "–"}
              </p>
              <p className="text-xs text-base-content/60">
                Created {createdAt ? formatDate(createdAt) : "–"}
              </p>
            </div>
          </section>

          <section className="space-y-6">
            <div className="card border border-base-300/60 bg-base-100/90 shadow-lg rounded-2xl">
              <div className="card-body space-y-4">
                <label className="form-control gap-2">
                  <span className="label-text text-sm font-semibold text-primary">
                    Title
                  </span>
                  <input
                    type="text"
                    placeholder="Note title"
                    className="input input-bordered input-lg bg-base-200/60 rounded-xl focus:ring-2 focus:ring-primary/40 transition-all"
                    value={title}
                    onChange={handleTitleChange}
                  />
                </label>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-secondary">
                      Collaborative content
                    </span>
                    <span className="badge badge-outline gap-1 text-xs">
                      <UsersIcon className="size-3" />
                      {participants.length || "No"} collaborator
                      {participants.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <CollaborativeEditor
                    provider={provider}
                    doc={doc}
                    color={color}
                    user={user}
                    onReady={handleEditorReady}
                    onTyping={signalTyping}
                    placeholder="Draft the note together..."
                  />
                  <div className="flex items-center justify-between">
                    <TypingIndicator typingUsers={typingUsers} />
                    <p className="text-right text-xs text-base-content/60">
                      {wordCount} words · {characterCount} characters
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="card border border-base-300/60 bg-base-100/90 shadow-lg rounded-2xl">
              <div className="card-body space-y-5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-base font-bold text-accent">Tags</h3>
                    <p className="text-xs text-base-content/60">
                      Press Enter or comma to add up to {TAG_LIMIT} tags
                    </p>
                  </div>
                  <span className="badge badge-accent badge-outline text-xs px-3 py-1">
                    {tagCount}/{TAG_LIMIT}
                  </span>
                </div>
                <TagInput value={tags} onChange={handleTagsChange} />
              </div>
            </div>

            <div className="card border border-base-300/60 bg-base-100/90 shadow-lg rounded-2xl">
              <div className="card-body space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-primary">
                      Change history
                    </h3>
                    <p className="text-xs text-base-content/60">
                      Recent edits from your team
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost gap-2"
                    onClick={() => setShowHistory((value) => !value)}
                  >
                    <HistoryIcon className="size-4" />
                    {showHistory ? "Hide" : "Show"} timeline
                  </button>
                </div>
                {showHistory && (
                  <div className="space-y-3">
                    {historyQuery.isFetching && history.length === 0 ? (
                      <div className="flex items-center justify-center py-6">
                        <LoaderIcon className="size-5 animate-spin" />
                      </div>
                    ) : history.length ? (
                      <ul className="space-y-3">
                        {history.map((entry) => {
                          const timestamp = entry.createdAt
                            ? new Date(entry.createdAt)
                            : null;
                          return (
                            <li
                              key={entry.id}
                              className="rounded-xl border border-base-300/60 bg-base-200/60 px-4 py-3"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-medium text-base-content">
                                    {entry.summary ?? entry.eventType}
                                  </p>
                                  <p className="text-xs uppercase tracking-wide text-base-content/60">
                                    {entry.eventType}
                                  </p>
                                </div>
                                <span className="text-xs text-base-content/60 whitespace-nowrap">
                                  {timestamp
                                    ? formatRelativeTime(timestamp)
                                    : ""}
                                </span>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p className="text-sm text-base-content/60">
                        Be the first to make a change and it will show up here.
                      </p>
                    )}
                  </div>
                )}
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

      {/* Unsaved Changes Navigation Modal */}
      <dialog
        className={`modal ${showUnsavedModal ? "modal-open" : ""}`}
        role="dialog"
        aria-labelledby="unsaved-modal-title"
      >
        <div className="modal-box border border-warning/30">
          <h3
            id="unsaved-modal-title"
            className="text-lg font-bold text-warning flex items-center gap-2"
          >
            <RefreshCwIcon className="size-5" />
            Unsaved Changes
          </h3>
          <p className="py-4 text-base-content/80">
            You have unsaved changes that will be lost if you leave this page.
            What would you like to do?
          </p>
          <div className="modal-action flex-col sm:flex-row gap-2">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={handleCancelNavigation}
            >
              Stay on Page
            </button>
            <button
              type="button"
              className="btn btn-error"
              onClick={handleConfirmNavigation}
            >
              Leave Without Saving
            </button>
            <button
              type="button"
              className="btn btn-success"
              onClick={handleSaveAndNavigate}
              disabled={saving}
            >
              {saving ? (
                <>
                  <LoaderIcon className="size-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <SaveIcon className="size-4" />
                  Save & Leave
                </>
              )}
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button type="button" onClick={handleCancelNavigation}>
            close
          </button>
        </form>
      </dialog>
    </>
  );
}

export default NoteDetailPage;
