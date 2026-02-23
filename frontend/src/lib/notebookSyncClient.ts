import api from "./axios";

export interface NotebookSyncParams {
  clientId?: string;
  withNotes?: boolean;
}

export interface NotebookSyncState {
  revision?: number;
  snapshotHash?: string | null;
  serverTime?: string;
  notes?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

const withDefaultParams = (
  params: NotebookSyncParams = {},
): NotebookSyncParams => ({
  clientId: params.clientId ?? undefined,
  withNotes: params.withNotes ?? true,
});

export const fetchNotebookSyncState = async (
  notebookId: string,
  params: NotebookSyncParams = {},
): Promise<NotebookSyncState> => {
  if (!notebookId) {
    throw new Error("Notebook id is required");
  }

  const response = await api.get<NotebookSyncState>(
    `/notebooks/${notebookId}/sync`,
    { params: withDefaultParams(params) },
  );

  return response.data ?? {};
};

export const pushNotebookSyncState = async (
  notebookId: string,
  payload: Record<string, unknown>,
): Promise<NotebookSyncState> => {
  if (!notebookId) {
    throw new Error("Notebook id is required");
  }

  const response = await api.post<NotebookSyncState>(
    `/notebooks/${notebookId}/sync`,
    payload,
  );
  return response.data ?? {};
};
