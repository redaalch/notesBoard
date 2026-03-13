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
  CloudIcon,
  HistoryIcon,
  LoaderIcon,
  MoreVerticalIcon,
  PinIcon,
  PinOffIcon,
  RefreshCwIcon,
  SaveIcon,
  Share2Icon,
  SparklesIcon,
  Trash2Icon,
  UndoIcon,
  EyeIcon,
  XIcon,
} from "lucide-react";
import * as Y from "yjs";
import { TiptapTransformer } from "@hocuspocus/transformer";

import api from "../lib/axios";
import ConfirmDialog from "../Components/ConfirmDialog";
import CollaborativeEditor, {
  type CollaborativeEditorUser,
} from "../Components/CollaborativeEditor";
import PresenceAvatars from "../Components/PresenceAvatars";
import TypingIndicator from "../Components/TypingIndicator";
import NoteCollaboratorsCard from "../Components/NoteCollaboratorsCard";
import AiSummaryCard from "../Components/AiSummaryCard";
import AiTagSuggestions from "../Components/AiTagSuggestions";
import { countWords, formatDate, formatRelativeTime } from "../lib/Utils";
import useCollaborativeNote, {
  buildInitialNode,
} from "../hooks/useCollaborativeNote";
import useAuth from "../hooks/useAuth";
import useAiFeatures from "../hooks/useAiFeatures";

const HISTORY_REFRESH_MS = 15_000;
const MAX_HISTORY_RESULTS = 100;
const TAG_LIMIT = 8;

const computeStats = (text: string) => ({
  wordCount: countWords(text ?? ""),
  characterCount: text?.length ?? 0,
});

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

