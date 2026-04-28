import { Link } from "react-router-dom";
import {
  ArrowLeftIcon,
  DownloadIcon,
  FileCodeIcon,
  FileTextIcon,
  HistoryIcon,
  MaximizeIcon,
  MinimizeIcon,
  MoreVerticalIcon,
  PinIcon,
  PinOffIcon,
  PrinterIcon,
  SaveIcon,
  Share2Icon,
  Trash2Icon,
  UndoIcon,
} from "lucide-react";
import PresenceAvatars from "../../Components/PresenceAvatars";
import type { ExportFormat } from "../../lib/noteExport";

interface StatusBadge {
  className: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}

interface NoteDetailHeaderProps {
  statusBadge: StatusBadge;
  saving: boolean;
  pinned: boolean;
  pinning: boolean;
  isReadOnly: boolean;
  disableSave: boolean;
  disableRevert: boolean;
  focusMode: boolean;
  shortcutLabel: string;
  lastSavedTooltip: string | null;
  participants: React.ComponentProps<typeof PresenceAvatars>["participants"];
  onSave: () => void;
  onTogglePinned: () => void;
  onRevert: () => void;
  onShowHistory: () => void;
  onShowCollaborators: () => void;
  onToggleFocusMode: () => void;
  onExitFocusMode: () => void;
  onExport: (format: ExportFormat) => void;
  onOpenDeleteConfirm: () => void;
}

function NoteDetailHeader({
  statusBadge,
  saving,
  pinned,
  pinning,
  isReadOnly,
  disableSave,
  disableRevert,
  focusMode,
  shortcutLabel,
  lastSavedTooltip,
  participants,
  onSave,
  onTogglePinned,
  onRevert,
  onShowHistory,
  onShowCollaborators,
  onToggleFocusMode,
  onExitFocusMode,
  onExport,
  onOpenDeleteConfirm,
}: NoteDetailHeaderProps) {
  const StatusIcon = statusBadge.Icon;

  return (
    <>
      {focusMode && (
        <div className="fixed right-4 top-4 z-40 flex items-center gap-2">
          <span className="hidden rounded-full bg-base-200/80 px-3 py-1 text-xs text-base-content/60 backdrop-blur md:inline">
            Focus mode · press Esc or Ctrl+. to exit
          </span>
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-circle bg-base-200/80 backdrop-blur"
            onClick={onExitFocusMode}
            aria-label="Exit focus mode"
            title="Exit focus mode (Esc)"
          >
            <MinimizeIcon className="size-4" />
          </button>
        </div>
      )}
      <header
        className={`sticky top-0 z-30 bg-base-100/80 backdrop-blur-xl border-b border-base-300/30 ${focusMode ? "hidden" : ""}`}
      >
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-2.5 sm:px-6">
          <Link
            to="/app"
            className="btn btn-ghost btn-sm gap-1.5 text-base-content/60 hover:text-base-content font-normal"
            aria-label="Back to notes"
          >
            <ArrowLeftIcon className="size-4" />
            <span className="hidden sm:inline text-sm">Notes</span>
          </Link>

          <div className="flex-1 flex items-center justify-center gap-1.5">
            <StatusIcon
              className={`size-3.5 ${statusBadge.className} ${
                saving ? "animate-spin" : ""
              }`}
            />
            <span
              className={`text-xs font-medium ${statusBadge.className}`}
              title={lastSavedTooltip ?? undefined}
            >
              {statusBadge.label}
            </span>
            {pinned && (
              <span className="ml-1" title="Pinned">
                <PinIcon className="size-3 text-warning" />
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            <PresenceAvatars participants={participants} />

            <button
              type="button"
              className="btn btn-ghost btn-sm gap-1.5 text-base-content/70"
              onClick={onShowCollaborators}
              title="Share & collaborate"
            >
              <Share2Icon className="size-4" />
              <span className="hidden sm:inline text-sm">Share</span>
            </button>

            <div className="dropdown dropdown-end">
              <button
                type="button"
                tabIndex={0}
                className="btn btn-ghost btn-sm btn-square"
                aria-label="More actions"
              >
                <MoreVerticalIcon className="size-4" />
              </button>
              <ul
                tabIndex={0}
                className="dropdown-content menu bg-base-100 rounded-xl w-52 p-2 shadow-lg border border-base-300/40 z-50"
              >
                <li>
                  <button
                    type="button"
                    className="gap-2"
                    onClick={onSave}
                    disabled={disableSave}
                  >
                    <SaveIcon className="size-4" />
                    Save now
                    <kbd className="ml-auto text-[10px] text-base-content/40">
                      {shortcutLabel}
                    </kbd>
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className={`gap-2 ${pinned ? "text-warning" : ""}`}
                    onClick={onTogglePinned}
                    disabled={pinning || isReadOnly}
                  >
                    {pinned ? (
                      <PinOffIcon className="size-4" />
                    ) : (
                      <PinIcon className="size-4" />
                    )}
                    {pinned ? "Unpin note" : "Pin note"}
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className="gap-2"
                    onClick={onRevert}
                    disabled={disableRevert}
                  >
                    <UndoIcon className="size-4" />
                    Revert changes
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className="gap-2"
                    onClick={onShowHistory}
                  >
                    <HistoryIcon className="size-4" />
                    View history
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className="gap-2"
                    onClick={onToggleFocusMode}
                  >
                    {focusMode ? (
                      <MinimizeIcon className="size-4" />
                    ) : (
                      <MaximizeIcon className="size-4" />
                    )}
                    {focusMode ? "Exit focus mode" : "Focus mode"}
                    <kbd className="ml-auto text-[10px] text-base-content/40">
                      {shortcutLabel.replace("S", ".")}
                    </kbd>
                  </button>
                </li>
                <div className="divider my-0.5" />
                <li className="menu-title text-[10px] uppercase tracking-[0.2em] text-base-content/40">
                  <span className="flex items-center gap-1">
                    <DownloadIcon className="size-3" /> Export
                  </span>
                </li>
                <li>
                  <button
                    type="button"
                    className="gap-2"
                    onClick={() => onExport("markdown")}
                  >
                    <FileTextIcon className="size-4" />
                    Markdown (.md)
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className="gap-2"
                    onClick={() => onExport("html")}
                  >
                    <FileCodeIcon className="size-4" />
                    HTML (.html)
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className="gap-2"
                    onClick={() => onExport("pdf")}
                  >
                    <PrinterIcon className="size-4" />
                    PDF (via print)
                  </button>
                </li>
                <div className="divider my-0.5" />
                <li>
                  <button
                    type="button"
                    className="gap-2 text-error"
                    onClick={onOpenDeleteConfirm}
                    disabled={isReadOnly}
                  >
                    <Trash2Icon className="size-4" />
                    Delete note
                  </button>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </header>
    </>
  );
}

export default NoteDetailHeader;
