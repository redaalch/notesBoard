import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ActivityIcon,
  AlertTriangleIcon,
  BarChart3Icon,
  CalendarIcon,
  LineChartIcon,
  LoaderIcon,
  RefreshCwIcon,
  TagIcon,
  UsersIcon,
  XIcon,
} from "lucide-react";
import {
  NOTEBOOK_ANALYTICS_DEFAULT_RANGE,
  NOTEBOOK_ANALYTICS_RANGE_OPTIONS,
} from "@shared/analyticsTypes";
import api from "../lib/axios";
import { formatDate, formatRelativeTime, formatTagLabel } from "../lib/Utils";
import Sparkline from "./Sparkline";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface NotebookAnalyticsDialogProps {
  notebook: { id?: string; _id?: string; name?: string } | null;
  open: boolean;
  onClose: () => void;
}

export interface Tab {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface FetchNotebookAnalyticsParams {
  notebookId: string;
  range: string;
  slice?: string;
}

interface UseNotebookAnalyticsQueryParams {
  notebookId: string | null;
  range: string;
  slice?: string;
  enabled: boolean;
}

interface LoadingStateProps {
  label?: string;
}

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

interface EmptyStateProps {
  message: string;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const TABS: Tab[] = [
  { id: "overview", label: "Overview", icon: ActivityIcon },
  { id: "activity", label: "Activity", icon: LineChartIcon },
  { id: "tags", label: "Tags", icon: TagIcon },
  { id: "collaborators", label: "Collaborators", icon: UsersIcon },
  { id: "snapshots", label: "Snapshots", icon: BarChart3Icon },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const fetchNotebookAnalytics = async ({
  notebookId,
  range,
  slice,
}: FetchNotebookAnalyticsParams): Promise<any> => {
  const endpoint = slice
    ? `/notebooks/${notebookId}/analytics/${slice}`
    : `/notebooks/${notebookId}/analytics`;
  const response = await api.get(endpoint, {
    params: { range },
  });
  return response.data;
};

const useNotebookAnalyticsQuery = ({
  notebookId,
  range,
  slice,
  enabled,
}: UseNotebookAnalyticsQueryParams) =>
  useQuery<any>({
    queryKey: ["notebook-analytics", slice ?? "overview", notebookId, range],
    enabled: Boolean(enabled && notebookId && range),
    queryFn: () =>
      fetchNotebookAnalytics({
        notebookId: notebookId!,
        range,
        slice,
      }),
    staleTime: 60_000,
  });

/* ------------------------------------------------------------------ */
/*  Internal sub-components                                            */
/* ------------------------------------------------------------------ */

function LoadingState({ label = "Loading analytics…" }: LoadingStateProps) {
  return (
    <div className="flex items-center justify-center rounded-2xl border border-base-300/60 bg-base-200/60 py-12 text-sm text-base-content/70">
      <LoaderIcon className="mr-2 size-5 animate-spin" />
      {label}
    </div>
  );
}

function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="alert alert-error">
      <AlertTriangleIcon className="size-5" />
      <div>
        <h3 className="font-semibold">Unable to load analytics</h3>
        <p className="text-sm">{message ?? "Please try again."}</p>
      </div>
      {onRetry ? (
        <button type="button" className="btn btn-sm" onClick={onRetry}>
          Retry
        </button>
      ) : null}
    </div>
  );
}

function EmptyState({ message }: EmptyStateProps) {
  return (
    <div className="rounded-2xl border border-base-300/60 bg-base-200/50 px-6 py-12 text-center text-sm text-base-content/60">
      {message}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

function NotebookAnalyticsDialog({
  notebook,
  open,
  onClose,
}: NotebookAnalyticsDialogProps) {
  const notebookId = notebook?.id ?? notebook?._id ?? null;
  const notebookName = notebook?.name ?? "Notebook";
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");
  const [range, setRange] = useState(NOTEBOOK_ANALYTICS_DEFAULT_RANGE);

  useEffect(() => {
    if (!open) {
      setActiveTab("overview");
      setRange(NOTEBOOK_ANALYTICS_DEFAULT_RANGE);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setActiveTab("overview");
  }, [notebookId, open]);

  const overviewQuery = useNotebookAnalyticsQuery({
    notebookId,
    range,
    enabled: open && activeTab === "overview",
  });

  const activityQuery = useNotebookAnalyticsQuery({
    notebookId,
    range,
    slice: "activity",
    enabled: open && activeTab === "activity",
  });

  const tagsQuery = useNotebookAnalyticsQuery({
    notebookId,
    range,
    slice: "tags",
    enabled: open && activeTab === "tags",
  });

  const collaboratorsQuery = useNotebookAnalyticsQuery({
    notebookId,
    range,
    slice: "collaborators",
    enabled: open && activeTab === "collaborators",
  });

  const snapshotsQuery = useNotebookAnalyticsQuery({
    notebookId,
    range,
    slice: "snapshots",
    enabled: open && activeTab === "snapshots",
  });

  useEffect(() => {
    if (!open || !notebookId || activeTab !== "overview") return;
    if (!overviewQuery.data) return;
    const slices = ["activity", "tags", "collaborators", "snapshots"];
    slices.forEach((slice) => {
      queryClient.prefetchQuery({
        queryKey: ["notebook-analytics", slice, notebookId, range],
        queryFn: () => fetchNotebookAnalytics({ notebookId, range, slice }),
        staleTime: 60_000,
      });
    });
  }, [open, notebookId, queryClient, overviewQuery.data, range, activeTab]);

  const cacheMeta = overviewQuery.data?.meta?.cache ?? null;
  const generatedAt = overviewQuery.data?.meta?.generatedAt ?? null;

  const headerSubline = useMemo(() => {
    if (!generatedAt) return null;
    const generatedDate = new Date(generatedAt);
    return `Generated ${formatRelativeTime(generatedDate)} (${formatDate(
      generatedDate,
    )})`;
  }, [generatedAt]);

  const handleTabChange = useCallback((tabId: string) => {
    setActiveTab(tabId);
  }, []);

  if (!open || !notebookId) {
    return null;
  }

  const renderOverview = () => {
    if (overviewQuery.isLoading) {
      return <LoadingState />;
    }

    if (overviewQuery.isError) {
      const message = (overviewQuery.error as any)?.response?.data?.message;
      return (
        <ErrorState message={message} onRetry={() => overviewQuery.refetch()} />
      );
    }

    const data = overviewQuery.data;
    if (!data) {
      return <EmptyState message="Analytics are not available yet." />;
    }

    const notesDaily = Array.isArray(data.metrics?.notesCreated?.daily)
      ? data.metrics.notesCreated.daily.map((entry: any) => entry.count)
      : [];
    const notesWeekly = Array.isArray(data.metrics?.notesCreated?.weekly)
      ? data.metrics.notesCreated.weekly.map((entry: any) => entry.count)
      : [];
    const totalNotesCreated = data.metrics?.notesCreated?.total ?? 0;
    const topTags: any[] = Array.isArray(data.metrics?.topTags)
      ? data.metrics.topTags.slice(0, 8)
      : [];
    const notebookRoles: Record<string, number> =
      data.metrics?.collaborators?.notebookRoles ?? {};
    const noteCollaborators: Record<string, number> =
      data.metrics?.collaborators?.noteCollaborators ?? {};
    const lastActivity: string | null = data.metrics?.lastActivity ?? null;
    const lastActivityDisplay = lastActivity
      ? formatRelativeTime(new Date(lastActivity))
      : "No recent activity";
    const lastActivityTitle = lastActivity
      ? formatDate(new Date(lastActivity))
      : undefined;

    const coverage = data.meta?.snapshots?.coverageRatio ?? null;
    const coverageDisplay =
      coverage !== null && coverage !== undefined
        ? `${Math.round(coverage * 100)}%`
        : "–";

    return (
      <div className="space-y-6">
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-base-300/60 bg-base-100 p-5 shadow-sm">
            <div className="flex items-center justify-between text-xs font-semibold uppercase text-base-content/60">
              <span>Notes created</span>
              <ActivityIcon className="size-4 text-primary" />
            </div>
            <div className="mt-3 text-3xl font-bold text-base-content">
              {totalNotesCreated}
            </div>
            <div className="mt-4 h-20">
              <Sparkline data={notesDaily} ariaLabel="Daily notes created" />
            </div>
          </div>
          <div className="rounded-2xl border border-base-300/60 bg-base-100 p-5 shadow-sm">
            <div className="flex items-center justify-between text-xs font-semibold uppercase text-base-content/60">
              <span>Weekly totals</span>
              <BarChart3Icon className="size-4 text-secondary" />
            </div>
            <div className="mt-3 text-3xl font-bold text-base-content">
              {notesWeekly.reduce(
                (sum: number, value: number) => sum + value,
                0,
              )}
            </div>
            <div className="mt-4 h-20">
              <Sparkline
                data={notesWeekly}
                ariaLabel="Weekly notes created"
                strokeClassName="text-secondary"
                fillClassName="text-secondary"
              />
            </div>
          </div>
          <div className="rounded-2xl border border-base-300/60 bg-base-100 p-5 shadow-sm">
            <div className="flex items-center justify-between text-xs font-semibold uppercase text-base-content/60">
              <span>Last activity</span>
              <CalendarIcon className="size-4 text-accent" />
            </div>
            <div
              className="mt-3 text-2xl font-semibold text-base-content"
              title={lastActivityTitle}
            >
              {lastActivityDisplay}
            </div>
            <div className="mt-4 rounded-xl bg-base-200/70 px-4 py-3 text-xs text-base-content/60">
              Snapshot coverage: {coverageDisplay}
              {data.meta?.snapshots?.liveFallbackApplied ? (
                <span className="ml-2 text-warning">(Live fallback used)</span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-base-300/60 bg-base-100 p-5 shadow-sm">
            <div className="flex items-center justify-between text-sm font-semibold text-base-content">
              <span>Top tags</span>
              <TagIcon className="size-4 text-primary" />
            </div>
            {topTags.length ? (
              <ul className="mt-4 space-y-3">
                {topTags.map((entry: any) => (
                  <li
                    key={entry.tag}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="font-medium text-base-content">
                      {formatTagLabel(entry.tag)}
                    </span>
                    <span className="badge badge-sm badge-outline">
                      {entry.count}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-base-content/60">
                No tags captured for this range.
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-base-300/60 bg-base-100 p-5 shadow-sm">
            <div className="flex items-center justify-between text-sm font-semibold text-base-content">
              <span>Collaborators</span>
              <UsersIcon className="size-4 text-secondary" />
            </div>
            <div className="mt-4 space-y-4 text-sm">
              <div>
                <h4 className="text-xs font-semibold uppercase text-base-content/60">
                  Notebook members
                </h4>
                {Object.keys(notebookRoles).length ? (
                  <ul className="mt-2 space-y-1.5">
                    {Object.entries(notebookRoles).map(([role, count]) => (
                      <li
                        key={role}
                        className="flex items-center justify-between"
                      >
                        <span className="capitalize text-base-content">
                          {role}
                        </span>
                        <span className="badge badge-outline badge-sm">
                          {count}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-xs text-base-content/60">
                    No notebook members in this range.
                  </p>
                )}
              </div>
              <div>
                <h4 className="text-xs font-semibold uppercase text-base-content/60">
                  Note collaborators
                </h4>
                {Object.keys(noteCollaborators).length ? (
                  <ul className="mt-2 space-y-1.5">
                    {Object.entries(noteCollaborators).map(([role, count]) => (
                      <li
                        key={role}
                        className="flex items-center justify-between"
                      >
                        <span className="capitalize text-base-content">
                          {role}
                        </span>
                        <span className="badge badge-outline badge-sm">
                          {count}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-xs text-base-content/60">
                    No note collaborators recorded in this range.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderActivity = () => {
    if (activityQuery.isLoading) {
      return <LoadingState />;
    }

    if (activityQuery.isError) {
      const message = (activityQuery.error as any)?.response?.data?.message;
      return (
        <ErrorState message={message} onRetry={() => activityQuery.refetch()} />
      );
    }

    const data = activityQuery.data;
    if (!data) {
      return <EmptyState message="No activity available for this range." />;
    }

    const series: number[] = data.series?.[0]?.data ?? [];
    const labels: string[] = data.labels ?? [];
    const total: number = data.meta?.totals?.notesCreated ?? 0;

    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-base-300/60 bg-base-100 p-5 shadow-sm">
          <div className="flex items-center justify-between text-sm font-semibold text-base-content">
            <span>Daily notes created</span>
            <LineChartIcon className="size-4 text-primary" />
          </div>
          <div className="mt-4 h-40">
            <Sparkline data={series} ariaLabel="Daily notes" />
          </div>
          <p className="mt-4 text-sm text-base-content/60">
            Total in range: <span className="font-semibold">{total}</span>
          </p>
        </div>

        {labels.length ? (
          <div className="rounded-2xl border border-base-300/60 bg-base-100 p-5 shadow-sm">
            <h4 className="text-sm font-semibold text-base-content">
              Recent days
            </h4>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {labels
                .slice(-9)
                .reverse()
                .map((label: string, index: number) => {
                  const value = series[labels.length - 1 - index] ?? 0;
                  return (
                    <li
                      key={label}
                      className="rounded-xl border border-base-200/70 bg-base-200/50 px-4 py-3 text-sm"
                    >
                      <div className="text-xs uppercase text-base-content/60">
                        {label}
                      </div>
                      <div className="text-lg font-semibold text-base-content">
                        {value}
                      </div>
                    </li>
                  );
                })}
            </ul>
          </div>
        ) : null}
      </div>
    );
  };

  const renderTags = () => {
    if (tagsQuery.isLoading) {
      return <LoadingState />;
    }

    if (tagsQuery.isError) {
      const message = (tagsQuery.error as any)?.response?.data?.message;
      return (
        <ErrorState message={message} onRetry={() => tagsQuery.refetch()} />
      );
    }

    const data = tagsQuery.data;
    if (!data || !data.labels?.length) {
      return <EmptyState message="No tagged notes available for this range." />;
    }

    const counts: number[] = data.series?.[0]?.data ?? [];
    const maxCount = Math.max(...counts, 1);

    return (
      <div className="rounded-2xl border border-base-300/60 bg-base-100 p-6 shadow-sm">
        <div className="flex items-center justify-between text-sm font-semibold text-base-content">
          <span>Tag distribution</span>
          <TagIcon className="size-4 text-primary" />
        </div>
        <div className="mt-6 space-y-4">
          {data.labels.map((label: string, index: number) => {
            const value = counts[index] ?? 0;
            const percentage = Math.round((value / maxCount) * 100);
            return (
              <div key={label} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-base-content">
                    {formatTagLabel(label)}
                  </span>
                  <span className="text-xs text-base-content/60">{value}</span>
                </div>
                <div className="h-2 rounded-full bg-base-200">
                  <div
                    className="h-full rounded-full bg-secondary"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderCollaborators = () => {
    if (collaboratorsQuery.isLoading) {
      return <LoadingState />;
    }

    if (collaboratorsQuery.isError) {
      const message = (collaboratorsQuery.error as any)?.response?.data
        ?.message;
      return (
        <ErrorState
          message={message}
          onRetry={() => collaboratorsQuery.refetch()}
        />
      );
    }

    const data = collaboratorsQuery.data;
    if (!data || !data.labels?.length) {
      return (
        <EmptyState message="No collaborator roles recorded for this range." />
      );
    }

    const notebookSeries: number[] | undefined = data.series?.find(
      (entry: any) => entry.label === "notebookRoles",
    )?.data;
    const noteSeries: number[] | undefined = data.series?.find(
      (entry: any) => entry.label === "noteCollaborators",
    )?.data;

    return (
      <div className="rounded-2xl border border-base-300/60 bg-base-100 p-6 shadow-sm">
        <div className="flex items-center justify-between text-sm font-semibold text-base-content">
          <span>Roles across the notebook</span>
          <UsersIcon className="size-4 text-primary" />
        </div>
        <div className="mt-6 overflow-x-auto">
          <table className="table table-sm">
            <thead>
              <tr className="text-xs uppercase text-base-content/60">
                <th>Role</th>
                <th>Notebook members</th>
                <th>Note collaborators</th>
              </tr>
            </thead>
            <tbody>
              {data.labels.map((role: string, index: number) => {
                const notebookCount = notebookSeries?.[index] ?? 0;
                const noteCount = noteSeries?.[index] ?? 0;
                return (
                  <tr key={role}>
                    <td className="capitalize">{role}</td>
                    <td>{notebookCount}</td>
                    <td>{noteCount}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-base-200/70 bg-base-200/50 px-4 py-3 text-sm">
            <p className="text-xs uppercase text-base-content/60">
              Notebook members
            </p>
            <p className="text-lg font-semibold text-base-content">
              {data.meta?.totals?.notebookMembers ?? 0}
            </p>
          </div>
          <div className="rounded-xl border border-base-200/70 bg-base-200/50 px-4 py-3 text-sm">
            <p className="text-xs uppercase text-base-content/60">
              Note collaborations
            </p>
            <p className="text-lg font-semibold text-base-content">
              {data.meta?.totals?.noteCollaborations ?? 0}
            </p>
          </div>
        </div>
      </div>
    );
  };

  const renderSnapshots = () => {
    if (snapshotsQuery.isLoading) {
      return <LoadingState />;
    }

    if (snapshotsQuery.isError) {
      const message = (snapshotsQuery.error as any)?.response?.data?.message;
      return (
        <ErrorState
          message={message}
          onRetry={() => snapshotsQuery.refetch()}
        />
      );
    }

    const data = snapshotsQuery.data;
    if (!data || !data.labels?.length) {
      return (
        <EmptyState message="No snapshot history captured for this range." />
      );
    }

    const notes: number[] | undefined = data.series?.find(
      (entry: any) => entry.label === "notesCreated",
    )?.data;
    const edits: number[] | undefined = data.series?.find(
      (entry: any) => entry.label === "editsCount",
    )?.data;
    const uniqueEditors: number[] | undefined = data.series?.find(
      (entry: any) => entry.label === "uniqueEditors",
    )?.data;
    const details: any[] = data.meta?.details ?? [];
    const missing: string[] = data.meta?.missingDates ?? [];
    const snapshotCoverage: number = data.meta?.snapshots?.coverageRatio ?? 0;

    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-base-300/60 bg-base-100 p-5 shadow-sm">
          <div className="flex items-center justify-between text-sm font-semibold text-base-content">
            <span>Snapshot metrics</span>
            <RefreshCwIcon className="size-4 text-primary" />
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs uppercase text-base-content/60">Coverage</p>
              <p className="text-2xl font-semibold text-base-content">
                {Math.round(snapshotCoverage * 100)}%
              </p>
            </div>
            <div>
              <p className="text-xs uppercase text-base-content/60">
                Missing days
              </p>
              <p className="text-2xl font-semibold text-base-content">
                {missing.length}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase text-base-content/60">
                Snapshots in range
              </p>
              <p className="text-2xl font-semibold text-base-content">
                {data.meta?.snapshots?.total ?? 0}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-base-300/60 bg-base-100 p-5 shadow-sm">
          <h4 className="text-sm font-semibold text-base-content">Trends</h4>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div className="h-28">
              <Sparkline
                data={notes ?? []}
                ariaLabel="Notebook notes created snapshots"
              />
              <p className="mt-2 text-xs text-base-content/60">
                Notes created per day
              </p>
            </div>
            <div className="h-28">
              <Sparkline
                data={edits ?? []}
                ariaLabel="Notebook edits count"
                strokeClassName="text-secondary"
                fillClassName="text-secondary"
              />
              <p className="mt-2 text-xs text-base-content/60">
                Edits captured
              </p>
            </div>
            <div className="h-28">
              <Sparkline
                data={uniqueEditors ?? []}
                ariaLabel="Unique editors per day"
                strokeClassName="text-accent"
                fillClassName="text-accent"
              />
              <p className="mt-2 text-xs text-base-content/60">
                Unique editors
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-base-300/60 bg-base-100 p-5 shadow-sm">
          <h4 className="text-sm font-semibold text-base-content">
            Recent snapshot details
          </h4>
          {details.length ? (
            <div className="mt-4 overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr className="text-xs uppercase text-base-content/60">
                    <th>Date</th>
                    <th>Notes</th>
                    <th>Edits</th>
                    <th>Unique editors</th>
                    <th>Top tags</th>
                  </tr>
                </thead>
                <tbody>
                  {details
                    .slice(-10)
                    .reverse()
                    .map((entry: any) => (
                      <tr key={entry.date}>
                        <td>{entry.date}</td>
                        <td>{entry.notesCreated ?? 0}</td>
                        <td>{entry.editsCount ?? 0}</td>
                        <td>{entry.uniqueEditors ?? 0}</td>
                        <td className="max-w-xs">
                          {entry.topTags?.length
                            ? entry.topTags
                                .slice(0, 3)
                                .map(
                                  ({ tag, count }: { tag: string; count: number }) =>
                                    `${formatTagLabel(tag)} (${count})`,
                                )
                                .join(", ")
                            : "—"}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState message="Snapshots are available but contain no detail rows." />
          )}
        </div>
      </div>
    );
  };

  const renderActiveTab = () => {
    switch (activeTab) {
      case "activity":
        return renderActivity();
      case "tags":
        return renderTags();
      case "collaborators":
        return renderCollaborators();
      case "snapshots":
        return renderSnapshots();
      case "overview":
      default:
        return renderOverview();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[97] flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-10 sm:px-6"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl rounded-[36px] border border-base-300/60 bg-base-100/95 px-6 py-6 shadow-2xl backdrop-blur"
        onClick={(event: React.MouseEvent<HTMLDivElement>) =>
          event.stopPropagation()
        }
      >
        <header className="flex flex-col gap-4 border-b border-base-300/40 pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-base-content">
              Analytics for &quot;{notebookName}&quot;
            </h2>
            {headerSubline ? (
              <p className="text-sm text-base-content/60">{headerSubline}</p>
            ) : null}
            {cacheMeta ? (
              <p className="text-xs text-base-content/50">
                Cache {cacheMeta.hit ? "hit" : "miss"}; TTL{" "}
                {cacheMeta.ttlSeconds ? `${cacheMeta.ttlSeconds}s` : "n/a"}
              </p>
            ) : null}
          </div>
          <div className="flex flex-col items-stretch gap-2 sm:w-48">
            <select
              className="select select-bordered select-sm"
              value={range}
              onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
                setRange(event.target.value as typeof range)
              }
            >
              {NOTEBOOK_ANALYTICS_RANGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
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

        <nav className="mt-6 flex flex-wrap gap-2" role="tablist">
          {TABS.map((tab) => {
            const IconComponent = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`btn btn-sm rounded-xl px-4 ${
                  isActive ? "btn-primary" : "btn-outline"
                }`}
                onClick={() => handleTabChange(tab.id)}
              >
                <IconComponent className="size-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>

        <section className="mt-6 space-y-6" role="tabpanel">
          {renderActiveTab()}
        </section>
      </div>
    </div>
  );
}

export default NotebookAnalyticsDialog;
