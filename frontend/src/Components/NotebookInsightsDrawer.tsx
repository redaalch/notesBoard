import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowRightIcon,
  BookOpenIcon,
  FilterIcon,
  LoaderIcon,
  NotebookIcon,
  SparklesIcon,
  TagIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";
import api from "../lib/axios";
import { formatRelativeTime } from "../lib/Utils";

export interface NoteForInsights {
  _id?: string;
  id?: string;
  title?: string;
  tags?: string[];
  updatedAt?: string;
  [key: string]: unknown;
}

export interface Recommendation {
  id: string;
  name?: string;
  score?: number;
  noteCount?: number;
  matchedTags?: string[];
}

export interface SavedQuery {
  id: string;
  name: string;
}

export interface SmartResult {
  matchedTag?: string;
  search?: string;
  noteCount?: number;
  notes?: any[];
  appliedFilters?: { tags?: string[] };
}

interface Notebook {
  id?: string;
  _id?: string;
  name?: string;
}

export interface NotebookInsightsDrawerProps {
  open: boolean;
  note: NoteForInsights | null;
  onClose: () => void;
  onMoveNote?: (noteId: string, targetNotebookId: string) => Promise<void>;
  onViewNotebook?: (id: string) => void;
  onApplySmartView?: (params: {
    search: string;
    matchedTag: string | null;
    tags: string[];
    noteCount: number;
  }) => void;
  notebooks?: Notebook[];
  savedQueries?: SavedQuery[];
  activeNotebookId?: string | null;
}

