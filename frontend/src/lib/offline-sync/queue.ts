import type { AxiosError, InternalAxiosRequestConfig } from "axios";
import api from "../axios";
import { extractApiError } from "../extractApiError";
import {
  cacheMutation,
  listMutations,
  removeMutation,
  setMetadata,
  setNotebookSyncMetadata,
  storeNotebooks,
  storeNotes,
  updateMutation,
  type NotebookSyncMetadata,
  type NotebookSyncPayload,
  type OfflineMutation,
  type SyncOperation,
} from "../offlineDB";
import { pushNotebookSyncState } from "../notebookSyncClient";
import { normalizeUrl, toSerializable } from "./helpers";
import {
  ensureNotebookSyncSession,
  refreshNotebookSnapshot,
} from "./notebookSync";
import {
  notifyStatus,
  setIsSyncing,
  setLastError,
  setLastSyncedAt,
  setQueueLength,
} from "./state";

export interface OfflineAxiosConfig extends InternalAxiosRequestConfig {
  offlineSync?: NotebookSyncPayload | null;
}

interface NotebookBucket {
  entries: OfflineMutation[];
  operations: SyncOperation[];
}

export const recordQueueLength = async (): Promise<OfflineMutation[]> => {
  const mutations = await listMutations();
  setQueueLength(mutations.length);
  return mutations;
};

export const cacheDomainData = async (
  config: InternalAxiosRequestConfig,
  data: Record<string, unknown>,
): Promise<void> => {
  let path = "";
  try {
    path = new URL(normalizeUrl(config)).pathname;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn("[offline] failed to parse path", error);
    }
    return;
  }
  if (path.startsWith("/notebooks")) {
    const notebooks = data?.notebooks;
    if (Array.isArray(notebooks)) {
      await storeNotebooks(
        notebooks.map((notebook: Record<string, unknown>) => ({
          ...notebook,
          id: notebook.id as string,
          revision: (notebook.updatedAt ?? notebook.id) as string,
        })),
      );
    } else if (data?.id) {
      await storeNotebooks([
        {
          ...data,
          id: data.id as string,
          revision: (data.updatedAt ?? data.id) as string,
        },
      ]);
    }
  }
  if (path.startsWith("/notes")) {
    const notes = data?.notes;
    if (Array.isArray(notes)) {
      await storeNotes(
        notes.map((note: Record<string, unknown>) => ({
          ...note,
          id: note.id as string,
          notebookId: (note.notebookId as string) ?? null,
          revision: (note.updatedAt ?? note.id) as string,
        })),
      );
    } else if (data?.id) {
      await storeNotes([
        {
          ...data,
          id: data.id as string,
          notebookId: (data.notebookId as string) ?? null,
          revision: (data.updatedAt ?? data.id) as string,
        },
      ]);
    }
  }
};

export const queueMutation = async (
  config: OfflineAxiosConfig,
): Promise<OfflineMutation | null> => {
  const mutation = await cacheMutation({
    method: (config.method ?? "get").toLowerCase(),
    url: normalizeUrl(config),
    data: toSerializable(config.data),
    headers: toSerializable(config.headers) as Record<string, string>,
    versionStamp:
      (config.headers as Record<string, string>)?.["x-revision"] ??
      (config.headers as Record<string, string>)?.["if-match"] ??
      (typeof config.data === "object" && config.data
        ? (((config.data as Record<string, unknown>).updatedAt as string) ??
          ((config.data as Record<string, unknown>).revision as string) ??
          null)
        : null),
    sync: config.offlineSync ?? null,
  });
  delete config.offlineSync;
  await recordQueueLength();
  notifyStatus();
  return mutation;
};

const replayMutation = async (entry: OfflineMutation): Promise<void> => {
  const requestConfig = {
    method: entry.method,
    url: entry.url,
    data: entry.data,
    headers: {
      ...(entry.headers as Record<string, string>),
      "x-offline-replay": "1",
      "x-offline-revision": entry.versionStamp ?? undefined,
    },
  };
  await api.request(requestConfig);
};

const recordReplayFailure = async (
  entry: OfflineMutation,
  error: unknown,
): Promise<string> => {
  const axiosErr = error as AxiosError<{ message?: string }>;
  const errorMessage = extractApiError(
    axiosErr,
    axiosErr?.message ?? "Unknown error",
  );
  const timestamp = new Date().toISOString();
  await updateMutation(entry.id!, {
    attempts: (entry.attempts ?? 0) + 1,
    lastError: errorMessage,
    lastAttemptAt: timestamp,
  });
  return errorMessage;
};

