import { useMemo, type ChangeEvent } from "react";
import {
  ListChecksIcon,
  FolderIcon,
  PinIcon,
  PinOffIcon,
  TagsIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import type { AppIcon } from "../types/icon";

interface ActionButtonProps {
  icon: AppIcon;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}

const ActionButton = ({
  icon,
  label,
  onClick,
  disabled,
  danger,
}: ActionButtonProps) => {
  const IconComponent = icon;
  return (
    <button
      type="button"
      className={`ds-chip${danger ? " danger" : ""}`}
      onClick={onClick}
      disabled={disabled}
    >
      <IconComponent size={12} />
      <span>{label}</span>
    </button>
  );
};

interface NotebookOption {
  id: string;
  name: string;
}

interface BulkActionsBarProps {
  selectedCount: number;
  onClearSelection: () => void;
  onPinSelected: () => void;
  onUnpinSelected: () => void;
  onAddTags: () => void;
  onMoveNotebook: () => void;
  onDelete: () => void;
  busy?: boolean;
  notebookOptions?: NotebookOption[];
  onQuickMoveNotebook?: (notebookId: string) => void;
}

function BulkActionsBar({
  selectedCount,
  onClearSelection,
  onPinSelected,
  onUnpinSelected,
  onAddTags,
  onMoveNotebook,
  onDelete,
  busy,
  notebookOptions = [],
  onQuickMoveNotebook,
}: BulkActionsBarProps) {
  const summary = useMemo(() => {
    if (selectedCount === 1) return "1 note selected";
    return `${selectedCount} notes selected`;
  }, [selectedCount]);

  const handleQuickMoveChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    if (!value) return;
    if (typeof onQuickMoveNotebook === "function") {
      onQuickMoveNotebook(value);
    }
    event.target.value = "";
  };

  return (
    <div className="ds-bulk">
      <div className="ds-bulk-count">
        <ListChecksIcon size={12} />
        <span>{summary}</span>
        <button
          type="button"
          className="ds-chip"
          onClick={onClearSelection}
          disabled={busy}
          style={{ marginLeft: 6 }}
        >
          <XIcon size={10} /> Clear
        </button>
      </div>
      <div className="ds-bulk-actions">
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
          label="Tags"
          onClick={onAddTags}
          disabled={busy}
        />
        <ActionButton
          icon={FolderIcon}
          label="Move"
          onClick={onMoveNotebook}
          disabled={busy}
        />
        {notebookOptions.length > 0 && (
          <>
            <label htmlFor="bulk-move-notebook" className="sr-only">
              Move selected notes to notebook
            </label>
            <select
              id="bulk-move-notebook"
              className="ds-chip"
              defaultValue=""
              onChange={handleQuickMoveChange}
              disabled={busy}
              style={{ padding: "4px 8px" }}
            >
              <option value="" disabled>
                Quick move…
              </option>
              <option value="__uncategorized">Uncategorized</option>
              {notebookOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </>
        )}
        <ActionButton
          icon={Trash2Icon}
          label="Delete"
          onClick={onDelete}
          disabled={busy}
          danger
        />
      </div>
    </div>
  );
}

export default BulkActionsBar;
