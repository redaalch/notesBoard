import { useCallback, useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { toast } from "sonner";
import * as Y from "yjs";
import { TiptapTransformer } from "@hocuspocus/transformer";
import type { QueryClient } from "@tanstack/react-query";
import api from "../../lib/axios";
import { extractApiError } from "../../lib/extractApiError";
import { countWords } from "../../lib/Utils";
import { buildInitialNode, type NoteInput } from "../../hooks/useCollaborativeNote";

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

interface ContentStats {
  wordCount: number;
  characterCount: number;
}

const computeStats = (text: string): ContentStats => ({
  wordCount: countWords(text ?? ""),
  characterCount: text?.length ?? 0,
});

interface UseNoteSaveArgs {
  id: string | undefined;
  title: string;
  tags: string[];
  pinned: boolean;
  hasChanges: boolean;
  saving: boolean;
  isReadOnly: boolean;
  canEditNote: boolean;
  doc: Y.Doc | null | undefined;
  note: NoteSnapshot | null | undefined;
  queryClient: QueryClient;
  applySharedTitle: (value: string) => void;
  editorRef: MutableRefObject<TipTapEditor | null>;
  originalSnapshotRef: MutableRefObject<NoteSnapshot | null>;
  justSavedRef: MutableRefObject<boolean>;
  aiConfigured: boolean;
  suggestedTagsLength: number;
  requestTagSuggestions: () => void;
  setSaving: Dispatch<SetStateAction<boolean>>;
  setTitle: Dispatch<SetStateAction<string>>;
  setTags: Dispatch<SetStateAction<string[]>>;
  setPinned: Dispatch<SetStateAction<boolean>>;
  setHasChanges: Dispatch<SetStateAction<boolean>>;
  setLastSavedAt: Dispatch<SetStateAction<Date | null>>;
  setContentStats: Dispatch<SetStateAction<ContentStats>>;
}

interface RestoreEntry {
  titleSnapshot?: string | null;
  contentSnapshot?: string | null;
  tagsSnapshot?: string[] | null;
}

interface UseNoteSaveResult {
  handleSave: (silent?: boolean) => Promise<void>;
  handleRevert: () => void;
  handleRestoreVersion: (entry: RestoreEntry) => void;
  handleSaveRef: MutableRefObject<(silent?: boolean) => Promise<void>>;
}

export function useNoteSave({
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
  suggestedTagsLength,
  requestTagSuggestions,
  setSaving,
  setTitle,
  setTags,
  setPinned,
  setHasChanges,
  setLastSavedAt,
  setContentStats,
}: UseNoteSaveArgs): UseNoteSaveResult {
  const handleSaveRef = useRef<(silent?: boolean) => Promise<void>>(
    async () => {},
  );
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        : (snapshot?.richContent ?? buildInitialNode(snapshot ?? note ?? null));
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
          justSavedRef.current = true;
          setTimeout(() => {
            justSavedRef.current = false;
          }, 1500);

          if (aiConfigured && suggestedTagsLength === 0) {
            requestTagSuggestions();
          }
        } else {
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
      } catch (error: unknown) {
        toast.error(
          extractApiError(error, "Failed to update note. Please retry."),
        );
      } finally {
        setSaving(false);
      }
    },
    [
      aiConfigured,
      applySharedTitle,
      canEditNote,
      doc,
      editorRef,
      id,
      justSavedRef,
      note,
      originalSnapshotRef,
      pinned,
      queryClient,
      requestTagSuggestions,
      setHasChanges,
      setLastSavedAt,
      setPinned,
      setSaving,
      setTags,
      setTitle,
      suggestedTagsLength,
      tags,
      title,
    ],
  );

  useEffect(() => {
    handleSaveRef.current = handleSave;
  }, [handleSave]);

  useEffect(() => {
    if (!hasChanges || saving || isReadOnly) return;
    autoSaveTimerRef.current = setTimeout(() => {
      void handleSaveRef.current(true);
    }, 3000);
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
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
  }, [
    applySharedTitle,
    canEditNote,
    doc,
    editorRef,
    originalSnapshotRef,
    setContentStats,
    setHasChanges,
    setPinned,
    setTags,
    setTitle,
  ]);

  const handleRestoreVersion = useCallback(
    (entry: RestoreEntry) => {
      if (!canEditNote) {
        toast.error("You have view-only access to this note.");
        return;
      }
      if (entry.contentSnapshot == null) {
        toast.error("This version has no content snapshot.");
        return;
      }
      const nextTitle = entry.titleSnapshot ?? title;
      setTitle(nextTitle);
      applySharedTitle(nextTitle);
      if (Array.isArray(entry.tagsSnapshot)) {
        setTags([...entry.tagsSnapshot]);
      }
      if (doc) {
        const fragment = doc.getXmlFragment("default");
        fragment.delete(0, fragment.length);
        const node = buildInitialNode({
          content: entry.contentSnapshot ?? "",
        });
        if (node) {
          const seedDoc = TiptapTransformer.toYdoc(node, "default");
          const update = Y.encodeStateAsUpdate(seedDoc);
          Y.applyUpdate(doc, update);
        }
      }
      setHasChanges(true);
      toast.success("Version restored — save to confirm");
    },
    [
      applySharedTitle,
      canEditNote,
      doc,
      setHasChanges,
      setTags,
      setTitle,
      title,
    ],
  );

  return { handleSave, handleRevert, handleRestoreVersion, handleSaveRef };
}
