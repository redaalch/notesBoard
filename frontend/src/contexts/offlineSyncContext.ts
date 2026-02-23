import { createContext } from "react";
import type { OfflineStatusSnapshot } from "../lib/offlineSyncManager";

export interface OfflineSyncContextValue extends OfflineStatusSnapshot {
  syncNow: () => Promise<void>;
}

const OfflineSyncContext = createContext<OfflineSyncContextValue>({
  isOnline: true,
  queueLength: 0,
  isSyncing: false,
  lastSyncedAt: null,
  lastError: null,
  syncNow: async () => {},
});

export default OfflineSyncContext;
