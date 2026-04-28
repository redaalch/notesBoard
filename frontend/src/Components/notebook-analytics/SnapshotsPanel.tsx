import { RefreshCwIcon } from "lucide-react";
import { extractApiError } from "../../lib/extractApiError";
import { formatTagLabel } from "../../lib/Utils";
import Sparkline from "../Sparkline";
import { EmptyState, ErrorState, LoadingState } from "./AnalyticsStates";
import { useNotebookAnalyticsQuery } from "./useNotebookAnalyticsQuery";

interface SnapshotsPanelProps {
  notebookId: string;
  range: string;
}

interface SnapshotDetail {
  date: string;
  notesCreated?: number;
  editsCount?: number;
  uniqueEditors?: number;
  topTags?: { tag: string; count: number }[];
}

function SnapshotsPanel({ notebookId, range }: SnapshotsPanelProps) {
  const query = useNotebookAnalyticsQuery({
    notebookId,
    range,
    slice: "snapshots",
    enabled: true,
  });

  if (query.isLoading) {
    return <LoadingState />;
  }

  if (query.isError) {
    return (
      <ErrorState
        message={extractApiError(query.error, "Unable to load snapshots")}
        onRetry={() => query.refetch()}
      />
    );
  }

  const data = query.data;
  if (!data || !data.labels?.length) {
    return (
      <EmptyState message="No snapshot history captured for this range." />
    );
  }

  const notes: number[] | undefined = data.series?.find(
    (entry: { label: string; data: number[] }) =>
      entry.label === "notesCreated",
  )?.data;
  const edits: number[] | undefined = data.series?.find(
    (entry: { label: string; data: number[] }) => entry.label === "editsCount",
  )?.data;
  const uniqueEditors: number[] | undefined = data.series?.find(
    (entry: { label: string; data: number[] }) =>
      entry.label === "uniqueEditors",
  )?.data;
  const details: SnapshotDetail[] = data.meta?.details ?? [];
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
            <p className="mt-2 text-xs text-base-content/60">Edits captured</p>
          </div>
          <div className="h-28">
            <Sparkline
              data={uniqueEditors ?? []}
              ariaLabel="Unique editors per day"
              strokeClassName="text-accent"
              fillClassName="text-accent"
            />
            <p className="mt-2 text-xs text-base-content/60">Unique editors</p>
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
                  .map((entry) => (
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
                                ({
                                  tag,
                                  count,
                                }: {
                                  tag: string;
                                  count: number;
                                }) => `${formatTagLabel(tag)} (${count})`,
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
}

export default SnapshotsPanel;
