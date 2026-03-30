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
import {
  embedBatch,
  buildNoteEmbeddingText,
} from "../services/embeddingService.js";

// ── Queue cap to prevent OOM under sustained load ──
const MAX_QUEUE_SIZE = 200;
const NOTE_BATCH_LIMIT = 5_000;

const jobQueue = [];
const enqueuedNotebooks = new Set();
const pendingRejobs = new Set();
let processing = false;
let lastLoggedQueueThreshold = 0;
let changeStream = null;
let backfillTask = null;
let initialized = false;

// Track recent notebookIds from deleted notes so the change-stream delete
// handler can re-index the parent notebook even though fullDocument is null.
const recentNoteNotebookMap = new Map();
const RECENT_MAP_TTL = 5 * 60 * 1000; // 5 minutes

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
      },
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
    .select({
      title: 1,
      content: 1,
      contentText: 1,
      tags: 1,
      embeddingUpdatedAt: 1,
    })
    .limit(NOTE_BATCH_LIMIT)
    .lean();

  if (notes.length === NOTE_BATCH_LIMIT) {
    logger.warn("Notebook note fetch hit limit; index may be incomplete", {
      notebookId: notebookId.toString(),
      limit: NOTE_BATCH_LIMIT,
    });
  }

  const vectorResult = buildNotebookVector(notes, job.vectorOptions);
  const tagResult = computeTagFrequencies(notes);
  const now = new Date();

  // ── Generate per-note embeddings for semantic search ──
  const embeddingStaleThreshold = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const notesNeedingEmbedding = notes.filter(
    (note) =>
      !note.embeddingUpdatedAt ||
      new Date(note.embeddingUpdatedAt) < embeddingStaleThreshold,
  );

  if (notesNeedingEmbedding.length > 0) {
    try {
      const texts = notesNeedingEmbedding.map((note) =>
        buildNoteEmbeddingText(note),
      );

      // Process in batches of 20 (Gemini batch limit)
      const BATCH_SIZE = 20;
      for (let i = 0; i < texts.length; i += BATCH_SIZE) {
        const batchTexts = texts.slice(i, i + BATCH_SIZE);
        const batchNotes = notesNeedingEmbedding.slice(i, i + BATCH_SIZE);
        const embeddings = await embedBatch(batchTexts);

        const bulkOps = [];
        for (let j = 0; j < batchNotes.length; j++) {
          if (embeddings[j]) {
            bulkOps.push({
              updateOne: {
                filter: { _id: batchNotes[j]._id },
                update: {
                  $set: {
                    embedding: embeddings[j],
                    embeddingUpdatedAt: now,
                  },
                },
              },
            });
          }
        }

        if (bulkOps.length > 0) {
          await Note.bulkWrite(bulkOps, { ordered: false });
        }
      }
    } catch (embeddingError) {
      // Embedding failures are non-fatal – TF-IDF index still gets updated
      logger.warn("Note embedding generation failed during indexing", {
        notebookId: notebookId.toString(),
        message: embeddingError?.message,
      });
    }
  }

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
    },
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
  const startMs = Date.now();

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

      // Re-enqueue if a new change arrived while this job was running
      if (pendingRejobs.has(key)) {
        pendingRejobs.delete(key);
        setImmediate(() =>
          enqueueNotebookIndexJob({ notebookId: job.notebookId, reason: "re-index" }).catch(
            (error) => {
              logger.warn("Failed to re-enqueue pending notebook index job", {
                message: error?.message,
              });
            },
          ),
        );
      }
    }
    processing = false;

    // Log queue depth on threshold crossings (25%/50%/75%/100%) rather than modulo
    const thresholds = [0.25, 0.5, 0.75, 1.0].map((p) =>
      Math.floor(p * MAX_QUEUE_SIZE),
    );
    const currentThreshold = thresholds.filter((t) => jobQueue.length >= t).at(-1) ?? 0;
    if (currentThreshold > 0 && currentThreshold !== lastLoggedQueueThreshold) {
      lastLoggedQueueThreshold = currentThreshold;
      logger.info("Notebook indexing queue depth", {
        pending: jobQueue.length,
        thresholdPct: Math.round((currentThreshold / MAX_QUEUE_SIZE) * 100),
        durationMs: Date.now() - startMs,
      });
    } else if (jobQueue.length === 0 && lastLoggedQueueThreshold > 0) {
      lastLoggedQueueThreshold = 0;
    }

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
    pendingRejobs.add(key);
    return;
  }

  // Cap queue size to prevent OOM
  if (jobQueue.length >= MAX_QUEUE_SIZE) {
    logger.warn("Notebook indexing queue full, dropping job", {
      notebookId: key,
      reason,
      queueSize: jobQueue.length,
    });
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
      { upsert: true },
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

// Cache note → notebook mapping for delete events (fullDocument is null on deletes)
const trackNoteNotebook = (noteId, notebookId) => {
  if (!noteId || !notebookId) return;
  const key = noteId.toString();
  recentNoteNotebookMap.set(key, {
    notebookId,
    expiresAt: Date.now() + RECENT_MAP_TTL,
  });
  // Prune stale entries periodically (keep map bounded)
  if (recentNoteNotebookMap.size > 100) {
    const now = Date.now();
    for (const [k, v] of recentNoteNotebookMap) {
      if (v.expiresAt < now) recentNoteNotebookMap.delete(k);
    }
  }
};

const handleNoteChange = (change) => {
  try {
    if (!change) return;

    const opType = change.operationType;

    if (opType === "insert" || opType === "update" || opType === "replace") {
      const notebookId = change.fullDocument?.notebookId;
      if (notebookId) {
        const noteId = change.documentKey?._id;

        // If the note was moved between notebooks, re-index the source notebook too
        const prevEntry = recentNoteNotebookMap.get(noteId?.toString());
        if (prevEntry && prevEntry.notebookId.toString() !== notebookId.toString()) {
          enqueueNotebookIndexJob({
            notebookId: prevEntry.notebookId,
            reason: "note-moved",
          }).catch((error) => {
            logger.warn("Failed to enqueue notebook index for moved note source", {
              message: error?.message,
            });
          });
        }

        // Track mapping for future delete events
        trackNoteNotebook(noteId, notebookId);

        enqueueNotebookIndexJob({ notebookId, reason: "note-change" }).catch(
          (error) => {
            logger.warn("Failed to enqueue notebook index from change stream", {
              message: error?.message,
            });
          },
        );
      }
    } else if (opType === "delete") {
      // fullDocument is null on deletes — use the cached mapping
      const noteId = change.documentKey?._id?.toString();
      const cached = noteId ? recentNoteNotebookMap.get(noteId) : null;
      if (cached) {
        recentNoteNotebookMap.delete(noteId);
        enqueueNotebookIndexJob({
          notebookId: cached.notebookId,
          reason: "note-delete",
        }).catch((error) => {
          logger.warn("Failed to enqueue notebook index from note delete", {
            message: error?.message,
          });
        });
      }
    }
  } catch (error) {
    logger.warn("Notebook index change stream handler failed", {
      message: error?.message,
    });
  }
};

// Exponential backoff for change stream reconnections
const MAX_RECONNECT_DELAY = 5 * 60 * 1000; // 5 minutes
let reconnectDelay = 10_000; // start at 10s
let reconnectTimer = null;

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
      batchSize: 50,
    });

    // Reset backoff on successful connection
    reconnectDelay = 10_000;

    changeStream.on("change", handleNoteChange);
    changeStream.on("error", (error) => {
      logger.warn("Notebook index change stream error", {
        message: error?.message,
      });
      if (changeStream) {
        changeStream.close().catch(() => {});
        changeStream = null;
      }
      scheduleReconnect();
    });

    changeStream.on("close", () => {
      changeStream = null;
      scheduleReconnect();
    });
  } catch (error) {
    logger.warn("Unable to start notebook index change stream", {
      message: error?.message,
    });
  }
};