/* ── Tiny inline "+ Add tag" trigger ── */
const InlineTagAdder = ({
  onAdd,
  existingTags,
}: {
  onAdd: (tag: string) => void;
  existingTags: string[];
}) => {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const commit = () => {
    const trimmed = value.trim().toLowerCase();
    if (trimmed && !existingTags.includes(trimmed)) {
      onAdd(trimmed);
    }
    setValue("");
    setOpen(false);
  };

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  if (!open) {
    return (
      <button
        type="button"
        className="badge badge-sm badge-ghost gap-0.5 text-base-content/40 hover:text-base-content/70 transition-colors cursor-pointer"
        onClick={() => setOpen(true)}
      >
        + tag
      </button>
    );
  }

  return (
    <input
      ref={inputRef}
      type="text"
      className="h-5 w-20 rounded border border-base-300/60 bg-transparent px-1.5 text-xs text-base-content placeholder:text-base-content/30 focus:outline-none focus:border-primary/40"
      placeholder="tag name"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === ",") {
          e.preventDefault();
          commit();
        }
        if (e.key === "Escape") {
          setValue("");
          setOpen(false);
        }
      }}
      onBlur={commit}
    />
  );
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
  const [showCollaborators, setShowCollaborators] = useState(false);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(
    null,
  );

  const editorRef = useRef<any>(null);
  const originalSnapshotRef = useRef<any>(null);
  const skipInitialUpdateRef = useRef(true);
  const allowNavigationRef = useRef(false);
  const titleSharedRef = useRef<any>(null);
  const handleSaveRef = useRef<(silent?: boolean) => Promise<void>>(
    async () => {},
  );
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const justSavedRef = useRef(false);

  // ── AI Features ──
  const {
    isConfigured: aiConfigured,
    summary: aiSummary,
    summaryLoading,
    generateSummary,
    suggestedTags,
    tagsLoading: aiTagsLoading,
    requestTagSuggestions,
    clearSuggestedTags,
    toggleActionItem,
  } = useAiFeatures(id);

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
      // Ignore Yjs sync echoes that fire right after a save
      if (justSavedRef.current) return;
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

  const handleSave = useCallback(
    async (silent = false) => {
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
        setLastSavedAt(new Date(normalized.updatedAt ?? Date.now()));
        setHasChanges(false);

        if (silent) {
          // Silent auto-save: only update the snapshot + timestamp.
          // Do NOT touch queryClient or applySharedTitle — that would
          // trigger the note-sync useEffect which resets the editor.
          justSavedRef.current = true;
          setTimeout(() => {
            justSavedRef.current = false;
          }, 1500);

          // Request AI tag suggestions after auto-save (non-blocking)
          if (aiConfigured && suggestedTags.length === 0) {
            requestTagSuggestions();
          }
        } else {
          // Explicit save: full cache update so sidebar list reflects changes
          queryClient.setQueryData(["note", id], normalized);
          queryClient.removeQueries({ queryKey: ["notes"] });
          queryClient.removeQueries({ queryKey: ["notebooks"] });
          const savedTitle = normalized.title ?? trimmedTitle;
          setTitle(savedTitle);
          applySharedTitle(savedTitle);
          setTags(normalized.tags ?? []);
          setPinned(Boolean(normalized.pinned));
          toast.success("Note updated successfully");
        }
      } catch (error: any) {
        const message =
          error.response?.data?.message ??
          "Failed to update note. Please retry.";
        toast.error(message);
      } finally {
        setSaving(false);
      }
    },
    [
      applySharedTitle,
      canEditNote,
      doc,
      id,
      note,
      pinned,
      queryClient,
      tags,
      title,
      aiConfigured,
      suggestedTags,
      requestTagSuggestions,
    ],
  );

  // Keep ref always pointing at latest handleSave
  useEffect(() => {
    handleSaveRef.current = handleSave;
  }, [handleSave]);

  // ── Debounced auto-save: fires once 3 s after last hasChanges flip ──
  useEffect(() => {
    if (!hasChanges || saving || isReadOnly) return;
    autoSaveTimerRef.current = setTimeout(() => {
      void handleSaveRef.current(true);
    }, 3000);
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasChanges, saving, isReadOnly]);

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
      queryClient.removeQueries({ queryKey: ["notes"] });
      queryClient.removeQueries({ queryKey: ["notebooks"] });
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
      // Remove cached notebooks data so HomePage fetches fresh counts on mount
      queryClient.removeQueries({ queryKey: ["notebooks"] });
      queryClient.removeQueries({ queryKey: ["notes"] });
      queryClient.removeQueries({ queryKey: ["tag-stats"] });
      window.location.href = "/app";
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

  const lastSavedTooltip = useMemo(() => {
    if (hasChanges) return "You have pending edits";
    if (lastSavedAt) return formatDate(lastSavedAt);
    if (updatedAt) return formatDate(updatedAt);
    return null;
  }, [hasChanges, lastSavedAt, updatedAt]);

  // Navigation guard – auto-save before the tab closes
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Fire-and-forget save via sendBeacon or sync XHR is unreliable;
      // the debounced auto-save should have already flushed.
      // We still keep the flag so the browser prompt appears only if
      // auto-save hasn't caught up yet.
      if (hasChanges && !allowNavigationRef.current) {
        void handleSaveRef.current(true);
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasChanges]);

  // Intercept in-app link clicks – auto-save then navigate
  useEffect(() => {
    if (!hasChanges) return undefined;

    const handleClick = (e: MouseEvent) => {
      const link = (e.target as HTMLElement).closest("a");
      if (link && link.href && !link.href.includes(window.location.pathname)) {
        e.preventDefault();
        const dest = link.href;
        allowNavigationRef.current = true;
        // Flush save, then navigate
        handleSaveRef
          .current(true)
          .catch(() => {
            /* best-effort */
          })
          .finally(() => {
            window.location.href = dest;
          });
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
        className: "text-base-content/50",
        label: "View only",
        Icon: EyeIcon,
      };
    }
    if (saving) {
      return {
        className: "text-base-content/50",
        label: "Saving…",
        Icon: LoaderIcon,
      };
    }
    if (hasChanges) {
      return {
        className: "text-warning",
        label: "Editing",
        Icon: RefreshCwIcon,
      };
    }
    return {
      className: "text-success",
      label: "Saved to cloud",
      Icon: CloudIcon,
    };
  }, [hasChanges, isReadOnly, saving]);

  const { wordCount, characterCount } = contentStats;
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
      <div className="min-h-screen bg-base-100 flex items-center justify-center">
        <LoaderIcon className="animate-spin size-10" />
      </div>
    );
  }

  if (!note) {
    return (
      <div className="min-h-screen bg-base-100 flex items-center justify-center">
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

  const StatusIcon = statusBadge.Icon;

  return (
    <>
      <div className="min-h-screen bg-base-100">
        {/* ─── Zen header ─── */}
        <header className="sticky top-0 z-30 bg-base-100/80 backdrop-blur-xl border-b border-base-300/30">
          <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-2.5 sm:px-6">
            {/* Left – back link */}
            <Link
              to="/app"
              className="btn btn-ghost btn-sm gap-1.5 text-base-content/60 hover:text-base-content font-normal"
              aria-label="Back to notes"
            >
              <ArrowLeftIcon className="size-4" />
              <span className="hidden sm:inline text-sm">Notes</span>
            </Link>

            {/* Center – auto-save indicator */}
            <div className="flex-1 flex items-center justify-center gap-1.5">
              <StatusIcon
                className={`size-3.5 ${statusBadge.className} ${
                  saving ? "animate-spin" : ""
                }`}
              />
              <span
                className={`text-xs font-medium ${statusBadge.className}`}
                title={lastSavedTooltip ?? undefined}
              >
                {statusBadge.label}
              </span>
              {pinned && (
                <span className="ml-1" title="Pinned">
                  <PinIcon className="size-3 text-warning" />
                </span>
              )}
            </div>

            {/* Right – actions */}
            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
              <PresenceAvatars participants={participants} />

              {/* Share button */}
              <button
                type="button"
                className="btn btn-ghost btn-sm gap-1.5 text-base-content/70"
                onClick={() => setShowCollaborators(true)}
                title="Share & collaborate"
              >
                <Share2Icon className="size-4" />
                <span className="hidden sm:inline text-sm">Share</span>
              </button>

              {/* More menu */}
              <div className="dropdown dropdown-end">
                <button
                  type="button"
                  tabIndex={0}
                  className="btn btn-ghost btn-sm btn-square"
                  aria-label="More actions"
                >
                  <MoreVerticalIcon className="size-4" />
                </button>
                <ul
                  tabIndex={0}
                  className="dropdown-content menu bg-base-100 rounded-xl w-52 p-2 shadow-lg border border-base-300/40 z-50"
                >
                  <li>
                    <button
                      type="button"
                      className="gap-2"
                      onClick={() => handleSave()}
                      disabled={disableSave}
                    >
                      <SaveIcon className="size-4" />
                      Save now
                      <kbd className="ml-auto text-[10px] text-base-content/40">
                        {shortcutLabel}
                      </kbd>
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      className={`gap-2 ${pinned ? "text-warning" : ""}`}
                      onClick={handleTogglePinned}
                      disabled={pinning || isReadOnly}
                    >
                      {pinned ? (
                        <PinOffIcon className="size-4" />
                      ) : (
                        <PinIcon className="size-4" />
                      )}
                      {pinned ? "Unpin note" : "Pin note"}
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      className="gap-2"
                      onClick={handleRevert}
                      disabled={disableRevert}
                    >
                      <UndoIcon className="size-4" />
                      Revert changes
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      className="gap-2"
                      onClick={() => setShowHistory(true)}
                    >
                      <HistoryIcon className="size-4" />
                      View history
                    </button>
                  </li>
                  <div className="divider my-0.5" />
                  <li>
                    <button
                      type="button"
                      className="gap-2 text-error"
                      onClick={openConfirm}
                      disabled={isReadOnly}
                    >
                      <Trash2Icon className="size-4" />
                      Delete note
                    </button>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </header>

        {/* ─── Main content ─── */}
        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto w-full max-w-3xl px-6 py-8 sm:px-8"
        >
          {isReadOnly ? (
            <div className="alert alert-info border border-info/40 bg-info/5 text-info-content mb-6">
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

          {/* ─── Title ─── */}
          <input
            type="text"
            placeholder="Untitled"
            className="w-full border-0 bg-transparent text-3xl font-extrabold leading-tight text-base-content placeholder:text-base-content/20 focus:outline-none focus:ring-0 sm:text-4xl"
            value={title}
            onChange={handleTitleChange}
            disabled={isReadOnly}
            aria-readonly={isReadOnly}
          />

          {/* ─── Properties row: tags + collaborators ─── */}
          <div className="mt-3 mb-6 flex flex-wrap items-center gap-1.5">
            {tags.map((tag) => (
              <span
                key={tag}
                className="badge badge-sm badge-outline gap-1 text-base-content/60 font-normal"
              >
                {tag}
                {!isReadOnly && (
                  <button
                    type="button"
                    className="ml-0.5 opacity-40 hover:opacity-100"
                    onClick={() =>
                      handleTagsChange(tags.filter((t) => t !== tag))
                    }
                    aria-label={`Remove tag ${tag}`}
                  >
                    <XIcon className="size-2.5" />
                  </button>
                )}
              </span>
            ))}
            {!isReadOnly && tags.length < TAG_LIMIT && (
              <InlineTagAdder
                onAdd={(tag) => handleTagsChange([...tags, tag])}
                existingTags={tags}
              />
            )}
            {participants.length > 0 && (
              <>
                <span className="mx-1 h-4 w-px bg-base-300/40" />
                <PresenceAvatars participants={participants} />
              </>
            )}
          </div>

          {/* ─── AI Tag Suggestions ─── */}
          {!isReadOnly && aiConfigured && (
            <AiTagSuggestions
              suggestions={suggestedTags}
              currentTags={tags}
              onApplyTag={(tag) => handleTagsChange([...tags, tag])}
              onDismiss={clearSuggestedTags}
              loading={aiTagsLoading}
            />
          )}

          {/* ─── AI Summary Card ─── */}
          {aiSummary && (
            <AiSummaryCard
              summary={aiSummary.summary}
              actionItems={aiSummary.actionItems}
              generatedAt={aiSummary.generatedAt}
              onToggleItem={toggleActionItem}
            />
          )}

          {/* ─── Generate Summary Button ─── */}
          {aiConfigured &&
            !aiSummary &&
            !isReadOnly &&
            contentStats.wordCount >= 150 && (
              <div className="mb-4">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm gap-2 text-violet-400 hover:bg-violet-500/10"
                  onClick={generateSummary}
                  disabled={summaryLoading}
                >
                  {summaryLoading ? (
                    <LoaderIcon className="size-3.5 animate-spin" />
                  ) : (
                    <SparklesIcon className="size-3.5" />
                  )}
                  {summaryLoading ? "Generating…" : "Generate Summary"}
                </button>
              </div>
            )}

          {/* ─── Editor (the canvas) ─── */}
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

          {typingUsers.length > 0 && (
            <div className="mt-3">
              <TypingIndicator typingUsers={typingUsers} />
            </div>
          )}
        </main>

        {/* ─── Subtle bottom status bar ─── */}
        <div className="fixed bottom-0 inset-x-0 z-20 pointer-events-none">
          <div className="mx-auto max-w-3xl px-6 sm:px-8 pb-3 flex justify-end">
            <span className="text-[11px] text-base-content/30 tabular-nums">
              {wordCount} words · {characterCount} chars
            </span>
          </div>
        </div>
      </div>

      {/* ─── History sidebar (slides in from right) ─── */}
      {showHistory && (
        <div className="fixed inset-0 z-40 flex justify-end">
          {/* Backdrop */}
          <button
            type="button"
            className="absolute inset-0 bg-black/20 backdrop-blur-[2px]"
            onClick={() => setShowHistory(false)}
            aria-label="Close history"
          />
          {/* Drawer */}
          <aside className="relative w-full max-w-sm bg-base-100 shadow-2xl border-l border-base-300/40 flex flex-col animate-slide-in-right">
            <div className="flex items-center justify-between px-5 py-4 border-b border-base-300/40">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <HistoryIcon className="size-4" />
                Change history
              </h3>
              <button
                type="button"
                className="btn btn-ghost btn-sm btn-circle"
                onClick={() => setShowHistory(false)}
                aria-label="Close history"
              >
                <XIcon className="size-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {historyQuery.isFetching && history.length === 0 ? (
                <div className="flex items-center justify-center py-10">
                  <LoaderIcon className="size-5 animate-spin" />
                </div>
              ) : history.length ? (
                <ul className="space-y-2">
                  {history.map((entry: any) => {
                    const timestamp = entry.createdAt
                      ? new Date(entry.createdAt)
                      : null;
                    return (
                      <li
                        key={entry.id}
                        className="rounded-lg border border-base-300/50 bg-base-200/40 px-3.5 py-2.5"
                      >
                        <p className="text-sm font-medium text-base-content">
                          {entry.summary ?? entry.eventType}
                        </p>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-[11px] uppercase tracking-wide text-base-content/50">
                            {entry.eventType}
                          </span>
                          <span className="text-[11px] text-base-content/50">
                            {timestamp ? formatRelativeTime(timestamp) : ""}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-base-content/50 text-center py-10">
                  No changes recorded yet.
                </p>
              )}
            </div>
          </aside>
        </div>
      )}

      {/* ─── Share / Collaborators dialog ─── */}
      <dialog
        className={`modal ${showCollaborators ? "modal-open" : ""}`}
        role="dialog"
        aria-labelledby="share-modal-title"
      >
        <div className="modal-box max-w-lg w-[32rem] rounded-2xl p-0 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-base-300/40 px-6 py-4">
            <h3
              id="share-modal-title"
              className="text-lg font-semibold text-base-content"
            >
              Share Note
            </h3>
            <button
              type="button"
              className="btn btn-ghost btn-sm btn-circle"
              onClick={() => setShowCollaborators(false)}
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          {/* Body */}
          <div className="px-6 py-5">
            {note && (
              <NoteCollaboratorsCard
                noteId={note._id}
                canManage={canManageNoteCollaborators}
                owner={
                  user ? { name: user.name, email: user.email } : undefined
                }
              />
            )}
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button type="button" onClick={() => setShowCollaborators(false)}>
            close
          </button>
        </form>
      </dialog>

      {/* ─── Delete confirmation ─── */}
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

      {/* ─── Unsaved Changes Navigation Modal ─── */}
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
