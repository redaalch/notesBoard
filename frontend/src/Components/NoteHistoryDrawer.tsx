import { useMemo, useState } from "react";
import {
  HistoryIcon,
  LoaderIcon,
  XIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  RotateCcwIcon,
  PlusIcon,
  MinusIcon,
} from "lucide-react";
import { formatRelativeTime } from "../lib/Utils";
import { diffLines, diffStats, type DiffLine } from "../lib/lineDiff";

export interface HistoryEntry {
  id: string;
  eventType: string;
  summary?: string;
  createdAt?: string;
  actorId?: string | null;
  titleSnapshot?: string | null;
  contentSnapshot?: string | null;
  tagsSnapshot?: string[] | null;
}

interface NoteHistoryDrawerProps {
  open: boolean;
  onClose: () => void;
  history: HistoryEntry[];
  loading: boolean;
  currentTitle: string;
  currentContent: string;
  canRestore: boolean;
  onRestore: (entry: HistoryEntry) => void;
}

const EVENT_LABELS: Record<string, string> = {
  create: "Created",
  edit: "Edited",
  pin: "Pinned",
  unpin: "Unpinned",
  tag: "Tagged",
  move: "Moved",
  delete: "Deleted",
  title: "Retitled",
  comment: "Commented",
};

const DiffView = ({ lines }: { lines: DiffLine[] }) => {
  if (!lines.length) {
    return (
      <p className="text-xs text-base-content/40 italic">
        No textual differences.
      </p>
    );
  }
  return (
    <pre className="whitespace-pre-wrap break-words rounded-md border border-base-300/40 bg-base-200/40 p-2 text-[11px] leading-relaxed max-h-72 overflow-y-auto">
      {lines.map((line, index) => {
        if (line.op === "same") {
          return (
            <span
              key={index}
              className="block text-base-content/40"
            >
              {"  "}
              {line.line || "\u00A0"}
            </span>
          );
        }
        if (line.op === "add") {
          return (
            <span
              key={index}
              className="block bg-success/10 text-success"
            >
              + {line.line || "\u00A0"}
            </span>
          );
        }
        return (
          <span
            key={index}
            className="block bg-error/10 text-error"
          >
            - {line.line || "\u00A0"}
          </span>
        );
      })}
    </pre>
  );
};