const scheduleReconnect = () => {
  if (reconnectTimer || !initialized) return;

  // Add jitter (±25%) to prevent thundering herd
  const jitter = reconnectDelay * (0.75 + Math.random() * 0.5);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    startChangeStream();
  }, jitter);

  // Exponential backoff capped at MAX_RECONNECT_DELAY
  reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY);
};

const enqueueStaleNotebooks = async () => {
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);

  // Run stale-index query and missing-index discovery in parallel
  const [stale, missing] = await Promise.all([
    NotebookIndex.find({
      $or: [
        { lastIndexedAt: { $exists: false } },
        { lastIndexedAt: null },
        { lastIndexedAt: { $lt: sixHoursAgo } },
        { jobStatus: "error" },
      ],
    })
      .sort({ lastIndexedAt: 1 })
      .limit(25)
      .lean(),
    // $lookup replaces the distinct("notebookId") + in-memory Set join
    Notebook.aggregate([
      {
        $lookup: {
          from: NotebookIndex.collection.name,
          localField: "_id",
          foreignField: "notebookId",
          as: "idx",
        },
      },
      { $match: { idx: { $size: 0 } } },
      { $sort: { updatedAt: -1 } },
      { $limit: 25 },
      { $project: { _id: 1 } },
    ]),
  ]);

  for (const entry of stale) {
    await enqueueNotebookIndexJob({
      notebookId: entry.notebookId,
      reason: entry.jobStatus === "error" ? "retry" : "stale",
      force: true,
    });
  }

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
  initialized = false;

  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

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

  // Wait for currently-running job to finish (up to 30s)
  if (processing) {
    const deadline = Date.now() + 30_000;
    await new Promise((resolve) => {
      const check = () => {
        if (!processing || Date.now() >= deadline) return resolve();
        setTimeout(check, 250);
      };
      check();
    });
  }

  recentNoteNotebookMap.clear();
};

export default {
  enqueueNotebookIndexJob,
  initializeNotebookIndexingWorker,
  stopNotebookIndexingWorker,
};
