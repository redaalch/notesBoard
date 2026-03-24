interface BulkMoveDialogProps {
  open: boolean;
  boardOptions: any[];
  boardsLoading: boolean;
  selectedBoardId: string;
  onBoardChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
  loading: boolean;
}

export default function BulkMoveDialog({
  open,
  boardOptions,
  boardsLoading,
  selectedBoardId,
  onBoardChange,
  onClose,
  onSubmit,
  loading,
}: BulkMoveDialogProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-black/40 px-4 py-10"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-base-content/10 bg-base-100 p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className="text-lg font-semibold">Move notes to another board</h3>
        <p className="mt-1 text-sm text-base-content/60">
          Choose where the selected notes should live. Pinned status and tags
          stay intact.
        </p>
        <div className="mt-4 space-y-2">
          {boardsLoading ? (
            <p className="text-sm text-base-content/60">Loading boards...</p>
          ) : boardOptions.length ? (
            <select
              className="select select-bordered w-full"
              value={selectedBoardId}
              onChange={(event) => onBoardChange(event.target.value)}
            >
              {boardOptions.map((board) => (
                <option key={board.id} value={board.id}>
                  {board.workspaceName
                    ? `${board.workspaceName} · ${board.name}`
                    : board.name}
                </option>
              ))}
            </select>
          ) : (
            <p className="rounded-lg bg-base-200/70 px-4 py-3 text-sm text-base-content/60">
              No boards available yet. Create another board to move notes into.
            </p>
          )}
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
            disabled={loading || !boardOptions.length || !selectedBoardId}
          >
            Move notes
          </button>
        </div>
      </div>
    </div>
  );
}
