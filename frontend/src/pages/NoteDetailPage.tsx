import {
  type ChangeEvent,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CloudIcon,
  EyeIcon,
  LoaderIcon,
  RefreshCwIcon,
  SparklesIcon,
  XIcon,
} from "lucide-react";

import api from "../lib/axios";
import { extractApiError } from "../lib/extractApiError";
import { exportNote, type ExportFormat } from "../lib/noteExport";
import { htmlToPlainText } from "../lib/lineDiff";
import type { Editor } from "@tiptap/react";
import CollaborativeEditor, {
  type CollaborativeEditorUser,
} from "../Components/CollaborativeEditor";
import PresenceAvatars from "../Components/PresenceAvatars";
import TypingIndicator from "../Components/TypingIndicator";

// ── Lazy-loaded components (behind user actions / conditional renders) ──
const ConfirmDialog = lazy(() => import("../Components/ConfirmDialog"));
const AiSummaryCard = lazy(() => import("../Components/AiSummaryCard"));
const AiTagSuggestions = lazy(() => import("../Components/AiTagSuggestions"));
const NoteHistoryDrawer = lazy(
  () => import("../Components/NoteHistoryDrawer"),
);
import { countWords, formatDate } from "../lib/Utils";
import useCollaborativeNote, {
  type NoteInput,
} from "../hooks/useCollaborativeNote";
import useAuth from "../hooks/useAuth";
import useAiFeatures from "../hooks/useAiFeatures";
import InlineTagAdder from "./note-detail/InlineTagAdder";
import UnsavedChangesModal from "./note-detail/UnsavedChangesModal";
import ShareNoteDialog from "./note-detail/ShareNoteDialog";
import NoteDetailHeader from "./note-detail/NoteDetailHeader";
import { useNoteKeyboardShortcuts } from "./note-detail/useNoteKeyboardShortcuts";
import { useNoteNavigationGuard } from "./note-detail/useNoteNavigationGuard";
import { useNoteTitleSync } from "./note-detail/useNoteTitleSync";
import { useNoteSave } from "./note-detail/useNoteSave";

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

