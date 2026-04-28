import type {
  AxiosError,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios";
import api from "./axios";
import {
  cacheResponse,
  clearDatabase,
  getCachedResponse,
  getMetadata,
  listMutations,
  setMetadata,
} from "./offlineDB";
import { normalizeUrl, precacheShells } from "./offline-sync/helpers";
import { buildNotebookSyncMetadata } from "./offline-sync/notebookSync";
import {
  cacheDomainData,
  flushQueue,
  queueMutation,
  recordQueueLength,
  type OfflineAxiosConfig,
} from "./offline-sync/queue";
import {
  getOfflineState,
  notifyStatus,
  setIsInitialized,
  setLastError,
  setLastSyncedAt,
  setQueueLength,
  subscribeOfflineStatus,
} from "./offline-sync/state";

export type {
  OfflineStatusListener,
  OfflineStatusSnapshot,
} from "./offline-sync/state";

export { subscribeOfflineStatus };

export const triggerManualSync = async (): Promise<void> => {
  if (!navigator.onLine) return;
  await flushQueue();
};

export const resetOfflineCache = async (): Promise<void> => {
  await clearDatabase();
  const mutations = await recordQueueLength();
  setQueueLength(mutations.length);
  setLastError(null);
  notifyStatus();
};

export const persistLastSyncedAt = async (timestamp: string): Promise<void> => {
  setLastSyncedAt(timestamp);
  await setMetadata("lastSyncedAt", timestamp);
  notifyStatus();
};

const handleOnline = (): void => {
  notifyStatus();
  flushQueue();
};

const handleOffline = (): void => {
  notifyStatus();
};

export const initializeOfflineSync = (): void => {
  if (getOfflineState().isInitialized) {
    return;
  }
  setIsInitialized(true);

  precacheShells();

  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);

  api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
    const offlineConfig = config as OfflineAxiosConfig;

    try {
      const notebookSync = await buildNotebookSyncMetadata(config);
      if (notebookSync) {
        offlineConfig.offlineSync = notebookSync;
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn("[offline] failed to build notebook sync metadata", error);
      }
    }

    if (!navigator.onLine) {
      if ((config.method ?? "get").toLowerCase() !== "get") {
        const queued = await queueMutation(offlineConfig);
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
          } as AxiosResponse);
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
          } as AxiosResponse);
        return config;
      }
    }

    delete offlineConfig.offlineSync;

    return config;
  });

  api.interceptors.response.use(
    async (response: AxiosResponse) => {
      try {
        const { config, data } = response;
        if ((config.method ?? "get").toLowerCase() === "get") {
          await cacheResponse(normalizeUrl(config), data);
          await cacheDomainData(config, data as Record<string, unknown>);
        }
        if (
          (config.method ?? "get").toLowerCase() !== "get" &&
          (data as Record<string, unknown>)?.id
        ) {
          await cacheDomainData(config, data as Record<string, unknown>);
        }
        if (navigator.onLine) {
          setQueueLength((await listMutations()).length);
          notifyStatus();
        }
      } catch (error) {
        if (import.meta.env.DEV) {
          console.warn("[offline] response caching failed", error);
        }
      }
      return response;
    },
    async (error: AxiosError) => {
      if (!navigator.onLine) {
        notifyStatus();
      }
      return Promise.reject(error);
    },
  );

  recordQueueLength().then(() => notifyStatus());

  getMetadata<string>("lastSyncedAt").then((value) => {
    if (value) {
      setLastSyncedAt(value);
      notifyStatus();
    }
  });
};

// attempt a sync on load if online
if (typeof window !== "undefined") {
  if (navigator.onLine) {
    flushQueue();
  }
}
