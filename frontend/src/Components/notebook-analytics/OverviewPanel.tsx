import { useEffect } from "react";
import {
  ActivityIcon,
  BarChart3Icon,
  CalendarIcon,
  TagIcon,
  UsersIcon,
} from "lucide-react";
import { extractApiError } from "../../lib/extractApiError";
import { formatDate, formatRelativeTime, formatTagLabel } from "../../lib/Utils";
import Sparkline from "../Sparkline";
import { EmptyState, ErrorState, LoadingState } from "./AnalyticsStates";
import {
  useNotebookAnalyticsQuery,
  type NotebookAnalyticsResponse,
} from "./useNotebookAnalyticsQuery";

interface OverviewPanelProps {
  notebookId: string;
  range: string;
  onDataChange?: (data: NotebookAnalyticsResponse | undefined) => void;
}

function OverviewPanel({ notebookId, range, onDataChange }: OverviewPanelProps) {
  const query = useNotebookAnalyticsQuery({
    notebookId,
    range,
    enabled: true,
  });

  useEffect(() => {
    onDataChange?.(query.data);
  }, [query.data, onDataChange]);

  if (query.isLoading) {
    return <LoadingState />;
  }

  if (query.isError) {
    return (
      <ErrorState
        message={extractApiError(query.error, "Unable to load analytics")}
        onRetry={() => query.refetch()}
      />
    );
  }

  const data = query.data;
  if (!data) {
    return <EmptyState message="Analytics are not available yet." />;
  }

  const notesDaily = Array.isArray(data.metrics?.notesCreated?.daily)
    ? data.metrics.notesCreated.daily.map((entry: { count: number }) => entry.count)
    : [];
  const notesWeekly = Array.isArray(data.metrics?.notesCreated?.weekly)
    ? data.metrics.notesCreated.weekly.map((entry: { count: number }) => entry.count)
    : [];
  const totalNotesCreated = data.metrics?.notesCreated?.total ?? 0;
  const topTags: { tag: string; count: number }[] = Array.isArray(
    data.metrics?.topTags,
  )
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
              {topTags.map((entry) => (
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
}

export default OverviewPanel;
