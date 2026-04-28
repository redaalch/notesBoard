import { TagIcon } from "lucide-react";
import { extractApiError } from "../../lib/extractApiError";
import { formatTagLabel } from "../../lib/Utils";
import { EmptyState, ErrorState, LoadingState } from "./AnalyticsStates";
import { useNotebookAnalyticsQuery } from "./useNotebookAnalyticsQuery";

interface TagsPanelProps {
  notebookId: string;
  range: string;
}

function TagsPanel({ notebookId, range }: TagsPanelProps) {
  const query = useNotebookAnalyticsQuery({
    notebookId,
    range,
    slice: "tags",
    enabled: true,
  });

  if (query.isLoading) {
    return <LoadingState />;
  }

  if (query.isError) {
    return (
      <ErrorState
        message={extractApiError(query.error, "Unable to load tags")}
        onRetry={() => query.refetch()}
      />
    );
  }

  const data = query.data;
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
}

export default TagsPanel;
