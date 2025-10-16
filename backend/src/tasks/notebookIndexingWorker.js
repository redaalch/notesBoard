import cron from "node-cron";
import mongoose from "mongoose";
import Note from "../models/Note.js";
import Notebook from "../models/Notebook.js";
import NotebookIndex from "../models/NotebookIndex.js";
import logger from "../utils/logger.js";
import {
  buildNotebookVector,
  computeTagFrequencies,
} from "../utils/textAnalytics.js";

const jobQueue = [];
const enqueuedNotebooks = new Set();
let processing = false;
let changeStream = null;
let backfillTask = null;
let initialized = false;

const normalizeId = (value) => {
  if (!value) return null;
  if (value instanceof mongoose.Types.ObjectId) {
    return value;
  }
  try {
    return new mongoose.Types.ObjectId(String(value));
  } catch (_error) {
    return null;
  }
};

const toKey = (id) => (id ? id.toString() : null);

const safeErrorMessage = (error) => {
  if (!error) return null;
  const message =
    typeof error === "string"
      ? error
      : error?.message || "Unknown indexing error";
  return message.length > 1800 ? `${message.slice(0, 1799)}…` : message;
};

const markJobStatus = async (notebookId, status, updates = {}) => {
  const id = normalizeId(notebookId);
  if (!id) return;

  try {
    await NotebookIndex.updateOne(
      { notebookId: id },
      {
        $set: {
          jobStatus: status,
          ...updates,
        },
      }
    );
  } catch (error) {
    logger.warn("Failed to update notebook index job status", {
      notebookId: id.toString(),
      status,
      message: error?.message,
    });
  }
};

const runNotebookIndexJob = async (job) => {
  const notebookId = normalizeId(job.notebookId);
  if (!notebookId) {
    return;
  }

  const notebook = await Notebook.findById(notebookId)
    .select({ owner: 1, workspaceId: 1 })
    .lean();

  if (!notebook) {
    await NotebookIndex.deleteOne({ notebookId });
    return;
  }

  await markJobStatus(notebookId, "processing", {
    lastJobStartedAt: job.requestedAt,
    lastJobReason: job.reason ?? null,
    lastJobError: null,
  });

  const notes = await Note.find({ notebookId })
    .select({ title: 1, content: 1, contentText: 1, tags: 1 })
    .lean();

  const vectorResult = buildNotebookVector(notes, job.vectorOptions);
  const tagResult = computeTagFrequencies(notes);
  const now = new Date();

  await NotebookIndex.findOneAndUpdate(
    { notebookId },
    {
      $set: {
        ownerId: notebook.owner,
        workspaceId: notebook.workspaceId ?? null,
        vector: vectorResult.vector,
        tagFrequencies: tagResult.tagFrequencies,
        noteCount: notes.length,
        tokenCount: vectorResult.tokenCount,
        distinctTagCount: tagResult.distinctTagCount,
        lastIndexedAt: now,
        lastJobFinishedAt: now,
        jobStatus: "idle",
        lastJobError: null,
        lastJobReason: job.reason ?? null,
        metadata: {
          documents: vectorResult.documentCount,
          distinctTerms: vectorResult.distinctTerms,
          totalTagApplications: tagResult.totalTagApplications,
        },
      },
      $setOnInsert: {},
    },
    {
      upsert: true,
    }
  );
};

const processQueue = async () => {
  if (processing) {
    return;
  }

  const job = jobQueue.shift();
  if (!job) {
    return;
  }

  processing = true;
  const key = toKey(job.notebookId);

  try {
    await runNotebookIndexJob(job);
  } catch (error) {
    const notebookId = normalizeId(job.notebookId);
    const message = safeErrorMessage(error);
    logger.error("Notebook indexing job failed", {
      notebookId: notebookId?.toString() ?? null,
      reason: job.reason,
      message,
    });
    if (notebookId) {
      await markJobStatus(notebookId, "error", {
        lastJobFinishedAt: new Date(),
        lastJobError: message,
        lastJobReason: job.reason ?? null,
      });
    }
  } finally {
    if (key) {
      enqueuedNotebooks.delete(key);
    }
    processing = false;
    setImmediate(processQueue);
  }
};

