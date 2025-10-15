import cron from "node-cron";

import Notebook from "../models/Notebook.js";
import NotebookAnalyticsSnapshot from "../models/NotebookAnalyticsSnapshot.js";
import logger from "../utils/logger.js";
import {
  addUtcDays,
  startOfUtcDay,
} from "../services/notebookAnalyticsShared.js";
import {
  collectNotebookSnapshotsForRange,
  upsertNotebookSnapshot,
} from "../services/notebookAnalyticsSnapshotService.js";

const DEFAULT_CRON = "30 2 * * *"; // 02:30 UTC daily
const DEFAULT_RETENTION_DAYS = 365;

const resolveRetentionDays = () => {
  const raw = process.env.NOTEBOOK_ANALYTICS_RETENTION_DAYS;
  const parsed = Number.parseInt(raw ?? String(DEFAULT_RETENTION_DAYS), 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_RETENTION_DAYS;
  }

  return parsed;
};

const clampBackfillWindow = (days) => {
  const retention = resolveRetentionDays();
  const parsed = Number.parseInt(days ?? retention, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return Math.min(retention, DEFAULT_RETENTION_DAYS);
  }
  return Math.min(parsed, retention);
};

export const runDailySnapshotJob = async ({ targetDate } = {}) => {
  const retentionDays = resolveRetentionDays();
  const snapshotDate = startOfUtcDay(
    targetDate ?? addUtcDays(startOfUtcDay(new Date()), -1)
  );
  const endExclusive = addUtcDays(snapshotDate, 1);

  let processed = 0;
  const errors = [];

  const cursor = Notebook.find(
    {},
    { _id: 1, workspaceId: 1, owner: 1 }
  ).cursor();

  for await (const notebook of cursor) {
    try {
      await upsertNotebookSnapshot({
        notebookId: notebook._id,
        notebook,
        date: snapshotDate,
        viewerContext: null,
      });
      processed += 1;
    } catch (error) {
      const payload = {
        notebookId: notebook._id.toString(),
        message: error?.message,
      };
      logger.error("Failed to upsert notebook analytics snapshot", payload);
      errors.push(payload);
    }
  }

  const retentionCutoff = addUtcDays(snapshotDate, -retentionDays);

  try {
    await NotebookAnalyticsSnapshot.deleteMany({
      date: { $lt: retentionCutoff },
    });
  } catch (error) {
    logger.error("Failed to prune notebook analytics snapshots", {
      message: error?.message,
      retentionCutoff,
    });
  }

  logger.info("Notebook analytics snapshot job completed", {
    processed,
    snapshotDate,
    errors: errors.length,
  });

  return { processed, errors, snapshotDate, endExclusive };
};

export const triggerSnapshotBackfill = async ({
  notebookId,
  days,
  viewerContext = null,
} = {}) => {
  const targetDays = clampBackfillWindow(days);
  const endExclusive = addUtcDays(startOfUtcDay(new Date()), 1);
  const startDate = addUtcDays(endExclusive, -targetDays);

  await collectNotebookSnapshotsForRange({
    notebookId,
    startDate,
    endExclusive,
    viewerContext,
  });

  return { notebookId, days: targetDays, startDate, endExclusive };
};

let scheduledJob;

export const scheduleNotebookSnapshotJob = () => {
  if (process.env.DISABLE_ANALYTICS_CRON === "true") {
    logger.info("Notebook analytics cron disabled via configuration");
    return null;
  }

  if (scheduledJob) {
    return scheduledJob;
  }

  const cronExpr = process.env.NOTEBOOK_ANALYTICS_CRON ?? DEFAULT_CRON;

  scheduledJob = cron.schedule(
    cronExpr,
    async () => {
      try {
        await runDailySnapshotJob({});
      } catch (error) {
        logger.error("Scheduled notebook analytics snapshot job failed", {
          message: error?.message,
        });
      }
    },
    {
      timezone: "UTC",
    }
  );

  logger.info("Notebook analytics snapshot cron scheduled", {
    cronExpr,
  });

  return scheduledJob;
};

export const stopNotebookSnapshotJob = () => {
  if (scheduledJob) {
    scheduledJob.stop();
    scheduledJob = null;
    logger.info("Notebook analytics snapshot cron stopped");
  }
};

export default {
  scheduleNotebookSnapshotJob,
  stopNotebookSnapshotJob,
  runDailySnapshotJob,
  triggerSnapshotBackfill,
};
