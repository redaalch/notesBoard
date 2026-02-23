type ConfirmTone =
  | "primary"
  | "secondary"
  | "accent"
  | "info"
  | "success"
  | "warning"
  | "error";

const toneToButtonClass: Record<ConfirmTone, string> = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  accent: "btn-accent",
  info: "btn-info",
  success: "btn-success",
  warning: "btn-warning",
  error: "btn-error",
};

export interface ConfirmDialogProps {
  open: boolean;
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
  confirmLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmDialog({
  open,
  title = "Are you sure?",
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "error",
  confirmLoading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  const confirmClass = `btn ${
    toneToButtonClass[tone] ?? toneToButtonClass.error
  }`;

  return (
    <div className="modal modal-open" role="dialog" aria-modal="true">
      <div className="modal-box">
        <h3 className="font-bold text-lg text-base-content">{title}</h3>
        {description ? (
          <p className="py-4 text-base-content/70">{description}</p>
        ) : null}
        <div className="modal-action">
          <button
            type="button"
            className="btn"
            onClick={onCancel}
            disabled={confirmLoading}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={confirmClass}
            onClick={onConfirm}
            disabled={confirmLoading}
          >
            {confirmLoading ? "Working..." : confirmLabel}
          </button>
        </div>
      </div>
      <button type="button" className="modal-backdrop" onClick={onCancel}>
        Close
      </button>
    </div>
  );
}

export default ConfirmDialog;