export const enqueueNotebookIndexJob = async ({
  notebookId,
  reason = "manual",
  force = false,
  vectorOptions = {},
} = {}) => {
  const normalizedId = normalizeId(notebookId);
  if (!normalizedId) {
    return;
  }

  const key = toKey(normalizedId);
  if (!force && enqueuedNotebooks.has(key)) {
    return;
  }

  const notebook = await Notebook.findById(normalizedId)
    .select({ owner: 1, workspaceId: 1 })
    .lean();

  if (!notebook) {
    return;
  }

  const requestedAt = new Date();

  try {
    await NotebookIndex.findOneAndUpdate(
      { notebookId: normalizedId },
      {
        $set: {
          ownerId: notebook.owner,
          workspaceId: notebook.workspaceId ?? null,
          jobStatus: "queued",
          lastJobQueuedAt: requestedAt,
          lastJobReason: reason,
        },
        $setOnInsert: {
          tokenCount: 0,
          noteCount: 0,
        },
      },
      { upsert: true }
    );
  } catch (error) {
    logger.warn("Failed to queue notebook indexing job", {
      notebookId: key,
      reason,
      message: error?.message,
    });
  }

  enqueuedNotebooks.add(key);
  jobQueue.push({
    notebookId: normalizedId,
    reason,
    requestedAt,
    vectorOptions,
  });

  setImmediate(processQueue);
};

const handleNoteChange = (change) => {
  try {
    if (!change) return;

    if (
      change.operationType === "insert" ||
      change.operationType === "update" ||
      change.operationType === "replace"
    ) {
      const notebookId = change.fullDocument?.notebookId;
      if (notebookId) {
        enqueueNotebookIndexJob({ notebookId, reason: "note-change" }).catch(
          (error) => {
            logger.warn("Failed to enqueue notebook index from change stream", {
              message: error?.message,
            });
          }
        );
      }
    }
  } catch (error) {
    logger.warn("Notebook index change stream handler failed", {
      message: error?.message,
    });
  }
};

const startChangeStream = () => {
  if (changeStream) {
    return;
  }

  const connection = mongoose.connection;
  if (!connection?.readyState || connection.readyState !== 1) {
    return;
  }

  try {
    changeStream = Note.watch([], {
      fullDocument: "updateLookup",
    });

    changeStream.on("change", handleNoteChange);
    changeStream.on("error", (error) => {
      logger.warn("Notebook index change stream error", {
        message: error?.message,
      });
      if (changeStream) {
        changeStream.close().catch(() => {});
        changeStream = null;
      }
      setTimeout(startChangeStream, 10000);
    });

    changeStream.on("close", () => {
      changeStream = null;
      setTimeout(startChangeStream, 10000);
    });
  } catch (error) {
    logger.warn("Unable to start notebook index change stream", {
      message: error?.message,
    });
  }
};

const enqueueStaleNotebooks = async () => {
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);

  const stale = await NotebookIndex.find({
    $or: [
      { lastIndexedAt: { $exists: false } },
      { lastIndexedAt: null },
      { lastIndexedAt: { $lt: sixHoursAgo } },
      { jobStatus: "error" },
    ],
  })
    .sort({ lastIndexedAt: 1 })
    .limit(25)
    .lean();

  for (const entry of stale) {
    await enqueueNotebookIndexJob({
      notebookId: entry.notebookId,
      reason: entry.jobStatus === "error" ? "retry" : "stale",
      force: true,
    });
  }

  const indexed = await NotebookIndex.find()
    .select({ notebookId: 1 })
    .sort({ updatedAt: -1 })
    .limit(500)
    .lean();
  const indexedSet = new Set(indexed.map((doc) => doc.notebookId.toString()));

  const recentNotebooks = await Notebook.find()
    .sort({ updatedAt: -1 })
    .limit(100)
    .select({ _id: 1 });

  const missing = recentNotebooks
    .filter((doc) => !indexedSet.has(doc._id.toString()))
    .slice(0, 25);

  for (const notebook of missing) {
    await enqueueNotebookIndexJob({
      notebookId: notebook._id,
      reason: "backfill",
      force: true,
    });
  }
};

const scheduleBackfill = () => {
  if (backfillTask) {
    return;
  }

  backfillTask = cron.schedule("15 * * * *", () => {
    enqueueStaleNotebooks().catch((error) => {
      logger.warn("Failed to enqueue stale notebook indexes", {
        message: error?.message,
      });
    });
  });
};

export const initializeNotebookIndexingWorker = () => {
  if (initialized) {
    return;
  }
  initialized = true;
  startChangeStream();
  scheduleBackfill();
  enqueueStaleNotebooks().catch((error) => {
    logger.warn("Initial notebook index backfill failed", {
      message: error?.message,
    });
  });
};

export const stopNotebookIndexingWorker = async () => {
  if (backfillTask) {
    backfillTask.stop();
    backfillTask = null;
  }

  if (changeStream) {
    try {
      await changeStream.close();
    } catch (error) {
      logger.warn("Failed to close notebook index change stream", {
        message: error?.message,
      });
    }
    changeStream = null;
  }

  initialized = false;
};

export default {
  enqueueNotebookIndexJob,
  initializeNotebookIndexingWorker,
  stopNotebookIndexingWorker,
};
