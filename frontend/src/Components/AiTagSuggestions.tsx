/**
 * AiTagSuggestions – Displays clickable AI-suggested tags below the note title.
 * Users click a chip to apply it, or dismiss all.
 */
import { SparklesIcon, XIcon } from "lucide-react";

interface AiTagSuggestionsProps {
  suggestions: string[];
  currentTags: string[];
  onApplyTag: (tag: string) => void;
  onDismiss: () => void;
  loading?: boolean;
}

function AiTagSuggestions({
  suggestions,
  currentTags,
  onApplyTag,
  onDismiss,
  loading = false,
}: AiTagSuggestionsProps) {
  // Filter out tags already applied
  const unapplied = suggestions.filter(
    (tag) => !currentTags.includes(tag.toLowerCase()),
  );

  if (loading) {
    return (
      <div className="mt-1.5 flex items-center gap-1.5 text-xs text-base-content/40">
        <SparklesIcon className="size-3 animate-pulse text-violet-400" />
        <span>Analyzing note for tag suggestions…</span>
      </div>
    );
  }

  if (unapplied.length === 0) return null;

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
      <span className="flex items-center gap-1 text-xs text-violet-400/70 font-medium">
        <SparklesIcon className="size-3" />
        Suggestions:
      </span>
      {unapplied.map((tag) => (
        <button
          key={tag}
          type="button"
          className="badge badge-sm gap-1 border-violet-500/20 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20 transition-colors cursor-pointer"
          onClick={() => onApplyTag(tag)}
        >
          #{tag}
        </button>
      ))}
      <button
        type="button"
        className="btn btn-ghost btn-xs opacity-40 hover:opacity-80"
        onClick={onDismiss}
        aria-label="Dismiss tag suggestions"
      >
        <XIcon className="size-3" />
      </button>
    </div>
  );
}

export default AiTagSuggestions;
