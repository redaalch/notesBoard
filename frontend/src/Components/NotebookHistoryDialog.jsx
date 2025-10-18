import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertTriangleIcon,
  ClockIcon,
  GlobeIcon,
  HistoryIcon,
  LoaderIcon,
  MoveIcon,
  NotebookIcon,
  PencilLineIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  SparklesIcon,
  Trash2Icon,
  Undo2Icon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";
import api from "../lib/axios.js";
import { formatDate, formatRelativeTime } from "../lib/Utils.js";

const EVENT_ICON_MAP = {
  "notebook.create": NotebookIcon,
  "notebook.update": PencilLineIcon,
  "notebook.publish": GlobeIcon,
  "notebook.unpublish": GlobeIcon,
  "notebook.delete": Trash2Icon,
  "notebook.move-notes": MoveIcon,
  "notebook.template-export": SparklesIcon,
  "notebook.undo": RotateCcwIcon,
};

const formatEventLabel = (eventType) => {
  if (!eventType) return "Notebook";
  return eventType
    .split(".")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" › ");
};

const describeMetadataHighlights = (event) => {
  const metadata = event?.metadata ?? {};
  const highlights = [];

  if (typeof metadata.summary === "string" && metadata.summary.trim()) {
    highlights.push(metadata.summary.trim());
  }

  if (typeof metadata.description === "string" && metadata.description.trim()) {
    highlights.push(metadata.description.trim());
  }

  if (typeof metadata.noteCount === "number") {
    highlights.push(
      `${metadata.noteCount} note${
        metadata.noteCount === 1 ? "" : "s"
      } affected`
    );
  } else if (Array.isArray(metadata.noteIds)) {
    highlights.push(
      `${metadata.noteIds.length} note${
        metadata.noteIds.length === 1 ? "" : "s"
      } affected`
    );
  }

  if (Array.isArray(metadata.tagsAdded) && metadata.tagsAdded.length) {
    highlights.push(
      `Tags added: ${metadata.tagsAdded
        .slice(0, 3)
        .map((tag) => `#${tag}`)
        .join(", ")}${metadata.tagsAdded.length > 3 ? "…" : ""}`
    );
  }

  if (Array.isArray(metadata.tagsRemoved) && metadata.tagsRemoved.length) {
    highlights.push(
      `Tags removed: ${metadata.tagsRemoved
        .slice(0, 3)
        .map((tag) => `#${tag}`)
        .join(", ")}${metadata.tagsRemoved.length > 3 ? "…" : ""}`
    );
  }

  return highlights;
};

function NotebookHistoryDialog({
  notebook,
  notebooks = [],
  open,
  onClose,
  onUndoSuccess,
}) {
  const [selectedNotebookId, setSelectedNotebookId] = useState(
    notebook?.id ?? null
  );
  const [limit, setLimit] = useState(50);
  const [undoingEventId, setUndoingEventId] = useState(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    setSelectedNotebookId(notebook?.id ?? null);
    setLimit(50);
    setUndoingEventId(null);
  }, [open, notebook?.id]);

  const effectiveNotebookId = selectedNotebookId ?? notebook?.id ?? null;

  const historyQuery = useQuery({
    queryKey: ["notebook-history", effectiveNotebookId, limit],
    enabled: open && Boolean(effectiveNotebookId),
    queryFn: async () => {
      const response = await api.get(
        `/notebooks/${effectiveNotebookId}/history`,
        {
          params: { limit },
        }
      );
      const events = Array.isArray(response.data?.events)
        ? response.data.events
        : [];
      return {
        events,
        hasMore: Boolean(response.data?.hasMore),
      };
    },
    keepPreviousData: true,
  });

  const undoMutation = useMutation({
    mutationFn: async (eventId) => {
      const response = await api.post(
        `/notebooks/${effectiveNotebookId}/history/undo`,
        {
          eventId,
        }
      );
      return response.data;
    },
  });

  const events = historyQuery.data?.events ?? [];
  const hasMore = Boolean(historyQuery.data?.hasMore);

  const undoIsLoading = Boolean(
    undoMutation.isPending ?? undoMutation.isLoading
  );

  const selectedNotebook = useMemo(() => {
    if (!effectiveNotebookId) return notebook ?? null;
    return (
      notebooks.find((entry) => entry?.id === effectiveNotebookId) ??
      (notebook?.id === effectiveNotebookId ? notebook : null)
    );
  }, [effectiveNotebookId, notebook, notebooks]);

  const selectedNotebookName =
    selectedNotebook?.name ?? notebook?.name ?? "Notebook";

  const notebookOptions = useMemo(() => {
    if (!Array.isArray(notebooks) || notebooks.length === 0) {
      return [];
    }
    return notebooks.map((entry) => ({ id: entry.id, name: entry.name }));
  }, [notebooks]);

  const handleUndoEvent = useCallback(
    async (eventId) => {
      if (!eventId || undoIsLoading) return;
      setUndoingEventId(eventId);
      try {
        const result = await undoMutation.mutateAsync(eventId);
        const actionLabel = result?.action
          ? result.action.replace(/([A-Z])/g, " $1").trim()
          : null;
        toast.success(actionLabel ? `Undid ${actionLabel}` : "Undo applied");
        historyQuery.refetch().catch(() => {});
        onUndoSuccess?.({
          notebookId: effectiveNotebookId,
          result,
        });
      } catch (error) {
        const message =
          error?.response?.data?.message ?? "Unable to undo this event";
        toast.error(message);
      } finally {
        setUndoingEventId(null);
      }
    },
    [
      effectiveNotebookId,
      historyQuery,
      onUndoSuccess,
      undoMutation,
      undoIsLoading,
    ]
  );

  const handleLoadMore = useCallback(() => {
    setLimit((current) => Math.min(current + 50, 250));
  }, []);

  const handleRefresh = useCallback(() => {
    historyQuery.refetch().catch(() => {});
  }, [historyQuery]);

  const handleNotebookChange = useCallback((event) => {
    setSelectedNotebookId(event.target.value || null);
    setLimit(50);
    setUndoingEventId(null);
  }, []);

  if (!open || !effectiveNotebookId) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[97] flex items-center justify-center bg-black/40 px-4 py-10 sm:px-6"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl rounded-[28px] border border-base-300/50 bg-base-100/95 px-6 py-6 shadow-2xl backdrop-blur-sm sm:px-8"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold text-base-content">
              History · {selectedNotebookName}
            </h2>
            <p className="text-sm text-base-content/70">
              Review recent notebook activity and undo the latest change when
              needed.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {notebookOptions.length > 1 ? (
              <select
                className="select select-bordered select-sm min-w-[12rem]"
                value={effectiveNotebookId ?? ""}
                onChange={handleNotebookChange}
              >
                {notebookOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            ) : null}
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={handleRefresh}
              disabled={historyQuery.isFetching}
            >
              <RefreshCwIcon
                className={`size-4 ${
                  historyQuery.isFetching ? "animate-spin" : ""
                }`}
              />
              Refresh
            </button>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={onClose}
            >
              <XIcon className="size-4" />
              Close
            </button>
          </div>
        </header>

        {historyQuery.isError ? (
          <div className="mt-6 alert alert-error text-sm">
            <AlertTriangleIcon className="size-4" />
            <span>
              {historyQuery.error?.response?.data?.message ??
                "Unable to load notebook history"}
            </span>
          </div>
        ) : null}

        <section className="mt-6 max-h-[60vh] overflow-y-auto pr-1">
          {historyQuery.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-base-content/70">
              <LoaderIcon className="size-4 animate-spin" /> Loading history…
            </div>
          ) : events.length === 0 ? (
            <div className="rounded-2xl border border-base-300/60 bg-base-200/50 p-6 text-sm text-base-content/70">
              No recent history available yet.
            </div>
          ) : (
            <ol className="space-y-3">
              {events.map((event) => {
                const iconComponent =
                  EVENT_ICON_MAP[event.eventType] ?? HistoryIcon;
                const Icon = iconComponent;
                const createdAt = event.createdAt
                  ? new Date(event.createdAt)
                  : null;
                const undoneAt = event.metadata?.undoneAt
                  ? new Date(event.metadata.undoneAt)
                  : null;
                const alreadyUndone = Boolean(undoneAt);
                const undoDisabled =
                  alreadyUndone || event.eventType === "notebook.undo";
                const highlights = describeMetadataHighlights(event);

                return (
                  <li
                    key={event.id}
                    className="rounded-2xl border border-base-300/60 bg-base-100/90 p-4 shadow-sm"
                  >
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex items-start gap-3">
                          <div className="rounded-xl bg-primary/10 p-2 text-primary">
                            <Icon className="size-5" />
                          </div>
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold text-base-content">
                                {event.summary ??
                                  formatEventLabel(event.eventType)}
                              </p>
                              {alreadyUndone ? (
                                <span className="badge badge-sm badge-outline text-warning">
                                  Undone
                                </span>
                              ) : null}
                            </div>
                            {createdAt ? (
                              <p className="flex items-center gap-1 text-xs text-base-content/60">
                                <ClockIcon className="size-3.5" />
                                {formatRelativeTime(createdAt)} on{" "}
                                {formatDate(createdAt)}
                              </p>
                            ) : null}
                            {undoneAt ? (
                              <p className="text-[11px] text-warning/80">
                                Undone {formatRelativeTime(undoneAt)} on{" "}
                                {formatDate(undoneAt)}
                              </p>
                            ) : null}
                            {highlights.length > 0 ? (
                              <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-base-content/70">
                                {highlights.slice(0, 3).map((line, index) => (
                                  <li key={`${line}-${index}`}>{line}</li>
                                ))}
                              </ul>
                            ) : null}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 self-end sm:self-start">
                          <span className="badge badge-outline badge-sm">
                            {formatEventLabel(event.eventType)}
                          </span>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => handleUndoEvent(event.id)}
                            disabled={undoDisabled || undoIsLoading}
                          >
                            {undoingEventId === event.id ? (
                              <LoaderIcon className="size-4 animate-spin" />
                            ) : (
                              <Undo2Icon className="size-4" />
                            )}
                            Undo
                          </button>
                        </div>
                      </div>
                      {event.metadata?.notes?.length ? (
                        <div className="rounded-xl border border-base-300/50 bg-base-200/50 p-3 text-xs text-base-content/70">
                          <p className="font-semibold text-base-content/80">
                            Notes impacted
                          </p>
                          <ul className="mt-1 space-y-1">
                            {event.metadata.notes
                              .slice(0, 3)
                              .map((note, index) => (
                                <li
                                  key={note.id ?? note.noteId ?? index}
                                  className="truncate"
                                >
                                  • {note.title ?? note.name ?? "Untitled note"}
                                </li>
                              ))}
                          </ul>
                          {event.metadata.notes.length > 3 ? (
                            <p className="mt-1 text-[11px] text-base-content/50">
                              +{event.metadata.notes.length - 3} more
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <footer className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-base-content/60">
            Showing the most recent {events.length} events
            {hasMore ? " · older entries available" : "."}
          </div>
          <div className="flex items-center gap-2">
            {hasMore ? (
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={handleLoadMore}
                disabled={historyQuery.isFetching}
              >
                <HistoryIcon className="size-4" />
                Load older events
              </button>
            ) : null}
          </div>
        </footer>
      </div>
    </div>
  );
}

export default NotebookHistoryDialog;
