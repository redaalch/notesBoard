import { useQuery } from "@tanstack/react-query";
import api from "../../lib/axios";

// Loose analytics response: the controller returns a deeply nested record
// whose shape varies by slice. Consumers inspect many optional paths.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type NotebookAnalyticsResponse = any;

export interface FetchNotebookAnalyticsParams {
  notebookId: string;
  range: string;
  slice?: string;
}

export interface UseNotebookAnalyticsQueryParams {
  notebookId: string | null;
  range: string;
  slice?: string;
  enabled: boolean;
}

export const fetchNotebookAnalytics = async ({
  notebookId,
  range,
  slice,
}: FetchNotebookAnalyticsParams): Promise<NotebookAnalyticsResponse> => {
  const endpoint = slice
    ? `/notebooks/${notebookId}/analytics/${slice}`
    : `/notebooks/${notebookId}/analytics`;
  const response = await api.get(endpoint, {
    params: { range },
  });
  return response.data;
};

export const useNotebookAnalyticsQuery = ({
  notebookId,
  range,
  slice,
  enabled,
}: UseNotebookAnalyticsQueryParams) =>
  useQuery<NotebookAnalyticsResponse>({
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
