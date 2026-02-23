import { openDB, type IDBPDatabase, type DBSchema } from "idb";

// ── IndexedDB Schema ─────────────────────────────────────────

interface NotesboardDB extends DBSchema {
  responses: {
    key: string;
    value: { url: string; payload: unknown; updatedAt: string };
    indexes: { updatedAt: string };
  };
  notebooks: {
    key: string;
    value: CachedNotebook;
    indexes: { updatedAt: string };
  };
  notes: {
    key: string;
    value: CachedNote;
    indexes: { notebookId: string; updatedAt: string };
  };
  mutations: {
    key: number;
    value: OfflineMutation;
  };
  metadata: {
    key: string;
    value: unknown;
  };
}

export interface CachedNotebook {
  id: string;
  cachedAt?: string;
  [key: string]: unknown;
}

export interface CachedNote {
  id: string;
  notebookId: string | null;
  cachedAt?: string;
  title?: string;
  content?: string;
  contentText?: string;
  tags?: string[];
  pinned?: boolean;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface OfflineMutation {
  id?: number;
  method: string;
  url: string;
  data: unknown;
  headers: Record<string, string>;
  versionStamp: string | null;
  sync: NotebookSyncPayload | null;
  createdAt: string;
  attempts: number;
  lastError: string | null;
  lastAttemptAt?: string;
}

export interface NotebookSyncPayload {
  type: "notebook";
  notebookId: string;
  operations: SyncOperation[];
}

export interface SyncOperation {
  type: "note.upsert" | "note.delete";
  opId: string;
  noteId?: string;
  payload?: {
    id?: string;
    title: string;
    content: string;
    contentText: string;
    tags: string[];
    pinned: boolean;
    notebookId: string;
  };
}

// ── Database access ──────────────────────────────────────────

const DB_NAME = "notesboard-offline";
const DB_VERSION = 1;

const STORE_RESPONSES = "responses" as const;
const STORE_NOTEBOOKS = "notebooks" as const;
const STORE_NOTES = "notes" as const;
const STORE_MUTATIONS = "mutations" as const;
const STORE_METADATA = "metadata" as const;

const notebookSyncKey = (notebookId: string): string =>
  `notebook-sync:${notebookId}`;

let dbPromise: Promise<IDBPDatabase<NotesboardDB>> | null = null;

const getDb = (): Promise<IDBPDatabase<NotesboardDB>> => {
  if (!dbPromise) {
    dbPromise = openDB<NotesboardDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_RESPONSES)) {
          const responses = db.createObjectStore(STORE_RESPONSES, {
            keyPath: "url",
          });
          responses.createIndex("updatedAt", "updatedAt");
        }
        if (!db.objectStoreNames.contains(STORE_NOTEBOOKS)) {
          const notebooks = db.createObjectStore(STORE_NOTEBOOKS, {
            keyPath: "id",
          });
          notebooks.createIndex("updatedAt", "updatedAt");
        }
        if (!db.objectStoreNames.contains(STORE_NOTES)) {
          const notes = db.createObjectStore(STORE_NOTES, {
            keyPath: "id",
          });
          notes.createIndex("notebookId", "notebookId", { unique: false });
          notes.createIndex("updatedAt", "updatedAt");
        }
        if (!db.objectStoreNames.contains(STORE_MUTATIONS)) {
          db.createObjectStore(STORE_MUTATIONS, {
            keyPath: "id",
            autoIncrement: true,
          });
        }
        if (!db.objectStoreNames.contains(STORE_METADATA)) {
          db.createObjectStore(STORE_METADATA);
        }
      },
    });
  }
  return dbPromise;
};

// ── Response cache ───────────────────────────────────────────

export const cacheResponse = async (
  url: string,
  payload: unknown,
): Promise<void> => {
  try {
    const db = await getDb();
    await db.put(STORE_RESPONSES, {
      url,
      payload,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn("[offlineDB] cacheResponse failed", url, error);
    }
  }
};

export const getCachedResponse = async (
  url: string,
): Promise<
  { url: string; payload: unknown; updatedAt: string } | undefined
> => {
  try {
    const db = await getDb();
    return await db.get(STORE_RESPONSES, url);
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn("[offlineDB] getCachedResponse failed", url, error);
    }
    return undefined;
  }
};

// ── Notebook store ───────────────────────────────────────────

export const storeNotebooks = async (
  notebooks: CachedNotebook[] = [],
): Promise<void> => {
  if (!Array.isArray(notebooks) || !notebooks.length) return;
  try {
    const db = await getDb();
    const tx = db.transaction(STORE_NOTEBOOKS, "readwrite");
    const store = tx.store;
    for (const notebook of notebooks) {
      store.put({ ...notebook, cachedAt: new Date().toISOString() });
    }
    await tx.done;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn("[offlineDB] storeNotebooks failed", error);
    }
  }
};

