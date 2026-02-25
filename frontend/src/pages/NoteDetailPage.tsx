import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeftIcon,
  CheckIcon,
  HistoryIcon,
  LoaderIcon,
  PinIcon,
  PinOffIcon,
  RefreshCwIcon,
  SaveIcon,
  Trash2Icon,
  UsersIcon,
  EyeIcon,
} from "lucide-react";
import * as Y from "yjs";
import { TiptapTransformer } from "@hocuspocus/transformer";

import api from "../lib/axios";
import ConfirmDialog from "../Components/ConfirmDialog";
import TagInput from "../Components/TagInput";
import CollaborativeEditor, {
  type CollaborativeEditorUser,
} from "../Components/CollaborativeEditor";
import PresenceAvatars from "../Components/PresenceAvatars";
import TypingIndicator from "../Components/TypingIndicator";
import NoteCollaboratorsCard from "../Components/NoteCollaboratorsCard";
import { countWords, formatDate, formatRelativeTime } from "../lib/Utils";
import useCollaborativeNote, {
  buildInitialNode,
} from "../hooks/useCollaborativeNote";
import useAuth from "../hooks/useAuth";

const HISTORY_REFRESH_MS = 15_000;
const MAX_HISTORY_RESULTS = 100;
const TAG_LIMIT = 8;

const computeStats = (text: string) => ({
  wordCount: countWords(text ?? ""),
  characterCount: text?.length ?? 0,
});

