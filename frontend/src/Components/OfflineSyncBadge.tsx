import { useEffect, useState } from "react";
import {
  CloudOffIcon,
  RefreshCwIcon,
  AlertTriangleIcon,
  CloudIcon,
} from "lucide-react";
import useOfflineSync from "../hooks/useOfflineSync";
import { formatRelativeTime } from "../lib/Utils";

interface OfflineSyncBadgeProps {
  className?: string;
  hideWhenIdle?: boolean;
}

type BadgeTone = "offline" | "syncing" | "pending" | "error" | "synced";

interface BadgeContent {
  tone: BadgeTone;
  label: string;
  icon: typeof CloudOffIcon;
  detail: string;
}

const TONE_CLASSES: Record<BadgeTone, string> = {
  offline: "border-error/40 bg-error/10 text-error",
  syncing: "border-warning/40 bg-warning/10 text-warning",
  pending: "border-warning/40 bg-warning/10 text-warning",
  error: "border-error/40 bg-error/10 text-error",
  synced: "border-success/40 bg-success/10 text-success",
};

function OfflineSyncBadge({
  className = "",
  hideWhenIdle = true,
}: OfflineSyncBadgeProps) {
  const { isOnline, queueLength, isSyncing, lastSyncedAt, lastError, syncNow } =
    useOfflineSync();
  const [retrying, setRetrying] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!lastSyncedAt) return undefined;
    const interval = window.setInterval(() => setTick((n) => n + 1), 30_000);
    return () => window.clearInterval(interval);
  }, [lastSyncedAt]);

  const handleRetry = async () => {
    if (retrying) return;
    setRetrying(true);
    try {
      await syncNow();
    } finally {
      setRetrying(false);
    }
  };

  const lastSyncedLabel = lastSyncedAt
    ? `Last synced ${formatRelativeTime(lastSyncedAt)}`
    : "Never synced";
  // tick keeps the "X minutes ago" label fresh without a full re-render tree
  void tick;

  const content = resolveContent({
    isOnline,
    queueLength,
    isSyncing,
    lastError,
    lastSyncedLabel,
  });

  if (!content) {
    return null;
  }

  if (content.tone === "synced" && hideWhenIdle) {
    return null;
  }

  const Icon = content.icon;
  const showRetry =
    (content.tone === "pending" || content.tone === "error") && isOnline;

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${TONE_CLASSES[content.tone]} ${className}`}
      title={`${content.label} · ${content.detail}`}
      role="status"
      aria-live="polite"
    >
      <Icon
        className={`size-3.5 ${content.tone === "syncing" ? "animate-spin" : ""}`}
        aria-hidden
      />
      <span className="whitespace-nowrap">{content.label}</span>
      {showRetry && (
        <button
          type="button"
          onClick={handleRetry}
          disabled={retrying}
          className="ml-1 inline-flex items-center gap-1 rounded-full border border-current/40 bg-transparent px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide transition hover:bg-current/10 disabled:opacity-50"
          aria-label="Retry sync"
        >
          <RefreshCwIcon
            className={`size-2.5 ${retrying ? "animate-spin" : ""}`}
            aria-hidden
          />
          Retry
        </button>
      )}
    </div>
  );
}

interface ResolveContentArgs {
  isOnline: boolean;
  queueLength: number;
  isSyncing: boolean;
  lastError: string | null;
  lastSyncedLabel: string;
}

function resolveContent({
  isOnline,
  queueLength,
  isSyncing,
  lastError,
  lastSyncedLabel,
}: ResolveContentArgs): BadgeContent | null {
  if (!isOnline) {
    const label =
      queueLength > 0
        ? `Offline · ${queueLength} queued`
        : "Offline";
    return {
      tone: "offline",
      label,
      icon: CloudOffIcon,
      detail: lastSyncedLabel,
    };
  }

  if (isSyncing) {
    const label =
      queueLength > 0 ? `Syncing · ${queueLength} left` : "Syncing…";
    return {
      tone: "syncing",
      label,
      icon: RefreshCwIcon,
      detail: lastSyncedLabel,
    };
  }

  if (lastError) {
    return {
      tone: "error",
      label: "Sync failed",
      icon: AlertTriangleIcon,
      detail: lastError,
    };
  }

  if (queueLength > 0) {
    return {
      tone: "pending",
      label: `${queueLength} pending`,
      icon: RefreshCwIcon,
      detail: lastSyncedLabel,
    };
  }

  return {
    tone: "synced",
    label: "Synced",
    icon: CloudIcon,
    detail: lastSyncedLabel,
  };
}

export default OfflineSyncBadge;