// ── Notes store ──────────────────────────────────────────────

export const storeNotes = async (notes: CachedNote[] = []): Promise<void> => {
  if (!Array.isArray(notes) || !notes.length) return;
  try {
    const db = await getDb();
    const tx = db.transaction(STORE_NOTES, "readwrite");
    const store = tx.store;
    for (const note of notes) {
      const normalized: CachedNote = {
        ...note,
        notebookId: note.notebookId ?? null,
        cachedAt: new Date().toISOString(),
      };
      store.put(normalized);
    }
    await tx.done;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn("[offlineDB] storeNotes failed", error);
    }
  }
};

export const getNoteById = async (
  id: string,
): Promise<CachedNote | undefined> => {
  if (!id) return undefined;
  try {
    const db = await getDb();
    return await db.get(STORE_NOTES, id);
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn("[offlineDB] getNoteById failed", id, error);
    }
    return undefined;
  }
};

export const getNotesByNotebook = async (
  notebookId: string | null,
): Promise<CachedNote[]> => {
  try {
    const db = await getDb();
    const index = db.transaction(STORE_NOTES).store.index("notebookId");
    return await index.getAll(notebookId ?? null);
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn("[offlineDB] getNotesByNotebook failed", error);
    }
    return [];
  }
};

// ── Mutation queue ───────────────────────────────────────────

export const cacheMutation = async (
  mutation: Omit<
    OfflineMutation,
    "id" | "createdAt" | "attempts" | "lastError"
  > &
    Partial<Pick<OfflineMutation, "attempts" | "lastError">>,
): Promise<OfflineMutation | null> => {
  try {
    const db = await getDb();
    const payload: OfflineMutation = {
      ...mutation,
      createdAt: new Date().toISOString(),
      attempts: mutation.attempts ?? 0,
      lastError: mutation.lastError ?? null,
    };
    const id = await db.add(STORE_MUTATIONS, payload as OfflineMutation);
    return { ...payload, id: id as number };
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn("[offlineDB] cacheMutation failed", mutation, error);
    }
    return null;
  }
};

export const listMutations = async (): Promise<OfflineMutation[]> => {
  try {
    const db = await getDb();
    return await db.getAll(STORE_MUTATIONS);
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn("[offlineDB] listMutations failed", error);
    }
    return [];
  }
};

export const updateMutation = async (
  id: number,
  updates: Partial<OfflineMutation>,
): Promise<void> => {
  try {
    const db = await getDb();
    const tx = db.transaction(STORE_MUTATIONS, "readwrite");
    const existing = await tx.store.get(id);
    if (!existing) return;
    await tx.store.put({ ...existing, ...updates, id });
    await tx.done;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn("[offlineDB] updateMutation failed", id, error);
    }
  }
};

export const removeMutation = async (id: number): Promise<void> => {
  try {
    const db = await getDb();
    await db.delete(STORE_MUTATIONS, id);
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn("[offlineDB] removeMutation failed", id, error);
    }
  }
};

// ── Metadata ─────────────────────────────────────────────────

export const setMetadata = async (
  key: string,
  value: unknown,
): Promise<void> => {
  try {
    const db = await getDb();
    await db.put(STORE_METADATA, value, key);
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn("[offlineDB] setMetadata failed", key, error);
    }
  }
};

export const getMetadata = async <T = unknown>(
  key: string,
): Promise<T | undefined> => {
  try {
    const db = await getDb();
    return (await db.get(STORE_METADATA, key)) as T | undefined;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn("[offlineDB] getMetadata failed", key, error);
    }
    return undefined;
  }
};

export const clearDatabase = async (): Promise<void> => {
  try {
    const db = await getDb();
    await Promise.all(
      (
        [
          STORE_RESPONSES,
          STORE_NOTEBOOKS,
          STORE_NOTES,
          STORE_MUTATIONS,
          STORE_METADATA,
        ] as const
      ).map((store) => db.clear(store)),
    );
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn("[offlineDB] clearDatabase failed", error);
    }
  }
};

// ── Notebook sync metadata helpers ───────────────────────────

export interface NotebookSyncMetadata {
  clientId: string;
  revision: number;
  snapshotHash: string | null;
  lastSyncedAt: string | null;
}

export const getNotebookSyncMetadata = async (
  notebookId: string,
): Promise<NotebookSyncMetadata | undefined> => {
  if (!notebookId) return undefined;
  return getMetadata<NotebookSyncMetadata>(notebookSyncKey(notebookId));
};

export const setNotebookSyncMetadata = async (
  notebookId: string,
  value: NotebookSyncMetadata,
): Promise<void> => {
  if (!notebookId) return;
  await setMetadata(notebookSyncKey(notebookId), value);
};
