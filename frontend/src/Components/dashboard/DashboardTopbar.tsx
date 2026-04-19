import { useNavigate } from "react-router-dom";
import { useIsFetching } from "@tanstack/react-query";
import { SearchIcon, PlusIcon, SettingsIcon } from "lucide-react";
import { useCommandPalette } from "../../contexts/CommandPaletteContext";
import { useDashboardShell } from "./DashboardShell";

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

  return (
    <div className="ds-topbar">
      <div className="ds-crumbs">
        <span>workspace</span>
        <span className="ds-sep">/</span>
        <span className="ds-here">{here}</span>
      </div>
      <div className="ds-tb-status">
        <span className={`ds-live${fetching ? " syncing" : ""}`} />
        <span>{fetching ? "syncing…" : `synced · ${relativeSeconds(lastSynced)}`}</span>
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
