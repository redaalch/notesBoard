import api from "./axios.js";
import {
  cacheMutation,
  cacheResponse,
  clearDatabase,
  getCachedResponse,
  getNoteById,
  getMetadata,
  listMutations,
  removeMutation,
  setMetadata,
  getNotebookSyncMetadata,
  setNotebookSyncMetadata,
  storeNotebooks,
  storeNotes,
  updateMutation,
} from "./offlineDB.js";
import {
  fetchNotebookSyncState,
  pushNotebookSyncState,
} from "./notebookSyncClient.js";

const STATUS_LISTENERS = new Set();
let isInitialized = false;
let isSyncing = false;
let queueLength = 0;
let lastSyncedAt = null;
let lastError = null;

const PRECACHE_SHELLS = ["/app", "/create", "/profile"];

const NOTE_ID_REGEX = /\/api\/notes\/([0-9a-fA-F]{24})$/u;

const isMongoId = (value) =>
  typeof value === "string" && /^[0-9a-fA-F]{24}$/u.test(value.trim());

const generateOpId = () => {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `op-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const normalizeNotebookId = (value) => {
  if (!value) return null;
  const normalized = String(value).trim();
  if (normalized === "uncategorized" || normalized === "all") {
    return null;
  }
  return isMongoId(normalized) ? normalized : null;
};

const notifyStatus = () => {
  const snapshot = {
    isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
    queueLength,
    isSyncing,
    lastSyncedAt,
    lastError,
  };
  STATUS_LISTENERS.forEach((listener) => {
    try {
      listener(snapshot);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn("[offline] listener error", error);
      }
    }
  });
};

const normalizeUrl = (config) => {
  const baseURL =
    config.baseURL ?? api.defaults.baseURL ?? window.location.origin;
  const requestURL = config.url ?? "";
  try {
    const url = new URL(requestURL, baseURL);
    if (config.params) {
      const params = new URLSearchParams(config.params);
      params.forEach((value, key) => {
        url.searchParams.set(key, value);
      });
    }
    return url.toString();
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn("[offline] normalizeUrl failed", error);
    }
    return `${baseURL}${requestURL}`;
  }
};

const toSerializable = (value) => {
  if (value === undefined || value === null) return null;
  if (value instanceof FormData) {
    const entries = {};
    for (const [key, formValue] of value.entries()) {
      entries[key] = formValue;
    }
    return { formData: entries };
  }
  if (typeof value === "string") {
    return value;
  }
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn("[offline] value not serializable", value, error);
    }
    return value;
  }
};

const recordQueueLength = async () => {
  const mutations = await listMutations();
  queueLength = mutations.length;
  return mutations;
};

const precacheShells = () => {
  if (!("serviceWorker" in navigator)) return;
  if (!navigator.serviceWorker.controller) return;
  navigator.serviceWorker.controller.postMessage({
    type: "PRECACHE_URLS",
    payload: { urls: PRECACHE_SHELLS },
  });
};

const cacheDomainData = async (config, data) => {
  let path = "";
  try {
    path = new URL(normalizeUrl(config)).pathname;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn("[offline] failed to parse path", error);
    }
    return;
  }
  if (path.startsWith("/notebooks")) {
    if (Array.isArray(data?.notebooks)) {
      await storeNotebooks(
        data.notebooks.map((notebook) => ({
          ...notebook,
          revision: notebook.updatedAt ?? notebook.id,
        }))
      );
    } else if (data?.id) {
      await storeNotebooks([{ ...data, revision: data.updatedAt ?? data.id }]);
    }
  }
  if (path.startsWith("/notes")) {
    if (Array.isArray(data?.notes)) {
      await storeNotes(
        data.notes.map((note) => ({
          ...note,
          revision: note.updatedAt ?? note.id,
        }))
      );
    } else if (data?.id) {
      await storeNotes([{ ...data, revision: data.updatedAt ?? data.id }]);
    }
  }
};

const normalizeTagsArray = (tags) => {
  if (!Array.isArray(tags)) return [];
  return tags
    .map((tag) =>
      typeof tag === "string"
        ? tag.trim().toLowerCase().replace(/\s+/g, " ")
        : ""
    )
    .filter(Boolean);
};

const buildNotebookSyncMetadata = async (config) => {
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
        error
      );
    }
    return null;
  }

  if (!path.startsWith("/api/notes")) {
    return null;
  }

  if (method === "post" && path === "/api/notes") {
    const payload =
      config.data && typeof config.data === "object" ? config.data : {};
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
      config.data && typeof config.data === "object" ? config.data : {};

    const title =
      typeof overrides.title === "string"
        ? overrides.title
        : cachedNote.title ?? "";

    const content =
      typeof overrides.content === "string"
        ? overrides.content
        : cachedNote.content ?? "";

    const contentText =
      typeof overrides.contentText === "string"
        ? overrides.contentText
        : cachedNote.contentText ?? content;

    const tags = normalizeTagsArray(
      Array.isArray(overrides.tags) ? overrides.tags : cachedNote.tags
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

const ensureNotebookSyncSession = async (notebookId) => {
  let metadata = (await getNotebookSyncMetadata(notebookId)) ?? {};
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

const refreshNotebookSnapshot = async (notebookId, clientId) => {
  try {
    const state = await fetchNotebookSyncState(notebookId, {
      clientId,
      withNotes: true,
    });

    if (Array.isArray(state?.notes)) {
      await storeNotes(
        state.notes.map((note) => ({
          ...note,
          revision: note.updatedAt ?? note.id,
        }))
      );
    }

    const metadata = {
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

const flushQueue = async () => {
  const mutations = await recordQueueLength();
  if (!mutations.length) {
    isSyncing = false;
    lastError = null;
    const timestamp = new Date().toISOString();
    lastSyncedAt = timestamp;
    await setMetadata("lastSyncedAt", timestamp);
    notifyStatus();
    return;
  }

  if (!navigator.onLine) {
    notifyStatus();
    return;
  }

  isSyncing = true;
  notifyStatus();

  const regularMutations = [];
  const notebookMutations = new Map();

  for (const entry of mutations) {
    if (entry?.sync?.type === "notebook" && entry.sync?.notebookId) {
      const bucket = notebookMutations.get(entry.sync.notebookId) ?? {
        entries: [],
        operations: [],
      };
      const operations = Array.isArray(entry.sync.operations)
        ? entry.sync.operations.filter(Boolean)
        : [];
      if (operations.length) {
        bucket.operations.push(...operations);
      }
      bucket.entries.push(entry);
      notebookMutations.set(entry.sync.notebookId, bucket);
    } else {
      regularMutations.push(entry);
    }
  }

  let failure = false;

  for (const entry of regularMutations) {
    try {
      const requestConfig = {
        method: entry.method,
        url: entry.url,
        data: entry.data,
        headers: {
          ...entry.headers,
          "x-offline-replay": "1",
          "x-offline-revision": entry.versionStamp ?? undefined,
        },
      };
      await api.request(requestConfig);
      await removeMutation(entry.id);
      lastError = null;
    } catch (error) {
      await updateMutation(entry.id, {
        attempts: (entry.attempts ?? 0) + 1,
        lastError: error?.message ?? "Unknown error",
        lastAttemptAt: new Date().toISOString(),
      });
      lastError = error?.message ?? "Sync failed";
      failure = true;
      break;
    }
  }

  if (!failure) {
    for (const [notebookId, bucket] of notebookMutations.entries()) {
      if (!bucket.operations.length) {
        for (const entry of bucket.entries) {
          await removeMutation(entry.id);
        }
        continue;
      }

      const session = await ensureNotebookSyncSession(notebookId);
      if (!session) {
        // fallback to replaying original requests if we cannot establish sync context
        for (const entry of bucket.entries) {
          try {
            const requestConfig = {
              method: entry.method,
              url: entry.url,
              data: entry.data,
              headers: {
                ...entry.headers,
                "x-offline-replay": "1",
                "x-offline-revision": entry.versionStamp ?? undefined,
              },
            };
            await api.request(requestConfig);
            await removeMutation(entry.id);
            lastError = null;
          } catch (error) {
            await updateMutation(entry.id, {
              attempts: (entry.attempts ?? 0) + 1,
              lastError: error?.message ?? "Unknown error",
              lastAttemptAt: new Date().toISOString(),
            });
            lastError = error?.message ?? "Sync failed";
            failure = true;
            break;
          }
        }
        if (failure) {
          break;
        }
        continue;
      }

      try {
        const payload = {
          clientId: session.clientId,
          baseRevision: session.revision ?? 0,
          operations: bucket.operations,
        };

        const response = await pushNotebookSyncState(notebookId, payload);
        const nextMetadata = {
          clientId: session.clientId,
          revision: response?.revision ?? session.revision ?? 0,
          snapshotHash: response?.snapshotHash ?? session.snapshotHash ?? null,
          lastSyncedAt: response?.serverTime ?? new Date().toISOString(),
        };
        await setNotebookSyncMetadata(notebookId, nextMetadata);

        await refreshNotebookSnapshot(notebookId, session.clientId);

        for (const entry of bucket.entries) {
          await removeMutation(entry.id);
        }
        lastError = null;
      } catch (error) {
        const errorMessage =
          error?.response?.data?.message ?? error?.message ?? "Unknown error";
        const timestamp = new Date().toISOString();

        for (const entry of bucket.entries) {
          await updateMutation(entry.id, {
            attempts: (entry.attempts ?? 0) + 1,
            lastError: errorMessage,
            lastAttemptAt: timestamp,
          });
        }

        lastError = errorMessage;

        if (error?.response?.status === 409) {
          await refreshNotebookSnapshot(notebookId, session.clientId);
        }

        failure = true;
        break;
      }
    }
  }

  await recordQueueLength();
  isSyncing = false;
  if (!failure) {
    const timestamp = new Date().toISOString();
    lastSyncedAt = timestamp;
    await setMetadata("lastSyncedAt", timestamp);
  }
  notifyStatus();
};

const queueMutation = async (config) => {
  const mutation = await cacheMutation({
    method: (config.method ?? "get").toLowerCase(),
    url: normalizeUrl(config),
    data: toSerializable(config.data),
    headers: toSerializable(config.headers),
    versionStamp:
      config.headers?.["x-revision"] ??
      config.headers?.["if-match"] ??
      (typeof config.data === "object" && config.data
        ? config.data.updatedAt ?? config.data.revision ?? null
        : null),
    sync: config.offlineSync ?? null,
  });
  delete config.offlineSync;
  await recordQueueLength();
  notifyStatus();
  return mutation;
};

const handleOnline = () => {
  notifyStatus();
  flushQueue();
};

const handleOffline = () => {
  notifyStatus();
};

export const subscribeOfflineStatus = (listener) => {
  STATUS_LISTENERS.add(listener);
  listener({
    isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
    queueLength,
    isSyncing,
    lastSyncedAt,
    lastError,
  });
  return () => {
    STATUS_LISTENERS.delete(listener);
  };
};

export const triggerManualSync = async () => {
  if (!navigator.onLine) return;
  await flushQueue();
};

export const resetOfflineCache = async () => {
  await clearDatabase();
  const mutations = await recordQueueLength();
  queueLength = mutations.length;
  lastError = null;
  notifyStatus();
};

export const initializeOfflineSync = () => {
  if (isInitialized) {
    return;
  }
  isInitialized = true;

  precacheShells();

  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);

  api.interceptors.request.use(async (config) => {
    try {
      const notebookSync = await buildNotebookSyncMetadata(config);
      if (notebookSync) {
        config.offlineSync = notebookSync;
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn("[offline] failed to build notebook sync metadata", error);
      }
    }

    if (!navigator.onLine) {
      if ((config.method ?? "get").toLowerCase() !== "get") {
        const queued = await queueMutation(config);
        config.adapter = () =>
          Promise.resolve({
            data: {
              queued: true,
              mutationId: queued?.id ?? null,
              offline: true,
            },
            status: 202,
            statusText: "Accepted (offline)",
            headers: { "x-offline": "queued" },
            config,
            request: undefined,
          });
        return config;
      }

      const cached = await getCachedResponse(normalizeUrl(config));
      if (cached) {
        config.adapter = () =>
          Promise.resolve({
            data: cached.payload,
            status: 200,
            statusText: "OK (cached)",
            headers: { "x-offline": "cached" },
            config,
            request: undefined,
          });
        return config;
      }
    }

    delete config.offlineSync;

    return config;
  });

  api.interceptors.response.use(
    async (response) => {
      try {
        const { config, data } = response;
        if ((config.method ?? "get").toLowerCase() === "get") {
          await cacheResponse(normalizeUrl(config), data);
          await cacheDomainData(config, data);
        }
        if ((config.method ?? "get").toLowerCase() !== "get" && data?.id) {
          await cacheDomainData(config, data);
        }
        if (navigator.onLine) {
          queueLength = (await listMutations()).length;
          notifyStatus();
        }
      } catch (error) {
        if (import.meta.env.DEV) {
          console.warn("[offline] response caching failed", error);
        }
      }
      return response;
    },
    async (error) => {
      if (!navigator.onLine) {
        notifyStatus();
      }
      return Promise.reject(error);
    }
  );

  recordQueueLength().then(() => notifyStatus());

  getMetadata("lastSyncedAt").then((value) => {
    if (value) {
      lastSyncedAt = value;
      notifyStatus();
    }
  });
};

export const persistLastSyncedAt = async (timestamp) => {
  lastSyncedAt = timestamp;
  await setMetadata("lastSyncedAt", timestamp);
  notifyStatus();
};

// attempt a sync on load if online
if (typeof window !== "undefined") {
  if (navigator.onLine) {
    flushQueue();
  }
}
