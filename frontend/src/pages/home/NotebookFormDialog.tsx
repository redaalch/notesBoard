import { useState } from "react";
import { CheckIcon, NotebookIcon } from "lucide-react";
import { NOTEBOOK_COLORS, NOTEBOOK_ICONS } from "@shared/notebookOptions";
import { notebookIconComponents } from "./homePageUtils";

interface NotebookFormDialogProps {
  formState: { mode: string; notebook?: any } | null;
  onClose: () => void;
  onSubmit: (payload: {
    name: string;
    color: string | null;
    icon: string | null;
  }) => Promise<void>;
  loading: boolean;
}

export default function NotebookFormDialog({
  formState,
  onClose,
  onSubmit,
  loading,
}: NotebookFormDialogProps) {
  const [nameInput, setNameInput] = useState(
    formState?.mode === "edit" ? (formState.notebook?.name ?? "") : "",
  );
  const [colorInput, setColorInput] = useState<string | null>(
    formState?.mode === "edit" ? (formState.notebook?.color ?? null) : null,
  );
  const [iconInput, setIconInput] = useState<string | null>(
    formState?.mode === "edit" ? (formState.notebook?.icon ?? null) : null,
  );

  if (!formState) return null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    await onSubmit({
      name: nameInput.trim(),
      color: colorInput,
      icon: iconInput,
    });
  };

  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-black/40 px-4 py-10"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <form
        className="w-full max-w-lg rounded-2xl border border-base-content/10 bg-base-100 p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <h3 className="text-lg font-semibold">
          {formState.mode === "edit" ? "Rename notebook" : "Create a notebook"}
        </h3>
        <p className="mt-1 text-sm text-base-content/60">
          {formState.mode === "edit"
            ? "Update the name to keep your notebooks organized."
            : "Group related notes together for quick access."}
        </p>
        <label className="form-control mt-4">
          <span className="label">
            <span className="label-text">Notebook name</span>
          </span>
          <input
            type="text"
            value={nameInput}
            onChange={(event) => setNameInput(event.target.value)}
            className="input input-bordered"
            placeholder="e.g. Product ideas"
            required
            autoFocus
          />
        </label>
        <div className="mt-6">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-base-content">
              Color <span className="text-base-content/60">(optional)</span>
            </span>
            <button
              type="button"
              className="btn btn-ghost btn-xs"
              onClick={() => setColorInput(null)}
              disabled={!colorInput}
            >
              Clear color
            </button>
          </div>
          <p className="mt-1 text-xs text-base-content/60">
            Highlight this notebook with a color accent.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {NOTEBOOK_COLORS.map((option) => {
              const isSelected = colorInput === option.value;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setColorInput(option.value)}
                  aria-pressed={isSelected}
                  aria-label={`${option.label} color`}
                  className={`relative flex size-9 items-center justify-center rounded-full border border-white/50 shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-base-100 ${
                    isSelected
                      ? "ring-2 ring-primary/70 ring-offset-2 ring-offset-base-100"
                      : "hover:scale-105"
                  }`}
                  style={{ backgroundColor: option.value }}
                >
                  {isSelected ? (
                    <CheckIcon
                      className="size-4"
                      style={{ color: option.textColor }}
                    />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
        <div className="mt-6">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-base-content">
              Icon <span className="text-base-content/60">(optional)</span>
            </span>
            <button
              type="button"
              className="btn btn-ghost btn-xs"
              onClick={() => setIconInput(null)}
              disabled={!iconInput}
            >
              Clear icon
            </button>
          </div>
          <p className="mt-1 text-xs text-base-content/60">
            Icons help notebooks stand out across the workspace.
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {NOTEBOOK_ICONS.map((option) => {
              const isSelected = iconInput === option.name;
              const IconComponent =
                notebookIconComponents[option.name] ?? NotebookIcon;
              return (
                <button
                  key={option.id}
                  type="button"
                  title={option.label}
                  onClick={() => setIconInput(option.name)}
                  aria-pressed={isSelected}
                  className={`flex flex-col items-center gap-1 rounded-lg border px-3 py-2 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-base-100 ${
                    isSelected
                      ? "border-primary/80 bg-primary/10 text-primary"
                      : "border-base-300/80 text-base-content/70 hover:border-base-400 hover:text-base-content"
                  }`}
                >
                  <IconComponent className="size-5" aria-hidden="true" />
                  <span className="truncate text-center">{option.label}</span>
                </button>
              );
            })}
          </div>
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
            type="submit"
            className="btn btn-primary btn-sm"
            disabled={loading}
          >
            {loading ? "Saving..." : "Save notebook"}
          </button>
        </div>
      </form>
    </div>
  );
}
