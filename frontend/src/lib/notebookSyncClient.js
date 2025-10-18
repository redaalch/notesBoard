import api from "./axios.js";

const withDefaultParams = (params = {}) => ({
  clientId: params.clientId ?? undefined,
  withNotes: params.withNotes ?? true,
});

export const fetchNotebookSyncState = async (notebookId, params = {}) => {
  if (!notebookId) {
    throw new Error("Notebook id is required");
  }

  const response = await api.get(`/notebooks/${notebookId}/sync`, {
    params: withDefaultParams(params),
  });

  return response.data ?? {};
};

export const pushNotebookSyncState = async (notebookId, payload) => {
  if (!notebookId) {
    throw new Error("Notebook id is required");
  }

  const response = await api.post(`/notebooks/${notebookId}/sync`, payload);
  return response.data ?? {};
};
