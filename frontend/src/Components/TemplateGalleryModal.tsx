import { useEffect, useMemo, useState } from "react";
import {
  SearchIcon,
  SparklesIcon,
  EyeIcon,
  ChevronLeftIcon,
  WandSparklesIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  noteTemplates,
  templateCategories,
  templateIconMap,
  type NoteTemplate,
  type TemplateCategory,
} from "../lib/noteTemplates";
import { useAiStatus } from "../hooks/useAiFeatures";
import api from "../lib/axios";
import markdownToHtml from "../lib/markdownToHtml";
import { sanitizeHtml } from "../lib/sanitize";

/* ── Helpers ── */

const filterTemplates = (
  query: string,
  category: TemplateCategory | "all",
): readonly NoteTemplate[] => {
  let filtered: NoteTemplate[] = [...noteTemplates];
  if (category !== "all") {
    filtered = filtered.filter((t) => t.category === category);
  }
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return filtered;
  return filtered.filter((template) => {
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

/* ── Component ── */

interface TemplateGalleryModalProps {
  open: boolean;
  onClose: () => void;
  onSelect?: (template: NoteTemplate) => void;
}

function TemplateGalleryModal({
  open,
  onClose,
  onSelect,
}: TemplateGalleryModalProps) {
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<
    TemplateCategory | "all"
  >("all");
  const [previewTemplate, setPreviewTemplate] = useState<NoteTemplate | null>(
    null,
  );

  // AI generation state
  const { data: aiStatus } = useAiStatus();
  const canGenerateAi = aiStatus?.features?.templateGeneration ?? false;
  const [aiDescription, setAiDescription] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<NoteTemplate | null>(null);

  const templates = useMemo(
    () => filterTemplates(query, selectedCategory),
    [query, selectedCategory],
  );

  const handleSelectTemplate = (template: NoteTemplate) => {
    onSelect?.(template);
    setPreviewTemplate(null);
    setAiResult(null);
    onClose();
  };

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setQuery("");
      setSelectedCategory("all");
      setPreviewTemplate(null);
      setAiDescription("");
      setAiResult(null);
      setAiLoading(false);
    }
  }, [open]);

  const handleAiGenerate = async () => {
    if (!aiDescription.trim() || aiLoading) return;
    setAiLoading(true);
    setAiResult(null);
    try {
      const res = await api.post("/ai/generate-template", {
        description: aiDescription.trim(),
      });
      if (res.data?.title && res.data?.content) {
        setAiResult({
          id: `ai-${Date.now()}`,
          name: res.data.title,
          description: aiDescription.trim(),
          title: res.data.title,
          content: res.data.content,
          tags: Array.isArray(res.data.tags) ? res.data.tags : [],
          category: "creative",
          icon: "Sparkles",
        });
      } else {
        toast.error(
          "Failed to generate template. Try a different description.",
        );
      }
    } catch {
      toast.error("AI template generation failed. Please try again.");
    } finally {
      setAiLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-black/40 px-0 sm:px-4 py-0 sm:py-10 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Choose a note template"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-4xl flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl border border-base-content/10 bg-base-100 shadow-2xl shadow-primary/30"
        style={{ maxHeight: "92vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex flex-col gap-3 border-b border-base-content/10 bg-base-200/70 px-4 py-4 sm:px-6 sm:py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <SparklesIcon
              className="size-5 sm:size-6 text-primary shrink-0"
              aria-hidden="true"
            />
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-semibold">
                New note from template
              </h2>
              <p className="text-xs sm:text-sm text-base-content/60 truncate">
                Jump-start writing with structured outlines and prompts.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-ghost btn-sm btn-circle ml-auto shrink-0 sm:hidden"
              aria-label="Close"
            >
              <XIcon className="size-4" />
            </button>
          </div>
          <label className="input input-bordered flex max-w-sm items-center gap-2 bg-base-100/80">
            <SearchIcon className="size-4 text-base-content/60" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search templates"
              className="flex-1 bg-transparent text-sm outline-none"
            />
          </label>
        </div>

        {/* ── Category tabs ── */}
        <div className="flex gap-1.5 overflow-x-auto border-b border-base-content/10 px-4 sm:px-6 py-2.5 scrollbar-none">
          <button
            type="button"
            className={`btn btn-xs whitespace-nowrap ${selectedCategory === "all" ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setSelectedCategory("all")}
          >
            All
          </button>
          {templateCategories.map((cat) => {
            const CatIcon = templateIconMap[cat.icon];
            return (
              <button
                key={cat.id}
                type="button"
                className={`btn btn-xs gap-1.5 whitespace-nowrap ${selectedCategory === cat.id ? "btn-primary" : "btn-ghost"}`}
                onClick={() => setSelectedCategory(cat.id)}
              >
                {CatIcon && <CatIcon className="size-3" />}
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto">
          {previewTemplate ? (
            /* ── Preview panel ── */
            <div className="flex flex-col gap-4 px-4 py-4 sm:px-6 sm:py-6">
              <button
                type="button"
                className="btn btn-ghost btn-sm gap-1.5 self-start"
                onClick={() => setPreviewTemplate(null)}
              >
                <ChevronLeftIcon className="size-4" />
                Back to templates
              </button>

              <div className="flex items-center gap-2">
                {(() => {
                  const PIcon = templateIconMap[previewTemplate.icon];
                  return PIcon ? (
                    <PIcon className="size-5 text-primary/70" />
                  ) : null;
                })()}
                <h3 className="text-lg font-bold">{previewTemplate.name}</h3>
              </div>

              <p className="text-sm text-base-content/60">
                {previewTemplate.description}
              </p>

              <div
                className="prose prose-sm max-w-none rounded-2xl border border-base-content/10 bg-base-200/40 p-4 sm:p-6"
                dangerouslySetInnerHTML={{
                  __html: sanitizeHtml(markdownToHtml(previewTemplate.content)),
                }}
              />

              {Array.isArray(previewTemplate.tags) &&
                previewTemplate.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {previewTemplate.tags.map((tag) => (
                      <span key={tag} className="badge badge-outline badge-sm">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

              <button
                type="button"
                className="btn btn-primary btn-sm self-end"
                onClick={() => handleSelectTemplate(previewTemplate)}
              >
                Use this template
              </button>
            </div>
          ) : (
            /* ── Template grid ── */
            <div className="grid gap-3 px-4 py-4 sm:gap-4 sm:px-6 sm:py-6 sm:grid-cols-2 lg:grid-cols-3">
              {/* AI generation card */}
              {canGenerateAi && selectedCategory === "all" && !query && (
                <article className="col-span-full rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 p-5">
                  <div className="mb-3 flex items-center gap-2">
                    <WandSparklesIcon className="size-5 text-primary" />
                    <h3 className="text-base font-semibold">
                      Generate with AI
                    </h3>
                  </div>
                  <p className="mb-3 text-xs text-base-content/60">
                    Describe the template you need and AI will create a
                    structured outline.
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={aiDescription}
                      onChange={(e) => setAiDescription(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleAiGenerate();
                      }}
                      placeholder="e.g., Sprint planning for a 6-person team"
                      className="input input-bordered input-sm flex-1 bg-base-100"
                      maxLength={500}
                      disabled={aiLoading}
                    />
                    <button
                      type="button"
                      className="btn btn-primary btn-sm gap-1.5"
                      onClick={handleAiGenerate}
                      disabled={aiLoading || !aiDescription.trim()}
                    >
                      {aiLoading ? (
                        <span className="loading loading-spinner loading-xs" />
                      ) : (
                        <SparklesIcon className="size-3.5" />
                      )}
                      Generate
                    </button>
                  </div>

                  {/* AI result */}
                  {aiResult && (
                    <div className="mt-4 rounded-xl border border-primary/20 bg-base-100 p-4 space-y-3">
                      <h4 className="text-sm font-semibold">
                        {aiResult.title}
                      </h4>
                      <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-base-content/70">
                        {aiResult.content}
                      </pre>
                      {aiResult.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {aiResult.tags.map((tag) => (
                            <span
                              key={tag}
                              className="badge badge-outline badge-xs"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => handleSelectTemplate(aiResult)}
                        >
                          Use this template
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => setAiResult(null)}
                        >
                          <XIcon className="size-3" />
                          Discard
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              )}

              {/* Template cards */}
              {templates.map((template) => {
                const TIcon = templateIconMap[template.icon];
                return (
                  <article
                    key={template.id}
                    className="flex h-full flex-col justify-between gap-3 rounded-2xl border border-base-content/10 bg-base-100/90 p-4 shadow-md transition hover:-translate-y-1 hover:border-primary/40 hover:shadow-primary/30"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        {TIcon && (
                          <TIcon className="size-4.5 text-primary/70" />
                        )}
                        <h3 className="text-base font-semibold text-base-content">
                          {template.name}
                        </h3>
                      </div>
                      <p className="text-xs text-base-content/60 leading-relaxed">
                        {template.description}
                      </p>
                      {Array.isArray(template.tags) &&
                        template.tags.length > 0 && (
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
                    <div className="mt-auto flex gap-2">
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm flex-1"
                        onClick={() => setPreviewTemplate(template)}
                      >
                        <EyeIcon className="size-3.5" />
                        Preview
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm flex-1"
                        onClick={() => handleSelectTemplate(template)}
                      >
                        Use
                      </button>
                    </div>
                  </article>
                );
              })}

              {templates.length === 0 && (
                <div className="col-span-full flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-base-content/20 bg-base-200/60 p-10 text-center text-sm text-base-content/70">
                  <SparklesIcon className="size-8 text-primary" />
                  <p>No templates match that search. Try a broader keyword.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
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
