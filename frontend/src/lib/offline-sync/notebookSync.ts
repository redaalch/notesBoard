import type { InternalAxiosRequestConfig } from "axios";
import {
  getNoteById,
  getNotebookSyncMetadata,
  setNotebookSyncMetadata,
  storeNotes,
  type NotebookSyncMetadata,
  type NotebookSyncPayload,
} from "../offlineDB";
import { fetchNotebookSyncState } from "../notebookSyncClient";
import {
  NOTE_ID_REGEX,
  generateOpId,
  normalizeNotebookId,
  normalizeTagsArray,
  normalizeUrl,
} from "./helpers";

export const buildNotebookSyncMetadata = async (
  config: InternalAxiosRequestConfig,
): Promise<NotebookSyncPayload | null> => {
  const method = (config.method ?? "get").toLowerCase();
  if (method === "get") {
    return null;
  }

  let path = "";
  try {
    path = new URL(normalizeUrl(config)).pathname;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn(
        "[offline] buildNotebookSyncMetadata path parse failed",
        error,
      );
    }
    return null;
  }

  if (!path.startsWith("/api/notes")) {
    return null;
  }

  if (method === "post" && path === "/api/notes") {
    const payload =
      config.data && typeof config.data === "object"
        ? (config.data as Record<string, unknown>)
        : {};
    const notebookId = normalizeNotebookId(payload.notebookId);
    if (!notebookId) {
      return null;
    }

    const content = typeof payload.content === "string" ? payload.content : "";
    const contentText =
      typeof payload.contentText === "string" ? payload.contentText : content;

    return {
      type: "notebook",
      notebookId,
      operations: [
        {
          type: "note.upsert",
          opId: generateOpId(),
          payload: {
            title: typeof payload.title === "string" ? payload.title : "",
            content,
            contentText,
            tags: normalizeTagsArray(payload.tags),
            pinned: Boolean(payload.pinned),
            notebookId,
          },
        },
      ],
    };
  }

  const match = path.match(NOTE_ID_REGEX);
  if (!match) {
    return null;
  }

  const noteId = match[1];
  const cachedNote = await getNoteById(noteId);
  const cachedNotebookId = normalizeNotebookId(cachedNote?.notebookId);
  if (!cachedNote || !cachedNotebookId) {
    return null;
  }

  if (method === "delete") {
    return {
      type: "notebook",
      notebookId: cachedNotebookId,
      operations: [
        {
          type: "note.delete",
          noteId,
          opId: generateOpId(),
        },
      ],
    };
  }

  if (method === "put") {
    const overrides =
      config.data && typeof config.data === "object"
        ? (config.data as Record<string, unknown>)
        : {};

    const title =
      typeof overrides.title === "string"
        ? overrides.title
        : (cachedNote.title ?? "");

    const content =
      typeof overrides.content === "string"
        ? overrides.content
        : (cachedNote.content ?? "");

    const contentText =
      typeof overrides.contentText === "string"
        ? overrides.contentText
        : (cachedNote.contentText ?? content);

    const tags = normalizeTagsArray(
      Array.isArray(overrides.tags) ? overrides.tags : cachedNote.tags,
    );

    const pinned =
      typeof overrides.pinned === "boolean"
        ? overrides.pinned
        : Boolean(cachedNote.pinned);

    return {
      type: "notebook",
      notebookId: cachedNotebookId,
      operations: [
        {
          type: "note.upsert",
          opId: generateOpId(),
          payload: {
            id: noteId,
            title,
            content,
            contentText,
            tags,
            pinned,
            notebookId: cachedNotebookId,
          },
        },
      ],
    };
  }

  return null;
};

export const ensureNotebookSyncSession = async (
  notebookId: string,
): Promise<NotebookSyncMetadata | null> => {
  const metadata: NotebookSyncMetadata = (await getNotebookSyncMetadata(
    notebookId,
  )) ?? {
    clientId: "",
    revision: 0,
    snapshotHash: null,
    lastSyncedAt: null,
  };
  let mutated = false;

  if (!metadata.clientId) {
    metadata.clientId = generateOpId();
    mutated = true;
  }

  if (metadata.revision === undefined || metadata.revision === null) {
    try {
      const state = await fetchNotebookSyncState(notebookId, {
        clientId: metadata.clientId,
        withNotes: false,
      });
      metadata.revision = state?.revision ?? 0;
      metadata.snapshotHash = state?.snapshotHash ?? null;
      metadata.lastSyncedAt = state?.serverTime ?? null;
      mutated = true;
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn("[offline] unable to prime notebook sync state", {
          notebookId,
          error,
        });
      }
      return null;
    }
  }

  if (mutated) {
    await setNotebookSyncMetadata(notebookId, metadata);
  }

  return metadata;
};

export const refreshNotebookSnapshot = async (
  notebookId: string,
  clientId: string,
): Promise<NotebookSyncMetadata | null> => {
  try {
    const state = await fetchNotebookSyncState(notebookId, {
      clientId,
      withNotes: true,
    });

    if (Array.isArray(state?.notes)) {
      await storeNotes(
        state.notes.map((note) => ({
          ...note,
          id: note.id as string,
          notebookId: (note.notebookId as string) ?? null,
          revision: (note.updatedAt ?? note.id) as string,
        })),
      );
    }

    const metadata: NotebookSyncMetadata = {
      clientId,
      revision: state?.revision ?? 0,
      snapshotHash: state?.snapshotHash ?? null,
      lastSyncedAt: state?.serverTime ?? new Date().toISOString(),
    };
    await setNotebookSyncMetadata(notebookId, metadata);
    return metadata;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn("[offline] refreshNotebookSnapshot failed", {
        notebookId,
        error,
      });
    }
    return null;
  }
};
