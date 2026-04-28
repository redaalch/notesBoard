export interface OfflineStatusSnapshot {
  isOnline: boolean;
  queueLength: number;
  isSyncing: boolean;
  lastSyncedAt: string | null;
  lastError: string | null;
}

export type OfflineStatusListener = (snapshot: OfflineStatusSnapshot) => void;

const STATUS_LISTENERS = new Set<OfflineStatusListener>();

interface OfflineState {
  isInitialized: boolean;
  isSyncing: boolean;
  queueLength: number;
  lastSyncedAt: string | null;
  lastError: string | null;
}

const state: OfflineState = {
  isInitialized: false,
  isSyncing: false,
  queueLength: 0,
  lastSyncedAt: null,
  lastError: null,
};

export const getOfflineState = (): OfflineState => state;

export const setIsInitialized = (value: boolean): void => {
  state.isInitialized = value;
};

export const setIsSyncing = (value: boolean): void => {
  state.isSyncing = value;
};

export const setQueueLength = (value: number): void => {
  state.queueLength = value;
};

export const setLastSyncedAt = (value: string | null): void => {
  state.lastSyncedAt = value;
};

export const setLastError = (value: string | null): void => {
  state.lastError = value;
};

const buildSnapshot = (): OfflineStatusSnapshot => ({
  isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
  queueLength: state.queueLength,
  isSyncing: state.isSyncing,
  lastSyncedAt: state.lastSyncedAt,
  lastError: state.lastError,
});

export const notifyStatus = (): void => {
  const snapshot = buildSnapshot();
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

export const subscribeOfflineStatus = (
  listener: OfflineStatusListener,
): (() => void) => {
  STATUS_LISTENERS.add(listener);
  listener(buildSnapshot());
  return () => {
    STATUS_LISTENERS.delete(listener);
  };
};
