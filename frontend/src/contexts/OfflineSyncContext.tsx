import { type ReactNode, useEffect, useMemo, useState } from "react";
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
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    void import("../lib/offlineSyncManager").then((mod) => {
      if (cancelled) return;
      mod.initializeOfflineSync();
      unsubscribe = mod.subscribeOfflineStatus(setStatus);
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  const value = useMemo(
    () => ({
      ...status,
      syncNow: async () => {
        const mod = await import("../lib/offlineSyncManager");
        await mod.triggerManualSync();
      },
    }),
    [status],
  );

  return (
    <OfflineSyncContext.Provider value={value}>
      {children}
    </OfflineSyncContext.Provider>
  );
};
