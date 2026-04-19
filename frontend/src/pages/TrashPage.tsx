import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeftIcon, RotateCcwIcon, Trash2Icon } from "lucide-react";

import Navbar from "../Components/Navbar";
import api from "../lib/axios";
import { extractApiError } from "../lib/sanitize";

interface TrashedNote {
  _id: string;
  title: string;
  contentText: string;
  tags: string[];
  notebookId: string | null;
  workspaceId: string | null;
  deletedAt: string | null;
  purgeAt: string | null;
  updatedAt: string | null;
}

interface TrashResponse {
  notes: TrashedNote[];
  retentionDays: number;
}

const formatRelative = (iso: string | null): string => {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diffMs = then - Date.now();
  const abs = Math.abs(diffMs);
  const days = Math.floor(abs / (24 * 60 * 60 * 1000));
  const hours = Math.floor(abs / (60 * 60 * 1000));
  const mins = Math.floor(abs / (60 * 1000));
  if (diffMs < 0) {
    if (days >= 1) return `${days}d ago`;
    if (hours >= 1) return `${hours}h ago`;
    if (mins >= 1) return `${mins}m ago`;
    return "just now";
  }
  if (days >= 1) return `in ${days}d`;
  if (hours >= 1) return `in ${hours}h`;
  if (mins >= 1) return `in ${mins}m`;
  return "soon";
};

const TrashPage = () => {
  const queryClient = useQueryClient();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const trashQuery = useQuery({
    queryKey: ["notes", "trash"],
    queryFn: async () => {
      const { data } = await api.get<TrashResponse>("/notes/trash");
      return data;
    },
    staleTime: 30_000,
  });

  const restoreMutation = useMutation({
    mutationFn: async (id: string) => {
      setPendingId(id);
      await api.post(`/notes/trash/${id}/restore`);
      return id;
    },
    onSuccess: () => {
      toast.success("Note restored");
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      queryClient.invalidateQueries({ queryKey: ["notebooks"] });
    },
    onError: (error) => toast.error(extractApiError(error, "Failed to restore")),
    onSettled: () => setPendingId(null),
  });

  const purgeMutation = useMutation({
    mutationFn: async (id: string) => {
      setPendingId(id);
      await api.delete(`/notes/trash/${id}`);
      return id;
    },
    onSuccess: () => {
      toast.success("Note permanently deleted");
      queryClient.invalidateQueries({ queryKey: ["notes", "trash"] });
    },
    onError: (error) => toast.error(extractApiError(error, "Failed to delete")),
    onSettled: () => setPendingId(null),
  });

  const emptyMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.delete<{ purged: number }>("/notes/trash");
      return data.purged ?? 0;
    },
    onSuccess: (count) => {
      toast.success(
        count ? `${count} note${count === 1 ? "" : "s"} permanently deleted` : "Trash is empty",
      );
      queryClient.invalidateQueries({ queryKey: ["notes", "trash"] });
    },
    onError: (error) => toast.error(extractApiError(error, "Failed to empty trash")),
  });

  const notes = useMemo(() => trashQuery.data?.notes ?? [], [trashQuery.data]);
  const retentionDays = trashQuery.data?.retentionDays ?? 30;

  const handleConfirmPurge = (id: string, title: string) => {
    const ok = window.confirm(
      `Permanently delete "${title || "this note"}"? This cannot be undone.`,
    );
    if (ok) purgeMutation.mutate(id);
  };

  const handleEmptyTrash = () => {
    if (!notes.length) return;
    const ok = window.confirm(
      `Permanently delete all ${notes.length} note${notes.length === 1 ? "" : "s"} in trash? This cannot be undone.`,
    );
    if (ok) emptyMutation.mutate();
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto w-full max-w-5xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link
              to="/app"
              className="inline-flex items-center gap-1 text-sm text-base-content/60 hover:text-base-content"
            >
              <ArrowLeftIcon className="size-4" /> Back to notes
            </Link>
            <h1 className="mt-2 text-2xl font-semibold">Trash</h1>
            <p className="text-sm text-base-content/60">
              Notes are permanently deleted {retentionDays} days after they are
              moved here.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-sm btn-ghost text-error"
            onClick={handleEmptyTrash}
            disabled={!notes.length || emptyMutation.isPending}
          >
            {emptyMutation.isPending ? (
              <span className="loading loading-spinner loading-xs" />
            ) : (
              <Trash2Icon className="size-4" />
            )}
            Empty trash
          </button>
        </div>

        {trashQuery.isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="h-20 animate-pulse rounded-2xl bg-base-200/80"
              />
            ))}
          </div>
        ) : trashQuery.isError ? (
          <div className="rounded-2xl border border-error/30 bg-error/10 p-6 text-sm text-error">
            Failed to load trash.{" "}
            <button
              className="link"
              type="button"
              onClick={() => trashQuery.refetch()}
            >
              Retry
            </button>
          </div>
        ) : notes.length === 0 ? (
          <div className="rounded-2xl border border-base-content/10 bg-base-100/60 p-10 text-center">
            <Trash2Icon className="mx-auto size-10 text-base-content/30" />
            <p className="mt-3 text-sm text-base-content/60">
              Trash is empty. Deleted notes will appear here.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {notes.map((note) => {
              const busy = pendingId === note._id;
              return (
                <li
                  key={note._id}
                  className="rounded-2xl border border-base-content/10 bg-base-100/80 p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate text-base font-semibold text-base-content">
                        {note.title || "Untitled"}
                      </h2>
                      {note.contentText && (
                        <p className="mt-1 line-clamp-2 text-sm text-base-content/60">
                          {note.contentText}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-base-content/50">
                        <span>Deleted {formatRelative(note.deletedAt)}</span>
                        {note.purgeAt && (
                          <span>• Auto-purge {formatRelative(note.purgeAt)}</span>
                        )}
                        {note.tags.length > 0 && (
                          <span className="flex gap-1">
                            {note.tags.slice(0, 3).map((tag) => (
                              <span
                                key={tag}
                                className="rounded-full bg-base-200 px-2 py-0.5"
                              >
                                #{tag}
                              </span>
                            ))}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        className="btn btn-sm btn-ghost"
                        onClick={() => restoreMutation.mutate(note._id)}
                        disabled={busy}
                      >
                        {busy && restoreMutation.isPending ? (
                          <span className="loading loading-spinner loading-xs" />
                        ) : (
                          <RotateCcwIcon className="size-4" />
                        )}
                        Restore
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-ghost text-error"
                        onClick={() => handleConfirmPurge(note._id, note.title)}
                        disabled={busy}
                      >
                        {busy && purgeMutation.isPending ? (
                          <span className="loading loading-spinner loading-xs" />
                        ) : (
                          <Trash2Icon className="size-4" />
                        )}
                        Delete
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
};

export default TrashPage;
