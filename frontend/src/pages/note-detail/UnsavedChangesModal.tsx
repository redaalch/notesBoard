import { LoaderIcon, RefreshCwIcon, SaveIcon } from "lucide-react";

interface UnsavedChangesModalProps {
  open: boolean;
  saving: boolean;
  onCancel: () => void;
  onLeave: () => void;
  onSaveAndLeave: () => void;
}

function UnsavedChangesModal({
  open,
  saving,
  onCancel,
  onLeave,
  onSaveAndLeave,
}: UnsavedChangesModalProps) {
  return (
    <dialog
      className={`modal ${open ? "modal-open" : ""}`}
      role="dialog"
      aria-labelledby="unsaved-modal-title"
    >
      <div className="modal-box border border-warning/30">
        <h3
          id="unsaved-modal-title"
          className="text-lg font-bold text-warning flex items-center gap-2"
        >
          <RefreshCwIcon className="size-5" />
          Unsaved Changes
        </h3>
        <p className="py-4 text-base-content/80">
          You have unsaved changes that will be lost if you leave this page.
          What would you like to do?
        </p>
        <div className="modal-action flex-col sm:flex-row gap-2">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Stay on Page
          </button>
          <button type="button" className="btn btn-error" onClick={onLeave}>
            Leave Without Saving
          </button>
          <button
            type="button"
            className="btn btn-success"
            onClick={onSaveAndLeave}
            disabled={saving}
          >
            {saving ? (
              <>
                <LoaderIcon className="size-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <SaveIcon className="size-4" />
                Save &amp; Leave
              </>
            )}
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="button" onClick={onCancel}>
          close
        </button>
      </form>
    </dialog>
  );
}

export default UnsavedChangesModal;
