import { UsersIcon } from "lucide-react";
import { EmptyState, ErrorState, LoadingState } from "./AnalyticsStates";
import { useNotebookAnalyticsQuery } from "./useNotebookAnalyticsQuery";

interface CollaboratorsPanelProps {
  notebookId: string;
  range: string;
}

function CollaboratorsPanel({ notebookId, range }: CollaboratorsPanelProps) {
  const query = useNotebookAnalyticsQuery({
    notebookId,
    range,
    slice: "collaborators",
    enabled: true,
  });

  if (query.isLoading) {
    return <LoadingState />;
  }

  if (query.isError) {
    const message = (
      query.error as {
        response?: { data?: { message?: string } };
      } | null
    )?.response?.data?.message;
    return <ErrorState message={message} onRetry={() => query.refetch()} />;
  }

  const data = query.data;
  if (!data || !data.labels?.length) {
    return (
      <EmptyState message="No collaborator roles recorded for this range." />
    );
  }

  const notebookSeries: number[] | undefined = data.series?.find(
    (entry: { label: string; data: number[] }) =>
      entry.label === "notebookRoles",
  )?.data;
  const noteSeries: number[] | undefined = data.series?.find(
    (entry: { label: string; data: number[] }) =>
      entry.label === "noteCollaborators",
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
}

export default CollaboratorsPanel;
