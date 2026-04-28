import { LineChartIcon } from "lucide-react";
import { extractApiError } from "../../lib/extractApiError";
import Sparkline from "../Sparkline";
import { EmptyState, ErrorState, LoadingState } from "./AnalyticsStates";
import { useNotebookAnalyticsQuery } from "./useNotebookAnalyticsQuery";

interface ActivityPanelProps {
  notebookId: string;
  range: string;
}

function ActivityPanel({ notebookId, range }: ActivityPanelProps) {
  const query = useNotebookAnalyticsQuery({
    notebookId,
    range,
    slice: "activity",
    enabled: true,
  });

  if (query.isLoading) {
    return <LoadingState />;
  }

  if (query.isError) {
    return (
      <ErrorState
        message={extractApiError(query.error, "Unable to load activity")}
        onRetry={() => query.refetch()}
      />
    );
  }

  const data = query.data;
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
}

export default ActivityPanel;
