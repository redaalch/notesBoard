import { useEffect, useState, type FormEvent } from "react";
import { SparklesIcon } from "lucide-react";
import TagInput from "./TagInput";

const sanitizeTags = (values: unknown[]): string[] => {
  if (!Array.isArray(values)) return [];
  return values
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean)
    .slice(0, 8);
};

interface Notebook {
  name?: string;
  description?: string;
}

interface TemplatePayload {
  name: string;
  description: string;
  tags: string[];
}

interface SaveNotebookTemplateDialogProps {
  open: boolean;
  notebook?: Notebook | null;
  onClose: () => void;
  onSubmit?: (payload: TemplatePayload) => void;
  submitting?: boolean;
}

function SaveNotebookTemplateDialog({
  open,
  notebook,
  onClose,
  onSubmit,
  submitting = false,
}: SaveNotebookTemplateDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setName(notebook?.name ?? "");
    setDescription(notebook?.description ?? "");
    setTags([]);
  }, [open, notebook]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[96] flex items-center justify-center bg-black/50 px-3 py-10 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Save notebook as template"
      onClick={onClose}
    >
      <form
        className="w-full max-w-lg space-y-5 rounded-3xl border border-base-content/10 bg-base-200/90 p-6 shadow-xl shadow-primary/30"
        onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          const trimmedName = name.trim();
          if (!trimmedName) return;
          onSubmit?.({
            name: trimmedName,
            description: description.trim(),
            tags: sanitizeTags(tags),
          });
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-center gap-3">
          <SparklesIcon className="size-6 text-primary" />
          <div>
            <h2 className="text-lg font-semibold text-base-content">
              Save as template
            </h2>
            <p className="text-sm text-base-content/60">
              Preserve this notebook's structure for future projects.
            </p>
          </div>
        </header>

        <label className="form-control w-full">
          <span className="label-text text-sm font-medium text-base-content">
            Template name
          </span>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={160}
            required
            className="input input-bordered w-full bg-base-100/80"
            placeholder="Product launch template"
          />
        </label>

        <label className="form-control w-full">
          <span className="label-text text-sm font-medium text-base-content">
            Description
          </span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={500}
            rows={3}
            className="textarea textarea-bordered w-full bg-base-100/80"
            placeholder="Where and how this template should be used"
          />
        </label>

        <div className="space-y-2">
          <span className="text-sm font-medium text-base-content">
            Tags (optional)
          </span>
          <TagInput value={tags} onChange={setTags} />
          <p className="text-xs text-base-content/50">
            Up to eight tags help you find this template later.
          </p>
        </div>

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
            Save template
          </button>
        </footer>
      </form>
    </div>
  );
}

export default SaveNotebookTemplateDialog;