function NotebookInsightsDrawer({
  open,
  note,
  onClose,
  onMoveNote,
  onViewNotebook,
  onApplySmartView,
  notebooks = [],
  savedQueries = [],
  activeNotebookId = null,
}: NotebookInsightsDrawerProps) {
  const noteId = note?._id ?? note?.id ?? null;
  const noteTitle = note?.title ?? "Untitled note";
  const noteTags = useMemo(() => {
    if (!note || !Array.isArray(note.tags)) {
      return [];
    }
    return note.tags.filter(Boolean);
  }, [note]);

  const [selectedTag, setSelectedTag] = useState(noteTags[0] ?? "");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSavedQueryId, setSelectedSavedQueryId] = useState<
    string | null
  >(null);
  const [smartResult, setSmartResult] = useState<SmartResult | null>(null);
  const [movingNotebookId, setMovingNotebookId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSelectedTag(noteTags[0] ?? "");
    setSearchTerm("");
    setSelectedSavedQueryId(null);
    setSmartResult(null);
    setMovingNotebookId(null);
  }, [open, noteId, noteTags]);

  const recommendationsQuery = useQuery({
    queryKey: ["note-recommendations", noteId],
    enabled: open && Boolean(noteId),
    queryFn: async () => {
      const response = await api.get("/notebooks/recommendations", {
        params: { noteId },
      });
      return Array.isArray(response.data?.recommendations)
        ? (response.data.recommendations as Recommendation[])
        : [];
    },
    staleTime: 30_000,
  });

  const smartMutation = useMutation({
    mutationFn: async (params: Record<string, string | number>) => {
      const response = await api.get("/notebooks/smart", { params });
      return response.data as SmartResult;
    },
    onSuccess: (data: SmartResult) => {
      setSmartResult(data ?? null);
      toast.success("Smart view ready");
    },
    onError: (error: unknown) => {
      const message =
        (error as any)?.response?.data?.message ?? "Unable to build smart view";
      toast.error(message);
    },
  });

  const recommendations = recommendationsQuery.data ?? [];
  const loadingRecommendations = recommendationsQuery.isLoading;

  if (!open || !noteId) {
    return null;
  }

  const handleMoveNote = async (targetNotebookId: string) => {
    if (!targetNotebookId || movingNotebookId) return;
    setMovingNotebookId(targetNotebookId);
    try {
      if (typeof onMoveNote === "function") {
        await onMoveNote(noteId, targetNotebookId);
      }
      recommendationsQuery.refetch().catch(() => {});
    } catch (error) {
      const message =
        (error as any)?.response?.data?.message ??
        "Failed to move note to notebook";
      toast.error(message);
    } finally {
      setMovingNotebookId(null);
    }
  };

  const handleSmartViewBuild = () => {
    const params: Record<string, string | number> = { limit: 20 };
    if (selectedSavedQueryId) {
      params.savedQueryId = selectedSavedQueryId;
    }
    if (selectedTag) {
      params.tag = selectedTag;
    }
    if (searchTerm.trim()) {
      params.search = searchTerm.trim();
    }
    if (!params.tag && !params.search && !params.savedQueryId) {
      toast.error("Choose a tag, search, or saved view first");
      return;
    }
    smartMutation.mutate(params);
  };

  const smartViewSummary = smartResult
    ? {
        matchedTag: smartResult.matchedTag,
        search: smartResult.search,
        noteCount: smartResult.noteCount ?? 0,
        tags:
          smartResult.appliedFilters?.tags ??
          (smartResult.matchedTag ? [smartResult.matchedTag] : []),
      }
    : null;

  return (
    <div
      className="fixed inset-0 z-[96] flex items-end justify-center bg-black/40 px-4 pb-4 pt-16 sm:items-center sm:justify-end"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-t-[28px] border border-base-300/60 bg-base-100/95 px-6 py-6 shadow-2xl backdrop-blur-sm sm:max-w-xl sm:rounded-[28px]"
        onClick={(event: React.MouseEvent) => event.stopPropagation()}
      >
        <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-semibold text-primary">
              <SparklesIcon className="size-4" /> Intelligence
            </div>
            <h2 className="text-xl font-semibold text-base-content">
              Insights for "{noteTitle}"
            </h2>
            {note?.updatedAt ? (
              <p className="text-xs text-base-content/60">
                Last updated{" "}
                {formatRelativeTime(new Date(note.updatedAt as string))}
              </p>
            ) : null}
            {noteTags.length ? (
              <div className="flex flex-wrap items-center gap-1 text-xs text-base-content/60">
                {noteTags.map((tag) => (
                  <span key={tag} className="badge badge-outline badge-xs">
                    #{tag}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={onClose}
          >
            <XIcon className="size-4" />
            Close
          </button>
        </header>

        <section className="mt-6 space-y-6">
          <div className="rounded-2xl border border-base-300/60 bg-base-200/40 p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-base-content">
                  Recommended notebooks
                </h3>
                <p className="text-xs text-base-content/60">
                  Suggestions ranked by relevance, tags, collaborators, and
                  saved views.
                </p>
              </div>
              <span className="badge badge-outline badge-sm shrink-0 whitespace-nowrap">
                {loadingRecommendations
                  ? "Loading"
                  : `${recommendations.length} suggestions`}
              </span>
            </div>
            <div className="mt-4 space-y-3">
              {loadingRecommendations ? (
                <div className="flex items-center gap-2 text-sm text-base-content/60">
                  <LoaderIcon className="size-4 animate-spin" />
                  Fetching recommendations…
                </div>
              ) : recommendations.length ? (
                recommendations.slice(0, 6).map((rec) => {
                  const percentage = Math.round((rec.score ?? 0) * 100);
                  const isActive = rec.id === activeNotebookId;
                  const label =
                    notebooks.find((n) => n.id === rec.id)?.name ?? rec.name;
                  return (
                    <div
                      key={rec.id}
                      className="rounded-xl border border-base-300/60 bg-base-100/90 p-4"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <NotebookIcon className="size-4 text-primary" />
                            <span className="text-sm font-semibold text-base-content">
                              {label}
                            </span>
                            {isActive ? (
                              <span className="badge badge-xs badge-outline">
                                Viewing
                              </span>
                            ) : null}
                          </div>
                          <p className="text-xs text-base-content/60 mt-1">
                            Match score {percentage}% · {rec.noteCount ?? 0}{" "}
                            notes
                          </p>
                          {rec.matchedTags?.length ? (
                            <div className="mt-2 flex flex-wrap items-center gap-1 text-[11px] text-base-content/60">
                              <TagIcon className="size-3" />
                              {rec.matchedTags.map((tag) => (
                                <span
                                  key={tag}
                                  className="badge badge-outline badge-xs"
                                >
                                  #{tag}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            onClick={() => onViewNotebook?.(rec.id)}
                          >
                            <ArrowRightIcon className="size-4" />
                            View
                          </button>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => handleMoveNote(rec.id)}
                            disabled={movingNotebookId === rec.id}
                          >
                            {movingNotebookId === rec.id ? (
                              <LoaderIcon className="size-4 animate-spin" />
                            ) : (
                              <BookOpenIcon className="size-4" />
                            )}
                            Move note here
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-xs text-base-content/60">
                  No suggestions yet. Tag the note or collaborate to see smarter
                  matches.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-base-300/60 bg-base-200/40 p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-base-content">
                  Build a smart view
                </h3>
                <p className="text-xs text-base-content/60">
                  Combine tags, search, or saved views to preview cross-notebook
                  results.
                </p>
              </div>
              {smartMutation.isPending ? (
                <span className="loading loading-spinner loading-xs text-primary" />
              ) : null}
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="form-control">
                <span className="label-text text-xs text-base-content/70">
                  Focus on tag
                </span>
                <select
                  className="select select-bordered select-sm"
                  value={selectedTag}
                  onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
                    setSelectedTag(event.target.value)
                  }
                >
                  <option value="">Any tag</option>
                  {noteTags.map((tag) => (
                    <option key={tag} value={tag}>
                      #{tag}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-control">
                <span className="label-text text-xs text-base-content/70">
                  Search phrase
                </span>
                <input
                  type="search"
                  className="input input-bordered input-sm"
                  value={searchTerm}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                    setSearchTerm(event.target.value)
                  }
                  placeholder="AI roadmap"
                />
              </label>
              <label className="form-control sm:col-span-2">
                <span className="label-text text-xs text-base-content/70">
                  Saved view
                </span>
                <select
                  className="select select-bordered select-sm"
                  value={selectedSavedQueryId ?? ""}
                  onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
                    setSelectedSavedQueryId(
                      event.target.value ? event.target.value : null,
                    )
                  }
                >
                  <option value="">None</option>
                  {savedQueries.map((query) => (
                    <option key={query.id} value={query.id}>
                      {query.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleSmartViewBuild}
                disabled={smartMutation.isPending}
              >
                <FilterIcon className="size-4" />
                Build smart view
              </button>
              {smartResult ? (
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() =>
                    onApplySmartView?.({
                      search: smartResult.search ?? "",
                      matchedTag: smartResult.matchedTag ?? null,
                      tags: smartResult.appliedFilters?.tags ?? [],
                      noteCount: smartResult.noteCount ?? 0,
                    })
                  }
                >
                  Apply to filters
                </button>
              ) : null}
            </div>
            {smartResult ? (
              <div className="mt-4 space-y-3 rounded-xl border border-base-300/60 bg-base-100/90 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-base-content">
                    {smartResult.noteCount ?? 0} matching notes
                  </div>
                  {smartViewSummary?.matchedTag ? (
                    <span className="badge badge-outline badge-sm">
                      #{smartViewSummary.matchedTag}
                    </span>
                  ) : null}
                </div>
                {Array.isArray(smartResult.notes) &&
                smartResult.notes.length ? (
                  <ul className="space-y-2">
                    {smartResult.notes.slice(0, 6).map((preview: any) => (
                      <li
                        key={preview.id}
                        className="rounded-lg border border-base-300/50 bg-base-100 p-3 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-base-content">
                            {preview.title || "Untitled note"}
                          </span>
                          {preview.notebook?.name ? (
                            <span className="badge badge-outline badge-xs">
                              {preview.notebook.name}
                            </span>
                          ) : null}
                        </div>
                        {Array.isArray(preview.tags) && preview.tags.length ? (
                          <div className="mt-1 flex flex-wrap items-center gap-1 text-[11px] text-base-content/60">
                            {preview.tags.slice(0, 4).map((tag: string) => (
                              <span key={tag} className="badge badge-xs">
                                #{tag}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-base-content/60">
                    No preview notes found yet.
                  </p>
                )}
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}

export default NotebookInsightsDrawer;