function NoteDetailPage() {
  const { id } = useParams();
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
  const [focusMode, setFocusMode] = useState(false);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(
    null,
  );

  type TipTapEditor = {
    getText: (opts?: { blockSeparator?: string }) => string;
    getHTML?: () => string;
  };
  type NoteSnapshot = {
    title?: string;
    tags?: string[];
    pinned?: boolean;
    content?: string;
    richContent?: NoteInput["richContent"];
  };
  const editorRef = useRef<TipTapEditor | null>(null);
  const originalSnapshotRef = useRef<NoteSnapshot | null>(null);
  const skipInitialUpdateRef = useRef(true);
  const allowNavigationRef = useRef(false);
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

  const { provider, doc, participants, typingUsers, color, signalTyping } =
    useCollaborativeNote(id ?? null, note, canEditNote);

  const { applySharedTitle } = useNoteTitleSync({
    doc,
    noteTitle: note?.title,
    setTitle,
  });

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

  const handleEditorReady = useCallback((editor: Editor) => {
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

  const { handleSave, handleRevert, handleRestoreVersion, handleSaveRef } =
    useNoteSave({
      id,
      title,
      tags,
      pinned,
      hasChanges,
      saving,
      isReadOnly,
      canEditNote,
      doc,
      note,
      queryClient,
      applySharedTitle,
      editorRef,
      originalSnapshotRef,
      justSavedRef,
      aiConfigured,
      suggestedTagsLength: suggestedTags.length,
      requestTagSuggestions,
      setSaving,
      setTitle,
      setTags,
      setPinned,
      setHasChanges,
      setLastSavedAt,
      setContentStats,
    });

  const handleExport = useCallback(
    (format: ExportFormat) => {
      if (!note) return;
      const html =
        editorRef.current?.getHTML?.() ??
        (note.content as string | undefined) ??
        "";
      try {
        exportNote(
          {
            title,
            content: html,
            tags,
            createdAt: note.createdAt ?? null,
            updatedAt: note.updatedAt ?? null,
          },
          format,
        );
        toast.success(
          format === "pdf"
            ? "Opening print dialog — choose 'Save as PDF'"
            : `Exported as ${format.toUpperCase()}`,
        );
      } catch (error: unknown) {
        toast.error(
          error instanceof Error ? error.message : "Failed to export note",
        );
      }
    },
    [note, title, tags],
  );

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
    } catch (error: unknown) {
      toast.error(extractApiError(error, "Failed to update pin status"));
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
      queryClient.removeQueries({ queryKey: ["notebooks"] });
      queryClient.removeQueries({ queryKey: ["notes"] });
      queryClient.removeQueries({ queryKey: ["tag-stats"] });
      window.location.href = "/app";
    } catch (error) {
      if (import.meta.env.DEV) console.error("Failed to delete note", error);
      toast.error("Failed to delete note");
    } finally {
      setDeleting(false);
      setConfirmOpen(false);
    }
  }, [canEditNote, id, queryClient]);

  useNoteKeyboardShortcuts({
    canEditNote,
    hasChanges,
    saving,
    focusMode,
    onSave: () => void handleSave(),
    setFocusMode,
  });

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

  useNoteNavigationGuard({
    hasChanges,
    allowNavigationRef,
    handleSaveRef,
  });

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

  return (
    <>
      <div
        className={`min-h-screen bg-base-100 ${focusMode ? "note-focus-mode" : ""}`}
      >
        <NoteDetailHeader
          statusBadge={statusBadge}
          saving={saving}
          pinned={pinned}
          pinning={pinning}
          isReadOnly={isReadOnly}
          disableSave={disableSave}
          disableRevert={disableRevert}
          focusMode={focusMode}
          shortcutLabel={shortcutLabel}
          lastSavedTooltip={lastSavedTooltip}
          participants={participants}
          onSave={() => handleSave()}
          onTogglePinned={handleTogglePinned}
          onRevert={handleRevert}
          onShowHistory={() => setShowHistory(true)}
          onShowCollaborators={() => setShowCollaborators(true)}
          onToggleFocusMode={() => setFocusMode((prev) => !prev)}
          onExitFocusMode={() => setFocusMode(false)}
          onExport={handleExport}
          onOpenDeleteConfirm={openConfirm}
        />

        <main
          id="main-content"
          tabIndex={-1}
          className={`mx-auto w-full px-4 py-6 sm:px-8 sm:py-8 ${focusMode ? "max-w-2xl pt-16 sm:pt-20" : "max-w-3xl"}`}
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

          <input
            type="text"
            placeholder="Untitled"
            className="w-full border-0 bg-transparent text-xl sm:text-3xl lg:text-4xl font-extrabold leading-tight text-base-content placeholder:text-base-content/20 focus:outline-none focus:ring-0"
            value={title}
            onChange={handleTitleChange}
            disabled={isReadOnly}
            aria-readonly={isReadOnly}
          />

          <div
            className={`mt-2 mb-3 sm:mt-3 sm:mb-6 flex flex-wrap items-center gap-1.5 ${focusMode ? "hidden" : ""}`}
          >
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

          {!isReadOnly && aiConfigured && !focusMode && (
            <Suspense fallback={null}>
              <AiTagSuggestions
                suggestions={suggestedTags}
                currentTags={tags}
                onApplyTag={(tag) => handleTagsChange([...tags, tag])}
                onDismiss={clearSuggestedTags}
                loading={aiTagsLoading}
              />
            </Suspense>
          )}

          {aiSummary && !focusMode && (
            <Suspense fallback={null}>
              <AiSummaryCard
                summary={aiSummary.summary}
                actionItems={aiSummary.actionItems}
                generatedAt={aiSummary.generatedAt}
                onToggleItem={toggleActionItem}
              />
            </Suspense>
          )}

          {aiConfigured &&
            !aiSummary &&
            !isReadOnly &&
            !focusMode &&
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

        {!focusMode && (
          <div className="fixed bottom-0 inset-x-0 z-20 pointer-events-none pb-[env(safe-area-inset-bottom)]">
            <div className="mx-auto max-w-3xl px-6 sm:px-8 pb-3 flex justify-end">
              <span className="text-[11px] text-base-content/30 tabular-nums">
                {wordCount} words · {characterCount} chars
              </span>
            </div>
          </div>
        )}
      </div>

      {showHistory && (
        <Suspense fallback={null}>
          <NoteHistoryDrawer
            open={showHistory}
            onClose={() => setShowHistory(false)}
            history={history}
            loading={historyQuery.isFetching}
            currentTitle={title}
            currentContent={htmlToPlainText(
              editorRef.current?.getHTML?.() ?? note?.content ?? "",
            )}
            canRestore={canEditNote}
            onRestore={handleRestoreVersion}
          />
        </Suspense>
      )}

      <ShareNoteDialog
        open={showCollaborators}
        noteId={note?._id}
        canManage={canManageNoteCollaborators}
        ownerName={user?.name}
        ownerEmail={user?.email}
        onClose={() => setShowCollaborators(false)}
      />

      <Suspense fallback={null}>
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
      </Suspense>

      <UnsavedChangesModal
        open={showUnsavedModal}
        saving={saving}
        onCancel={handleCancelNavigation}
        onLeave={handleConfirmNavigation}
        onSaveAndLeave={handleSaveAndNavigate}
      />
    </>
  );
}

export default NoteDetailPage;
