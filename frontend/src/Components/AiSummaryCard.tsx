/**
 * AiSummaryCard – Displays an AI-generated summary and interactive action items
 * with a subtle animated gradient border to indicate AI origin.
 */
import { CheckCircleIcon, CircleIcon, SparklesIcon, XIcon } from "lucide-react";
import { useState } from "react";
import type { ActionItem } from "../hooks/useAiFeatures";

interface AiSummaryCardProps {
  summary: string;
  actionItems: ActionItem[];
  generatedAt?: string;
  onDismiss?: () => void;
  onToggleItem?: (itemId: string) => void;
}

function AiSummaryCard({
  summary,
  actionItems,
  generatedAt,
  onDismiss,
  onToggleItem,
}: AiSummaryCardProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const completedCount = actionItems.filter((i) => i.completed).length;
  const totalCount = actionItems.length;

  return (
    <div
      className="relative mb-6 overflow-hidden rounded-xl p-[1px] animate-gradient-x"
      style={{
        backgroundImage:
          "linear-gradient(90deg, rgba(139,92,246,0.4), rgba(14,165,233,0.4), rgba(16,185,129,0.4), rgba(139,92,246,0.4))",
        backgroundSize: "200% 100%",
      }}
    >
      <div className="rounded-[11px] bg-base-100 p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-base-content/80">
            <SparklesIcon className="size-4 text-violet-400" />
            AI Summary
          </div>
          <div className="flex items-center gap-2">
            {generatedAt && (
              <span className="text-xs text-base-content/40">
                {new Date(generatedAt).toLocaleDateString()}
              </span>
            )}
            {onDismiss && (
              <button
                type="button"
                className="btn btn-ghost btn-xs btn-circle"
                onClick={() => {
                  setDismissed(true);
                  onDismiss();
                }}
                aria-label="Dismiss summary"
              >
                <XIcon className="size-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Summary text */}
        <p className="text-sm text-base-content/70 leading-relaxed">
          {summary}
        </p>

        {/* Interactive Action Items */}
        {totalCount > 0 && (
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-base-content/50 uppercase tracking-wider">
                Action Items
              </h4>
              <span className="text-xs text-base-content/40">
                {completedCount}/{totalCount} done
              </span>
            </div>

            {/* Progress bar */}
            {totalCount > 1 && (
              <div className="h-1 w-full rounded-full bg-base-300/50 overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-400 transition-all duration-300 ease-out"
                  style={{
                    width: `${(completedCount / totalCount) * 100}%`,
                  }}
                />
              </div>
            )}

            <ul className="space-y-1">
              {actionItems.map((item) => (
                <li key={item._id}>
                  <button
                    type="button"
                    className="group flex w-full items-start gap-2.5 rounded-lg px-1.5 py-1 text-left text-sm transition-colors hover:bg-base-200/60"
                    onClick={() => onToggleItem?.(item._id)}
                  >
                    {item.completed ? (
                      <CheckCircleIcon className="mt-0.5 size-4 shrink-0 text-emerald-400 transition-transform group-active:scale-90" />
                    ) : (
                      <CircleIcon className="mt-0.5 size-4 shrink-0 text-base-content/30 transition-colors group-hover:text-violet-400 group-active:scale-90" />
                    )}
                    <span
                      className={`transition-colors ${
                        item.completed
                          ? "text-base-content/40 line-through"
                          : "text-base-content/70"
                      }`}
                    >
                      {item.text}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export default AiSummaryCard;
