import { type ReactNode, useEffect, useMemo, useState } from "react";
import {
  initializeOfflineSync,
  subscribeOfflineStatus,
  triggerManualSync,
} from "../lib/offlineSyncManager";
import type { OfflineStatusSnapshot } from "../lib/offlineSyncManager";
import OfflineSyncContext from "./offlineSyncContext";

interface OfflineSyncProviderProps {
  children: ReactNode;
}

export const OfflineSyncProvider = ({ children }: OfflineSyncProviderProps) => {
  const [status, setStatus] = useState<OfflineStatusSnapshot>({
    isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
    queueLength: 0,
    isSyncing: false,
    lastSyncedAt: null,
    lastError: null,
  });

  useEffect(() => {
    initializeOfflineSync();
    const unsubscribe = subscribeOfflineStatus(setStatus);
    return () => unsubscribe();
  }, []);

  const value = useMemo(
    () => ({
      ...status,
      syncNow: triggerManualSync,
    }),
    [status],
  );

  return (
    <OfflineSyncContext.Provider value={value}>
      {children}
    </OfflineSyncContext.Provider>
  );
};
