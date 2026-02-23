import { useEffect, useState, type FormEvent } from "react";
import { BookmarkIcon } from "lucide-react";

export interface SavedNotebookQueryDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit?: (name: string) => void;
  defaultName?: string;
  submitting?: boolean;
}

function SavedNotebookQueryDialog({
  open,
  onClose,
  onSubmit,
  defaultName = "",
  submitting = false,
}: SavedNotebookQueryDialogProps) {
  const [name, setName] = useState("");

  useEffect(() => {
    if (!open) return;
    setName(defaultName);
  }, [open, defaultName]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[96] flex items-center justify-center bg-black/50 px-3 py-10 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Save current view"
      onClick={onClose}
    >
      <form
        className="w-full max-w-md space-y-5 rounded-3xl border border-base-content/10 bg-base-200/90 p-6 shadow-xl shadow-primary/20"
        onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          const trimmed = name.trim();
          if (!trimmed) return;
          onSubmit?.(trimmed);
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-center gap-3">
          <BookmarkIcon className="size-6 text-primary" />
          <div>
            <h2 className="text-lg font-semibold text-base-content">
              Save current view
            </h2>
            <p className="text-sm text-base-content/60">
              Keep these filters and search settings handy for quick access.
            </p>
          </div>
        </header>

        <label className="form-control w-full">
          <span className="label-text text-sm font-medium text-base-content">
            Saved view name
          </span>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={120}
            required
            className="input input-bordered w-full bg-base-100/80"
            placeholder="Pinned research notes"
            autoFocus
          />
        </label>

        <footer className="flex items-center justify-end gap-3">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting}
          >
            {submitting && (
              <span className="loading loading-spinner loading-xs" />
            )}
            Save view
          </button>
        </footer>
      </form>
    </div>
  );
}

export default SavedNotebookQueryDialog;
