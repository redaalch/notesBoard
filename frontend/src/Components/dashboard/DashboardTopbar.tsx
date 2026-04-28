import { useNavigate } from "react-router-dom";
import { useIsFetching } from "@tanstack/react-query";
import {
  SearchIcon,
  PlusIcon,
  SettingsIcon,
  CloudOffIcon,
  RefreshCwIcon,
  AlertTriangleIcon,
} from "lucide-react";
import { useCommandPalette } from "../../contexts/CommandPaletteContext";
import { useDashboardShell } from "./DashboardShell";
import useOfflineSync from "../../hooks/useOfflineSync";

const relativeSeconds = (date: Date | null): string => {
  if (!date) return "idle";
  const diff = Math.max(1, Math.floor((Date.now() - date.getTime()) / 1000));
  if (diff < 60) return `${diff}s ago`;
  const mins = Math.floor(diff / 60);
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
};

interface DashboardTopbarProps {
  lastSynced: Date | null;
  here?: string;
}

export default function DashboardTopbar({
  lastSynced,
  here = "dashboard",
}: DashboardTopbarProps) {
  const navigate = useNavigate();
  const { openPalette } = useCommandPalette();
  const { toggleTweaks } = useDashboardShell();
  const fetching = useIsFetching() > 0;
  const offline = useOfflineSync();

  const effectiveLastSynced = offline.lastSyncedAt
    ? new Date(offline.lastSyncedAt)
    : lastSynced;

  let statusTone = "";
  let StatusIcon: typeof CloudOffIcon | null = null;
  let statusLabel = fetching
    ? "syncing…"
    : `synced · ${relativeSeconds(effectiveLastSynced)}`;

  if (!offline.isOnline) {
    statusTone = " offline";
    StatusIcon = CloudOffIcon;
    statusLabel =
      offline.queueLength > 0
        ? `offline · ${offline.queueLength} queued`
        : "offline";
  } else if (offline.isSyncing) {
    statusTone = " syncing";
    StatusIcon = RefreshCwIcon;
    statusLabel =
      offline.queueLength > 0
        ? `syncing · ${offline.queueLength} left`
        : "syncing…";
  } else if (offline.lastError) {
    statusTone = " error";
    StatusIcon = AlertTriangleIcon;
    statusLabel = "sync failed";
  } else if (offline.queueLength > 0) {
    statusTone = " pending";
    StatusIcon = RefreshCwIcon;
    statusLabel = `${offline.queueLength} pending`;
  } else if (fetching) {
    statusTone = " syncing";
  }

  const showRetry =
    offline.isOnline &&
    !offline.isSyncing &&
    (offline.lastError !== null || offline.queueLength > 0);

  return (
    <div className="ds-topbar">
      <div className="ds-crumbs">
        <span>workspace</span>
        <span className="ds-sep">/</span>
        <span className="ds-here">{here}</span>
      </div>
      <div
        className={`ds-tb-status${statusTone}`}
        title={
          offline.lastError ??
          (effectiveLastSynced
            ? `Last synced ${relativeSeconds(effectiveLastSynced)}`
            : "Not yet synced")
        }
      >
        {StatusIcon ? (
          <StatusIcon
            size={11}
            className={offline.isSyncing ? "ds-spin" : undefined}
            aria-hidden
          />
        ) : (
          <span className={`ds-live${fetching ? " syncing" : ""}`} />
        )}
        <span>{statusLabel}</span>
        {showRetry && (
          <button
            type="button"
            className="ds-tb-retry"
            onClick={() => {
              void offline.syncNow();
            }}
            aria-label="Retry sync"
          >
            retry
          </button>
        )}
      </div>
      <div className="ds-spacer" />
      <button type="button" className="ds-tb-btn" onClick={openPalette}>
        <SearchIcon size={12} />
        <span>Jump to…</span>
        <span className="ds-kbd" style={{ marginLeft: 6 }}>
          <kbd>⌘</kbd>
          <kbd>K</kbd>
        </span>
      </button>
      <button
        type="button"
        className="ds-tb-btn primary"
        onClick={() => navigate("/create")}
      >
        <PlusIcon size={12} />
        New note
        <span className="ds-kbd" style={{ marginLeft: 6 }}>
          <kbd>N</kbd>
        </span>
      </button>
      <button type="button" className="ds-tb-btn" onClick={toggleTweaks}>
        <SettingsIcon size={12} />
        Tweaks
      </button>
    </div>
  );
}