const NoteHistoryDrawer = ({
  open,
  onClose,
  history,
  loading,
  currentTitle,
  currentContent,
  canRestore,
  onRestore,
}: NoteHistoryDrawerProps) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const diffableMap = useMemo(() => {
    const map = new Map<string, DiffLine[]>();
    for (let i = 0; i < history.length; i++) {
      const current = history[i];
      if (current.contentSnapshot == null) continue;
      const older = history
        .slice(i + 1)
        .find((entry) => entry.contentSnapshot != null);
      const olderContent = older?.contentSnapshot ?? "";
      const newerContent = current.contentSnapshot ?? "";
      map.set(current.id, diffLines(olderContent, newerContent));
    }
    return map;
  }, [history]);

  const currentDiffMap = useMemo(() => {
    const map = new Map<string, DiffLine[]>();
    for (const entry of history) {
      if (entry.contentSnapshot == null) continue;
      map.set(entry.id, diffLines(entry.contentSnapshot, currentContent));
    }
    return map;
  }, [history, currentContent]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-black/20 backdrop-blur-[2px]"
        onClick={onClose}
        aria-label="Close history"
      />
      <aside className="relative w-full max-w-md bg-base-100 shadow-2xl border-l border-base-300/40 flex flex-col animate-slide-in-right">
        <div className="flex items-center justify-between px-5 py-4 border-b border-base-300/40">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <HistoryIcon className="size-4" />
            Change history
          </h3>
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-circle"
            onClick={onClose}
            aria-label="Close history"
          >
            <XIcon className="size-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && history.length === 0 ? (
            <div className="flex items-center justify-center py-10">
              <LoaderIcon className="size-5 animate-spin" />
            </div>
          ) : history.length === 0 ? (
            <p className="text-sm text-base-content/50 text-center py-10">
              No changes recorded yet.
            </p>
          ) : (
            <ol className="relative px-5 py-4">
              <span
                className="absolute left-7 top-0 bottom-0 w-px bg-base-300/60"
                aria-hidden="true"
              />
              {history.map((entry, index) => {
                const timestamp = entry.createdAt
                  ? new Date(entry.createdAt)
                  : null;
                const diff = diffableMap.get(entry.id);
                const diffVsCurrent = currentDiffMap.get(entry.id);
                const stats = diff ? diffStats(diff) : null;
                const isExpanded = expandedId === entry.id;
                const hasSnapshot = entry.contentSnapshot != null;
                const label =
                  EVENT_LABELS[entry.eventType] ?? entry.eventType;
                const isFirst = index === 0;

                return (
                  <li
                    key={entry.id}
                    className="relative pl-6 pb-4 last:pb-0"
                  >
                    <span
                      className={`absolute left-1 top-1.5 size-3 rounded-full border-2 border-base-100 ${
                        isFirst
                          ? "bg-primary"
                          : hasSnapshot
                            ? "bg-base-content/50"
                            : "bg-base-300"
                      }`}
                      aria-hidden="true"
                    />
                    <div className="rounded-lg border border-base-300/50 bg-base-200/40 px-3 py-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-base-content truncate">
                            {entry.summary ?? label}
                          </p>
                          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px]">
                            <span className="uppercase tracking-wide text-base-content/50">
                              {label}
                            </span>
                            {stats && (stats.added || stats.removed) ? (
                              <span className="flex items-center gap-1 text-base-content/60">
                                {stats.added > 0 && (
                                  <span className="text-success inline-flex items-center gap-0.5">
                                    <PlusIcon className="size-3" />
                                    {stats.added}
                                  </span>
                                )}
                                {stats.removed > 0 && (
                                  <span className="text-error inline-flex items-center gap-0.5">
                                    <MinusIcon className="size-3" />
                                    {stats.removed}
                                  </span>
                                )}
                              </span>
                            ) : null}
                            <span className="text-base-content/50 ml-auto">
                              {timestamp ? formatRelativeTime(timestamp) : ""}
                            </span>
                          </div>
                        </div>
                      </div>

                      {hasSnapshot && (
                        <div className="mt-2">
                          <button
                            type="button"
                            className="btn btn-ghost btn-xs gap-1 px-1"
                            onClick={() =>
                              setExpandedId(isExpanded ? null : entry.id)
                            }
                          >
                            {isExpanded ? (
                              <ChevronDownIcon className="size-3" />
                            ) : (
                              <ChevronRightIcon className="size-3" />
                            )}
                            {isExpanded ? "Hide changes" : "View changes"}
                          </button>
                          {isExpanded && (
                            <div className="mt-2 space-y-3">
                              {entry.titleSnapshot !== null &&
                                entry.titleSnapshot !== currentTitle && (
                                  <div className="text-[11px]">
                                    <p className="text-base-content/50 mb-1">
                                      Title at this point
                                    </p>
                                    <p className="rounded border border-base-300/40 bg-base-200/40 px-2 py-1 font-medium">
                                      {entry.titleSnapshot || "(empty)"}
                                    </p>
                                  </div>
                                )}
                              {diff && (
                                <div>
                                  <p className="text-[11px] text-base-content/50 mb-1">
                                    Diff vs previous version
                                  </p>
                                  <DiffView lines={diff} />
                                </div>
                              )}
                              {diffVsCurrent && !isFirst && (
                                <div>
                                  <p className="text-[11px] text-base-content/50 mb-1">
                                    Diff vs current
                                  </p>
                                  <DiffView lines={diffVsCurrent} />
                                </div>
                              )}
                              {canRestore && !isFirst && (
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-xs gap-1 text-primary"
                                  onClick={() => onRestore(entry)}
                                >
                                  <RotateCcwIcon className="size-3" />
                                  Restore this version
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </aside>
    </div>
  );
};

export default NoteHistoryDrawer;
