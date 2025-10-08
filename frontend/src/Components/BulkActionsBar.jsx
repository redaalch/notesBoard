import { useMemo } from "react";
import {
  BoxesIcon,
  CheckIcon,
  ListChecksIcon,
  PinIcon,
  PinOffIcon,
  TagsIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";

const ActionButton = ({ icon, label, onClick, disabled }) => {
  const IconComponent = icon;
  return (
    <button
      type="button"
      className="btn btn-sm btn-outline gap-2"
      onClick={onClick}
      disabled={disabled}
    >
      <IconComponent className="size-4" />
      {label}
    </button>
  );
};

function BulkActionsBar({
  selectedCount,
  onClearSelection,
  onPinSelected,
  onUnpinSelected,
  onAddTags,
  onMove,
  onDelete,
  busy,
}) {
  const summary = useMemo(() => {
    if (selectedCount === 1) return "1 note selected";
    return `${selectedCount} notes selected`;
  }, [selectedCount]);

  return (
    <div className="sticky top-20 z-30 mb-4 rounded-2xl border border-primary/20 bg-base-100/90 px-4 py-3 shadow-lg shadow-primary/20 backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-primary">
          <ListChecksIcon className="size-4" />
          <span>{summary}</span>
          <button
            type="button"
            className="btn btn-ghost btn-xs text-base-content/70"
            onClick={onClearSelection}
            disabled={busy}
          >
            <XIcon className="size-3" />
            Clear
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ActionButton
            icon={PinIcon}
            label="Pin"
            onClick={onPinSelected}
            disabled={busy}
          />
          <ActionButton
            icon={PinOffIcon}
            label="Unpin"
            onClick={onUnpinSelected}
            disabled={busy}
          />
          <ActionButton
            icon={TagsIcon}
            label="Add tags"
            onClick={onAddTags}
            disabled={busy}
          />
          <ActionButton
            icon={BoxesIcon}
            label="Move"
            onClick={onMove}
            disabled={busy}
          />
          <ActionButton
            icon={Trash2Icon}
            label="Delete"
            onClick={onDelete}
            disabled={busy}
          />
          <span className="hidden items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary sm:flex">
            <CheckIcon className="size-3.5" />
            Multi-select active
          </span>
        </div>
      </div>
    </div>
  );
}

export default BulkActionsBar;
