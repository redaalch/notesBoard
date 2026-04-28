interface BulkMoveNotebookDialogProps {
  open: boolean;
  notebooks: { id: string; name: string }[];
  selectedTargetId: string;
  onTargetChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
  loading: boolean;
}

export default function BulkMoveNotebookDialog({
  open,
  notebooks,
  selectedTargetId,
  onTargetChange,
  onClose,
  onSubmit,
  loading,
}: BulkMoveNotebookDialogProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-black/40 px-3 py-4 sm:px-4 sm:py-10"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm sm:max-w-lg rounded-2xl border border-base-content/10 bg-base-100 p-4 sm:p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className="text-lg font-semibold">Move notes to a notebook</h3>
        <p className="mt-1 text-sm text-base-content/60">
          Choose the destination notebook. Notes moved to Uncategorized keep
          their content intact.
        </p>
        <div className="mt-4 space-y-2">
          <select
            className="select select-bordered w-full"
            value={selectedTargetId}
            onChange={(event) => onTargetChange(event.target.value)}
          >
            <option value="uncategorized">Uncategorized</option>
            {notebooks.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={onSubmit}
            disabled={loading}
          >
            Move notes
          </button>
        </div>
      </div>
    </div>
  );
}
