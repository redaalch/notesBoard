import { createContext } from "react";

const OfflineSyncContext = createContext({
  isOnline: true,
  queueLength: 0,
  isSyncing: false,
  lastSyncedAt: null,
  lastError: null,
  syncNow: () => {},
});

export default OfflineSyncContext;
