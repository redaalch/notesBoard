import { Suspense } from "react";
import TagInput from "../../Components/TagInput";

interface BulkTagDialogProps {
  open: boolean;
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  onClose: () => void;
  onSubmit: () => void;
  loading: boolean;
}

export default function BulkTagDialog({
  open,
  tags,
  onTagsChange,
  onClose,
  onSubmit,
  loading,
}: BulkTagDialogProps) {
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
        <h3 className="text-lg font-semibold">Add tags to selected notes</h3>
        <p className="mt-1 text-sm text-base-content/60">
          Tags are lowercased automatically. You can add up to eight tags per
          note.
        </p>
        <div className="mt-4">
          <Suspense
            fallback={
              <div className="h-10 animate-pulse rounded bg-base-200" />
            }
          >
            <TagInput value={tags} onChange={onTagsChange} />
          </Suspense>
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
            Apply tags
          </button>
        </div>
      </div>
    </div>
  );
}
