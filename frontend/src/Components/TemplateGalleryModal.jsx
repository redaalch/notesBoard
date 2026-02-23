import { useMemo, useState } from "react";
import { SearchIcon, SparklesIcon } from "lucide-react";
import { noteTemplates } from "../lib/noteTemplates";

const filterTemplates = (query) => {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return noteTemplates;
  return noteTemplates.filter((template) => {
    const haystack = [
      template.name,
      template.description,
      template.tags?.join(" "),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(trimmed);
  });
};

function TemplateGalleryModal({ open, onClose, onSelect }) {
  const [query, setQuery] = useState("");

  const templates = useMemo(() => filterTemplates(query), [query]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 px-4 py-10 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Choose a note template"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl rounded-3xl border border-base-content/10 bg-base-100 shadow-2xl shadow-primary/30"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex flex-col gap-4 border-b border-base-content/10 bg-base-200/70 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <SparklesIcon className="size-6 text-primary" aria-hidden="true" />
            <div>
              <h2 className="text-lg font-semibold">New note from template</h2>
              <p className="text-sm text-base-content/60">
                Jump-start writing with structured outlines and prompts.
              </p>
            </div>
          </div>
          <label className="input input-bordered flex max-w-sm items-center gap-2 bg-base-100/80">
            <SearchIcon className="size-4 text-base-content/60" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search templates"
              className="flex-1 bg-transparent text-sm outline-none"
            />
          </label>
        </div>
        <div className="grid max-h-[70vh] gap-4 overflow-y-auto px-6 py-6 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <article
              key={template.id}
              className="flex h-full flex-col justify-between gap-3 rounded-2xl border border-base-content/10 bg-base-100/90 p-4 shadow-md transition hover:-translate-y-1 hover:border-primary/40 hover:shadow-primary/30"
            >
              <div className="space-y-2">
                <h3 className="text-base font-semibold text-base-content">
                  {template.name}
                </h3>
                <p className="text-xs text-base-content/60 leading-relaxed">
                  {template.description}
                </p>
                {Array.isArray(template.tags) && template.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {template.tags.map((tag) => (
                      <span
                        key={`${template.id}-tag-${tag}`}
                        className="badge badge-outline badge-sm"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <button
                type="button"
                className="btn btn-primary btn-sm mt-auto"
                onClick={() => onSelect?.(template)}
              >
                Use this template
              </button>
            </article>
          ))}
          {templates.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-base-content/20 bg-base-200/60 p-10 text-center text-sm text-base-content/70">
              <SparklesIcon className="size-8 text-primary" />
              <p>No templates match that search. Try a broader keyword.</p>
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-base-content/10 bg-base-200/60 px-6 py-4">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default TemplateGalleryModal;
