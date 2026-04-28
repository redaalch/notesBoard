import { AlertTriangleIcon } from "lucide-react";

export interface DeleteStateNotebook {
  id: string;
  name?: string;
  noteCount?: number;
}

export interface DeleteState {
  notebook: DeleteStateNotebook;
  mode: string;
  targetNotebookId: string;
  deleteCollaborative: boolean;
}

interface NotebookDeleteDialogProps {
  deleteState: DeleteState | null;
  notebooks: { id: string; name: string }[];
  loading: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onUpdateState: (
    updater: (prev: DeleteState | null) => DeleteState | null,
  ) => void;
}

export default function NotebookDeleteDialog({
  deleteState,
  notebooks,
  loading,
  onClose,
  onConfirm,
  onUpdateState,
}: NotebookDeleteDialogProps) {
  if (!deleteState) return null;

  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-black/40 px-4 py-10"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-2xl border border-base-content/10 bg-base-100 p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-warning/20 p-2 text-warning">
            <AlertTriangleIcon className="size-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Delete notebook?</h3>
            <p className="mt-1 text-sm text-base-content/70">
              {deleteState.notebook?.noteCount
                ? `${deleteState.notebook.noteCount} notes are inside this notebook.`
                : "This notebook is empty."}
            </p>
          </div>
        </div>

        {deleteState.notebook?.noteCount ? (
          <div className="mt-4 space-y-3">
            <label className="flex items-start gap-3 rounded-xl border border-base-300/60 bg-base-200/70 px-4 py-3">
              <input
                type="radio"
                name="notebook-delete-mode"
                className="radio radio-sm"
                checked={deleteState.mode === "move"}
                onChange={() =>
                  onUpdateState((prev) =>
                    prev ? { ...prev, mode: "move" } : prev,
                  )
                }
              />
              <div>
                <p className="font-medium">Move notes elsewhere</p>
                <p className="text-sm text-base-content/70">
                  Keep note content by moving it to another notebook or
                  uncategorized.
                </p>
                <select
                  className="select select-bordered select-sm mt-2 w-full max-w-xs"
                  value={deleteState.targetNotebookId ?? "uncategorized"}
                  onChange={(event) =>
                    onUpdateState((prev) =>
                      prev
                        ? { ...prev, targetNotebookId: event.target.value }
                        : prev,
                    )
                  }
                  disabled={deleteState.mode !== "move"}
                >
                  <option value="uncategorized">Uncategorized</option>
                  {notebooks
                    .filter((entry) => entry.id !== deleteState.notebook.id)
                    .map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.name}
                      </option>
                    ))}
                </select>
              </div>
            </label>
            <label className="flex items-start gap-3 rounded-xl border border-base-300/60 bg-base-200/70 px-4 py-3">
              <input
                type="radio"
                name="notebook-delete-mode"
                className="radio radio-sm"
                checked={deleteState.mode === "delete"}
                onChange={() =>
                  onUpdateState((prev) =>
                    prev ? { ...prev, mode: "delete" } : prev,
                  )
                }
              />
              <div>
                <p className="font-medium text-error">Delete notes</p>
                <p className="text-sm text-base-content/70">
                  Permanently remove the notebook and all notes inside it.
                </p>
                <label className="mt-2 flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-sm"
                    checked={Boolean(deleteState.deleteCollaborative)}
                    onChange={(event) =>
                      onUpdateState((prev) =>
                        prev
                          ? {
                              ...prev,
                              deleteCollaborative: event.target.checked,
                            }
                          : prev,
                      )
                    }
                    disabled={deleteState.mode !== "delete"}
                  />
                  <span>
                    Also delete collaborative documents for these notes
                  </span>
                </label>
              </div>
            </label>
          </div>
        ) : null}

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
            className="btn btn-error btn-sm"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? "Deleting..." : "Delete notebook"}
          </button>
        </div>
      </div>
    </div>
  );
}
