#!/usr/bin/env node
import mongoose from "mongoose";

import "../config/env.js";
import { connectDb } from "../config/db.js";
import Notebook from "../models/Notebook.js";
import logger from "../utils/logger.js";
import {
  addUtcDays,
  startOfUtcDay,
} from "../services/notebookAnalyticsShared.js";
import { collectNotebookSnapshotsForRange } from "../services/notebookAnalyticsSnapshotService.js";
import { getNotebookAnalyticsOverview } from "../services/notebookAnalyticsService.js";

const DEFAULT_WARM_RANGES = ["7d", "30d"];

const parseCliArgs = () => {
  const options = {
    days: Number.parseInt(
      process.env.NOTEBOOK_ANALYTICS_SNAPSHOT_DAYS ?? "1",
      10
    ),
    warmRanges: DEFAULT_WARM_RANGES,
  };

  process.argv.slice(2).forEach((arg) => {
    if (arg.startsWith("--days=")) {
      const value = Number.parseInt(arg.split("=")[1], 10);
      if (Number.isFinite(value) && value > 0) {
        options.days = value;
      }
    }
    if (arg.startsWith("--warm=")) {
      const value = arg.split("=")[1];
      if (value) {
        options.warmRanges = value.split(",").map((item) => item.trim());
      }
    }
  });

  if (!Number.isFinite(options.days) || options.days <= 0) {
    options.days = 1;
  }

  return options;
};

const warmCacheForNotebook = async (notebookId, ownerId, ranges) => {
  for (const range of ranges) {
    try {
      await getNotebookAnalyticsOverview({
        notebookId,
        range,
        ownerId,
        viewerContext: null,
        memo: null,
      });
    } catch (error) {
      logger.warn("Failed to warm analytics cache", {
        notebookId,
        range,
        error: error.message,
      });
    }
  }
};

const run = async () => {
  const { days, warmRanges } = parseCliArgs();
  await connectDb();

  const endExclusive = startOfUtcDay(new Date());
  const startDate = addUtcDays(endExclusive, -days);

  const cursor = Notebook.find(
    {},
    { _id: 1, owner: 1, workspaceId: 1 }
  ).cursor();
  let processed = 0;
  let snapshotCount = 0;

  for await (const notebook of cursor) {
    processed += 1;

    try {
      const snapshots = await collectNotebookSnapshotsForRange({
        notebookId: notebook._id,
        startDate,
        endExclusive,
        notebook,
      });
      snapshotCount += snapshots.length;
      await warmCacheForNotebook(notebook._id, notebook.owner, warmRanges);
    } catch (error) {
      logger.error("Notebook snapshot generation failed", {
        notebookId: notebook._id,
        error: error.message,
      });
    }
  }

  logger.info("Notebook analytics snapshot run complete", {
    processed,
    snapshotCount,
    days,
  });

  await mongoose.disconnect();
  process.exit(0);
};

run().catch((error) => {
  logger.error("Notebook analytics snapshot run aborted", {
    error: error.message,
  });
  mongoose.disconnect().finally(() => process.exit(1));
});
