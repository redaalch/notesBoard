import api from "./axios.js";
import {
  cacheMutation,
  cacheResponse,
  clearDatabase,
  getCachedResponse,
  getMetadata,
  listMutations,
  removeMutation,
  setMetadata,
  storeNotebooks,
  storeNotes,
  updateMutation,
} from "./offlineDB.js";

const STATUS_LISTENERS = new Set();
let isInitialized = false;
let isSyncing = false;
let queueLength = 0;
let lastSyncedAt = null;
let lastError = null;

const PRECACHE_SHELLS = ["/app", "/create", "/profile"];

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

  for (const entry of mutations) {
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
      queueLength -= 1;
      lastError = null;
    } catch (error) {
      await updateMutation(entry.id, {
        attempts: (entry.attempts ?? 0) + 1,
        lastError: error?.message ?? "Unknown error",
        lastAttemptAt: new Date().toISOString(),
      });
      lastError = error?.message ?? "Sync failed";
      break;
    }
  }

  await recordQueueLength();
  isSyncing = false;
  const timestamp = new Date().toISOString();
  lastSyncedAt = timestamp;
  await setMetadata("lastSyncedAt", timestamp);
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
  });
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
