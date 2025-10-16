import { openDB } from "idb";

const DB_NAME = "notesboard-offline";
const DB_VERSION = 1;

const STORE_RESPONSES = "responses";
const STORE_NOTEBOOKS = "notebooks";
const STORE_NOTES = "notes";
const STORE_MUTATIONS = "mutations";
const STORE_METADATA = "metadata";

let dbPromise;

const getDb = () => {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
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

export const cacheResponse = async (url, payload) => {
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

export const getCachedResponse = async (url) => {
  try {
    const db = await getDb();
    return await db.get(STORE_RESPONSES, url);
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn("[offlineDB] getCachedResponse failed", url, error);
    }
    return null;
  }
};

export const storeNotebooks = async (notebooks = []) => {
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

export const storeNotes = async (notes = []) => {
  if (!Array.isArray(notes) || !notes.length) return;
  try {
    const db = await getDb();
    const tx = db.transaction(STORE_NOTES, "readwrite");
    const store = tx.store;
    for (const note of notes) {
      const normalized = {
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

export const getNotesByNotebook = async (notebookId) => {
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

export const cacheMutation = async (mutation) => {
  try {
    const db = await getDb();
    const payload = {
      ...mutation,
      createdAt: new Date().toISOString(),
      attempts: mutation.attempts ?? 0,
      lastError: mutation.lastError ?? null,
    };
    const id = await db.add(STORE_MUTATIONS, payload);
    return { ...payload, id };
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn("[offlineDB] cacheMutation failed", mutation, error);
    }
    return null;
  }
};

export const listMutations = async () => {
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

export const updateMutation = async (id, updates) => {
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

export const removeMutation = async (id) => {
  try {
    const db = await getDb();
    await db.delete(STORE_MUTATIONS, id);
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn("[offlineDB] removeMutation failed", id, error);
    }
  }
};

export const setMetadata = async (key, value) => {
  try {
    const db = await getDb();
    await db.put(STORE_METADATA, value, key);
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn("[offlineDB] setMetadata failed", key, error);
    }
  }
};

export const getMetadata = async (key) => {
  try {
    const db = await getDb();
    return await db.get(STORE_METADATA, key);
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn("[offlineDB] getMetadata failed", key, error);
    }
    return null;
  }
};

export const clearDatabase = async () => {
  try {
    const db = await getDb();
    await Promise.all(
      [
        STORE_RESPONSES,
        STORE_NOTEBOOKS,
        STORE_NOTES,
        STORE_MUTATIONS,
        STORE_METADATA,
      ].map((store) => db.clear(store))
    );
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn("[offlineDB] clearDatabase failed", error);
    }
  }
};