const mapCollabStatus = (status: string, participantCount: number) => {
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

const formatRoleLabel = (role: string) => {
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

function NoteDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [title, setTitle] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [pinned, setPinned] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pinning, setPinning] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [contentStats, setContentStats] = useState({
    wordCount: 0,
    characterCount: 0,
  });
  const [showHistory, setShowHistory] = useState(false);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(
    null,
  );

  const editorRef = useRef<any>(null);
  const originalSnapshotRef = useRef<any>(null);
  const skipInitialUpdateRef = useRef(true);
  const allowNavigationRef = useRef(false);
  const titleSharedRef = useRef<any>(null);

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
  const canManageNoteCollaborators = note?.canManageCollaborators ?? false;
  const canEditNote = note?.canEdit ?? true;
  const isReadOnly = !canEditNote;
  const notebookRole = note?.notebookRole ?? null;
  const collaboratorRole = note?.collaboratorRole ?? null;
  const membershipRole = note?.membershipRole ?? null;
  const effectiveRole = note?.effectiveRole ?? null;

  const {
    provider,
    doc,
    status: collabStatus,
    participants,
    typingUsers,
    color,
    signalTyping,
  } = useCollaborativeNote(id ?? null, note);

  const applySharedTitle = useCallback((value: string) => {
    const shared = titleSharedRef.current;
    const nextValue = typeof value === "string" ? value : "";
    if (!shared) {
      return;
    }
    const currentValue = shared.toString();
    if (currentValue === nextValue) {
      return;
    }

    const docInstance = shared.doc;
    if (!docInstance) {
      return;
    }

    docInstance.transact(() => {
      let start = 0;
      const currentLength = currentValue.length;
      const nextLength = nextValue.length;

      while (
        start < currentLength &&
        start < nextLength &&
        currentValue[start] === nextValue[start]
      ) {
        start += 1;
      }

      let currentEnd = currentLength;
      let nextEnd = nextLength;

      while (
        currentEnd > start &&
        nextEnd > start &&
        currentValue[currentEnd - 1] === nextValue[nextEnd - 1]
      ) {
        currentEnd -= 1;
        nextEnd -= 1;
      }

      const deleteCount = currentEnd - start;
      if (deleteCount > 0) {
        shared.delete(start, deleteCount);
      }

      if (nextEnd > start) {
        shared.insert(start, nextValue.slice(start, nextEnd));
      }
    });
  }, []);

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
    const nextTitle = note.title ?? "";
    setTitle(nextTitle);
    applySharedTitle(nextTitle);
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
  }, [note, applySharedTitle]);

  useEffect(() => {
    if (!doc) return undefined;

    const handleUpdate = () => {
      if (skipInitialUpdateRef.current) {
        skipInitialUpdateRef.current = false;
        return;
      }
      const text = editorRef.current?.getText({ blockSeparator: "\n" }) ?? "";
      setContentStats(computeStats(text));
      if (!canEditNote) {
        return;
      }
      setHasChanges(true);
    };

    doc.on("update", handleUpdate);
    return () => {
      doc.off("update", handleUpdate);
    };
  }, [doc, canEditNote]);

  useEffect(() => {
    if (!doc) return undefined;

    const sharedTitle = doc.getText("title");
    titleSharedRef.current = sharedTitle;

    if (sharedTitle.length === 0 && (note?.title ?? "")) {
      sharedTitle.doc?.transact(() => {
        if (sharedTitle.length > 0) {
          sharedTitle.delete(0, sharedTitle.length);
        }
        sharedTitle.insert(0, note?.title ?? "");
      });
    }

    const syncFromShared = () => {
      setTitle(sharedTitle.toString());
    };

    syncFromShared();
    sharedTitle.observe(syncFromShared);

    return () => {
      sharedTitle.unobserve(syncFromShared);
      if (titleSharedRef.current === sharedTitle) {
        titleSharedRef.current = null;
      }
    };
  }, [doc, note?.title]);

  const handleEditorReady = useCallback((editor: any) => {
    editorRef.current = editor;
    const text = editor.getText({ blockSeparator: "\n" }) ?? "";
    setContentStats(computeStats(text));

    editor.on("update", () => {
      const value = editor.getText({ blockSeparator: "\n" }) ?? "";
      setContentStats(computeStats(value));
    });
  }, []);

  const handleTitleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      if (!canEditNote) return;
      const value = event.target.value;
      setTitle(value);
      setHasChanges(true);
      applySharedTitle(value);
    },
    [applySharedTitle, canEditNote],
  );

  const handleTagsChange = useCallback(
    (nextTags: string[]) => {
      if (!canEditNote) return;
      setTags(Array.isArray(nextTags) ? nextTags.slice(0, TAG_LIMIT) : []);
      setHasChanges(true);
    },
    [canEditNote],
  );

  const handleSave = useCallback(async () => {
    if (!canEditNote) {
      toast.error("You have view-only access to this note.");
      return;
    }
    if (!id) return;
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      toast.error("Add a title before saving");
      return;
    }

    const snapshot = originalSnapshotRef.current;
    const richContent = doc
      ? TiptapTransformer.fromYdoc(doc, "default")
      : (snapshot?.richContent ?? buildInitialNode(snapshot ?? note));
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
      const savedTitle = normalized.title ?? trimmedTitle;
      setTitle(savedTitle);
      applySharedTitle(savedTitle);
      setTags(normalized.tags ?? []);
      setPinned(Boolean(normalized.pinned));
      setLastSavedAt(new Date(normalized.updatedAt ?? Date.now()));
      setHasChanges(false);
      toast.success("Note updated successfully");
    } catch (error: any) {
      const message =
        error.response?.data?.message ?? "Failed to update note. Please retry.";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }, [
    applySharedTitle,
    canEditNote,
    doc,
    id,
    note,
    pinned,
    queryClient,
    tags,
    title,
  ]);

  const handleRevert = useCallback(() => {
    if (!canEditNote) return;
    const snapshot = originalSnapshotRef.current;
    if (!snapshot) return;

    const revertedTitle = snapshot.title ?? "";
    setTitle(revertedTitle);
    applySharedTitle(revertedTitle);
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
  }, [applySharedTitle, canEditNote, doc]);

  const handleTogglePinned = useCallback(async () => {
    if (!canEditNote) {
      toast.error("You have view-only access to this note.");
      return;
    }
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
        normalized.pinned ? "Note pinned to top" : "Note removed from pinned",
      );
    } catch (error: any) {
      const message =
        error.response?.data?.message ?? "Failed to update pin status";
      toast.error(message);
    } finally {
      setPinning(false);
    }
  }, [canEditNote, id, pinned, queryClient]);

  const openConfirm = useCallback(() => {
    if (!canEditNote) {
      toast.error("You have view-only access to this note.");
      return;
    }
    setConfirmOpen(true);
  }, [canEditNote]);

  const closeConfirm = useCallback(() => {
    if (!deleting) {
      setConfirmOpen(false);
    }
  }, [deleting]);

  const handleDelete = useCallback(async () => {
    if (!canEditNote) return;
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
  }, [canEditNote, id, navigate, queryClient]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (!canEditNote) {
          toast.error("You have view-only access to this note.");
          return;
        }
        if (!saving && hasChanges) {
          void handleSave();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canEditNote, handleSave, hasChanges, saving]);

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
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
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

    const handleClick = (e: MouseEvent) => {
      // Check if clicking a link that would navigate away
      const link = (e.target as HTMLElement).closest("a");
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
    if (isReadOnly) {
      return {
        className: "badge-outline",
        label: "View only",
        Icon: EyeIcon,
        iconClassName: "size-3 text-base-content/70 shrink-0",
      };
    }

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
  }, [hasChanges, isReadOnly]);
  const StatusBadgeIcon = statusBadge.Icon;

  const collabBadge = useMemo(
    () => mapCollabStatus(collabStatus, participants.length),
    [collabStatus, participants.length],
  );
  const CollabBadgeIcon = collabBadge.Icon;

  const sanitizedTitle = title.trim() ? title.trim() : "Untitled note";
  const { wordCount, characterCount } = contentStats;
  const tagCount = tags.length;
  const disableSave = isReadOnly || saving || !hasChanges;
  const disableRevert = isReadOnly || saving || !hasChanges;
  const accessSummary = useMemo(() => {
    const permissionLabel = formatRoleLabel(effectiveRole ?? "viewer");
    if (notebookRole) {
      return `You were invited to this notebook as a ${formatRoleLabel(
        notebookRole,
      )}. Current permission: ${permissionLabel}.`;
    }
    if (collaboratorRole) {
      return `You were added as a ${formatRoleLabel(
        collaboratorRole,
      )} collaborator on this note. Current permission: ${permissionLabel}.`;
    }
    if (membershipRole) {
      return `Your workspace role is ${formatRoleLabel(
        membershipRole,
      )}. Current permission: ${permissionLabel}.`;
    }
    return `You can view this note but cannot edit it. Current permission: ${permissionLabel}.`;
  }, [collaboratorRole, effectiveRole, membershipRole, notebookRole]);

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
              The note you&apos;re looking for might have been deleted or never
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
      <div className="min-h-screen bg-base-200">
        <header className="sticky top-0 z-30 bg-base-100/90 backdrop-blur-lg border-b border-base-300/40">
          <div className="mx-auto flex max-w-4xl items-center gap-2 px-4 py-2 sm:px-6 sm:gap-3">
            <Link
              to="/app"
              className="btn btn-ghost btn-sm btn-circle shrink-0"
              aria-label="Back to notes"
            >
              <ArrowLeftIcon className="size-4" />
            </Link>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm sm:text-base font-semibold text-base-content truncate">
                  {sanitizedTitle}
                </span>
                {pinned && <PinIcon className="size-3 text-warning shrink-0" />}
                <span
                  className={`badge badge-xs gap-1 ${statusBadge.className} whitespace-nowrap shrink-0`}
                >
                  <StatusBadgeIcon className={statusBadge.iconClassName} />
                  <span className="text-[10px]">{statusBadge.label}</span>
                </span>
              </div>
              <div
                className="flex items-center gap-1.5 sm:gap-2 text-[11px] text-base-content/50 mt-0.5"
                title={lastSavedTooltip ?? undefined}
              >
                <span className="truncate">{lastSavedDisplay}</span>
                <span className="hidden sm:inline">·</span>
                <span className="hidden sm:inline">{wordCount} words</span>
                <span className="hidden sm:flex items-center gap-1">
                  · <CollabBadgeIcon className="size-3" />
                  {collabBadge.label}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
              <PresenceAvatars participants={participants} />
              <button
                type="button"
                className={`btn btn-ghost btn-xs sm:btn-sm btn-circle ${
                  pinned ? "text-warning" : ""
                }`}
                onClick={handleTogglePinned}
                disabled={pinning || isReadOnly}
                title={pinned ? "Unpin note" : "Pin note"}
              >
                {pinning ? (
                  <LoaderIcon className="size-3.5 animate-spin" />
                ) : pinned ? (
                  <PinOffIcon className="size-3.5" />
                ) : (
                  <PinIcon className="size-3.5" />
                )}
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-xs sm:btn-sm btn-circle"
                onClick={handleRevert}
                disabled={disableRevert}
                title="Revert changes"
              >
                <RefreshCwIcon className="size-3.5" />
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-xs sm:btn-sm btn-circle text-error"
                onClick={openConfirm}
                title="Delete note"
                disabled={isReadOnly}
              >
                <Trash2Icon className="size-3.5" />
              </button>
              <button
                type="button"
                className="btn btn-primary btn-xs sm:btn-sm gap-1 font-medium"
                onClick={handleSave}
                disabled={disableSave}
                title={`Save (${shortcutLabel})`}
              >
                {saving ? (
                  <LoaderIcon className="size-3.5 animate-spin" />
                ) : (
                  <SaveIcon className="size-3.5" />
                )}
                <span className="hidden sm:inline">
                  {saving ? "Saving…" : "Save"}
                </span>
              </button>
            </div>
          </div>
        </header>

        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto w-full max-w-4xl space-y-5 px-4 py-6"
        >
          {isReadOnly ? (
            <div className="alert alert-info border border-info/40 bg-info/5 text-info-content">
              <EyeIcon className="size-5" />
              <div className="space-y-1">
                <h3 className="font-semibold">View-only access</h3>
                <p className="text-sm text-base-content/70">
                  {accessSummary} Contact an editor or the owner if you need to
                  contribute edits.
                </p>
              </div>
            </div>
          ) : null}

          <section className="space-y-5">
            <div className="card border border-base-300/60 border-l-4 border-l-primary/30 bg-base-100/90 shadow-sm rounded-2xl">
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
                    disabled={isReadOnly}
                    aria-readonly={isReadOnly}
                  />
                </label>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-primary">
                      Content
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
                    user={user as CollaborativeEditorUser}
                    onReady={handleEditorReady}
                    onTyping={signalTyping}
                    readOnly={!canEditNote}
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

            {note ? (
              <NoteCollaboratorsCard
                noteId={note._id}
                canManage={canManageNoteCollaborators}
              />
            ) : null}

            <div className="card border border-base-300/60 bg-base-100/90 shadow-sm rounded-2xl">
              <div className="card-body space-y-5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-base font-bold text-primary">Tags</h3>
                    <p className="text-xs text-base-content/60">
                      Press Enter or comma to add up to {TAG_LIMIT} tags
                    </p>
                  </div>
                  <span className="badge badge-primary badge-outline text-xs px-3 py-1">
                    {tagCount}/{TAG_LIMIT}
                  </span>
                </div>
                <TagInput
                  value={tags}
                  onChange={handleTagsChange}
                  disabled={isReadOnly}
                />
              </div>
            </div>

            <div className="card border border-base-300/60 bg-base-100/90 shadow-sm rounded-2xl">
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
                        {history.map((entry: any) => {
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
                  Save &amp; Leave
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