const flushNotebookBucket = async (
  notebookId: string,
  bucket: NotebookBucket,
): Promise<{ failure: boolean; conflict: boolean }> => {
  if (!bucket.operations.length) {
    for (const entry of bucket.entries) {
      await removeMutation(entry.id!);
    }
    return { failure: false, conflict: false };
  }

  const session = await ensureNotebookSyncSession(notebookId);
  if (!session) {
    for (const entry of bucket.entries) {
      try {
        await replayMutation(entry);
        await removeMutation(entry.id!);
        setLastError(null);
      } catch (error) {
        const errorMessage = await recordReplayFailure(entry, error);
        setLastError(errorMessage);
        return { failure: true, conflict: false };
      }
    }
    return { failure: false, conflict: false };
  }

  try {
    const payload = {
      clientId: session.clientId,
      baseRevision: session.revision ?? 0,
      operations: bucket.operations,
    };

    const response = await pushNotebookSyncState(notebookId, payload);
    const nextMetadata: NotebookSyncMetadata = {
      clientId: session.clientId,
      revision: (response?.revision as number) ?? session.revision ?? 0,
      snapshotHash:
        (response?.snapshotHash as string) ?? session.snapshotHash ?? null,
      lastSyncedAt:
        (response?.serverTime as string) ?? new Date().toISOString(),
    };
    await setNotebookSyncMetadata(notebookId, nextMetadata);

    await refreshNotebookSnapshot(notebookId, session.clientId);

    for (const entry of bucket.entries) {
      await removeMutation(entry.id!);
    }
    setLastError(null);
    return { failure: false, conflict: false };
  } catch (error) {
    const axiosErr = error as AxiosError<{ message?: string }>;
    const errorMessage = extractApiError(
      axiosErr,
      axiosErr?.message ?? "Unknown sync error",
    );
    const timestamp = new Date().toISOString();

    for (const entry of bucket.entries) {
      await updateMutation(entry.id!, {
        attempts: (entry.attempts ?? 0) + 1,
        lastError: errorMessage,
        lastAttemptAt: timestamp,
      });
    }

    setLastError(errorMessage);

    const conflict = axiosErr?.response?.status === 409;
    if (conflict) {
      await refreshNotebookSnapshot(notebookId, session.clientId);
    }

    return { failure: true, conflict };
  }
};

export const flushQueue = async (): Promise<void> => {
  const mutations = await recordQueueLength();
  if (!mutations.length) {
    setIsSyncing(false);
    setLastError(null);
    const timestamp = new Date().toISOString();
    setLastSyncedAt(timestamp);
    await setMetadata("lastSyncedAt", timestamp);
    notifyStatus();
    return;
  }

  if (!navigator.onLine) {
    notifyStatus();
    return;
  }

  setIsSyncing(true);
  notifyStatus();

  const regularMutations: OfflineMutation[] = [];
  const notebookMutations = new Map<string, NotebookBucket>();

  for (const entry of mutations) {
    if (entry?.sync?.type === "notebook" && entry.sync?.notebookId) {
      const bucket = notebookMutations.get(entry.sync.notebookId) ?? {
        entries: [],
        operations: [],
      };
      const operations = Array.isArray(entry.sync.operations)
        ? entry.sync.operations.filter(Boolean)
        : [];
      if (operations.length) {
        bucket.operations.push(...operations);
      }
      bucket.entries.push(entry);
      notebookMutations.set(entry.sync.notebookId, bucket);
    } else {
      regularMutations.push(entry);
    }
  }

  let failure = false;

  for (const entry of regularMutations) {
    try {
      await replayMutation(entry);
      await removeMutation(entry.id!);
      setLastError(null);
    } catch (error) {
      const errorMessage = await recordReplayFailure(entry, error);
      setLastError(errorMessage);
      failure = true;
      break;
    }
  }

  if (!failure) {
    for (const [notebookId, bucket] of notebookMutations.entries()) {
      const result = await flushNotebookBucket(notebookId, bucket);
      if (result.failure) {
        failure = true;
        break;
      }
    }
  }

  await recordQueueLength();
  setIsSyncing(false);
  if (!failure) {
    const timestamp = new Date().toISOString();
    setLastSyncedAt(timestamp);
    await setMetadata("lastSyncedAt", timestamp);
  }
  notifyStatus();
};
