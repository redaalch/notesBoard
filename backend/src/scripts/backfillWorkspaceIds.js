#!/usr/bin/env node
/**
 * Pre-migration for Board removal.
 *
 * Ensures every Note, NoteHistory, and User that currently relies on Board
 * for workspace resolution has a direct workspaceId/defaultWorkspace so that
 * dropping the Board entity in a later phase does not orphan data.
 *
 * Idempotent: running twice is a no-op. Supports --dry-run.
 *
 *   node src/scripts/backfillWorkspaceIds.js              # apply
 *   node src/scripts/backfillWorkspaceIds.js --dry-run    # report only
 */
import mongoose from "mongoose";

import { connectDb } from "../config/database.js";
import Note from "../models/Note.js";
import NoteHistory from "../models/NoteHistory.js";
import User from "../models/User.js";
import "../config/env.js";

// Board model was deleted in the schema cleanup that this script unblocks.
// Inline a read-only schema so the migration remains runnable against
// databases that still carry the legacy `boards` collection.
const legacyBoardSchema = new mongoose.Schema(
  { workspaceId: mongoose.Schema.Types.ObjectId },
  { strict: false, collection: "boards" },
);
const Board =
  mongoose.models.LegacyBoard ||
  mongoose.model("LegacyBoard", legacyBoardSchema);

const isDryRun = process.argv.includes("--dry-run");

const log = (...args) =>
  console.log(`[${isDryRun ? "dry-run" : "apply"}]`, ...args);

const buildBoardWorkspaceMap = async (boardIds) => {
  if (!boardIds.length) return new Map();
  const boards = await Board.find(
    { _id: { $in: Array.from(boardIds) } },
    { workspaceId: 1 },
  ).lean();
  return new Map(
    boards
      .filter((board) => board.workspaceId)
      .map((board) => [board._id.toString(), board.workspaceId]),
  );
};

const BATCH_SIZE = 500;

const streamBackfill = async (Model, label) => {
  const filter = {
    $and: [
      { $or: [{ workspaceId: null }, { workspaceId: { $exists: false } }] },
      { boardId: { $ne: null } },
    ],
  };

  const cursor = Model.find(filter, { _id: 1, boardId: 1 }).lean().cursor();

  let scanned = 0;
  let updated = 0;
  let missingBoard = 0;

  let batch = [];
  const flush = async () => {
    if (!batch.length) return;
    const boardIds = new Set(
      batch.map((doc) => doc.boardId?.toString()).filter(Boolean),
    );
    const boardMap = await buildBoardWorkspaceMap(boardIds);

    const ops = [];
    for (const doc of batch) {
      const workspaceId = boardMap.get(doc.boardId?.toString());
      if (!workspaceId) {
        missingBoard += 1;
        continue;
      }
      ops.push({
        updateOne: {
          filter: { _id: doc._id },
          update: { $set: { workspaceId } },
        },
      });
      updated += 1;
    }
    if (ops.length && !isDryRun) {
      await Model.bulkWrite(ops, { ordered: false });
    }
    batch = [];
  };

  for await (const doc of cursor) {
    scanned += 1;
    batch.push(doc);
    if (batch.length >= BATCH_SIZE) await flush();
  }
  await flush();

  log(
    `${label}: scanned ${scanned}, would set workspaceId on ${updated}, ` +
      `missing-board ${missingBoard}`,
  );
  return { updated, missingBoard };
};

const backfillNotes = () => streamBackfill(Note, "Notes");
const backfillNoteHistory = () => streamBackfill(NoteHistory, "NoteHistory");

const backfillUsers = async () => {
  const users = await User.find(
    {
      $and: [
        {
          $or: [
            { defaultWorkspace: null },
            { defaultWorkspace: { $exists: false } },
          ],
        },
        { defaultBoard: { $ne: null } },
      ],
    },
    { _id: 1, defaultBoard: 1 },
  ).lean();

  const boardIds = new Set(
    users.map((u) => u.defaultBoard?.toString()).filter(Boolean),
  );
  const boardMap = await buildBoardWorkspaceMap(boardIds);

  let updated = 0;
  let missingBoard = 0;
  const bulk = [];

  for (const user of users) {
    const workspaceId = boardMap.get(user.defaultBoard?.toString());
    if (!workspaceId) {
      missingBoard += 1;
      continue;
    }
    bulk.push({
      updateOne: {
        filter: { _id: user._id },
        update: { $set: { defaultWorkspace: workspaceId } },
      },
    });
    updated += 1;
  }

  if (bulk.length && !isDryRun) {
    await User.bulkWrite(bulk, { ordered: false });
  }

  log(
    `Users: scanned ${users.length}, would set defaultWorkspace on ${updated}, ` +
      `missing-board ${missingBoard}`,
  );
  return { updated, missingBoard };
};

const reportOrphans = async () => {
  const noteOrphans = await Note.countDocuments({
    $and: [
      { $or: [{ workspaceId: null }, { workspaceId: { $exists: false } }] },
      { $or: [{ boardId: null }, { boardId: { $exists: false } }] },
    ],
  });
  const historyOrphans = await NoteHistory.countDocuments({
    $and: [
      { $or: [{ workspaceId: null }, { workspaceId: { $exists: false } }] },
      { $or: [{ boardId: null }, { boardId: { $exists: false } }] },
    ],
  });
  log(
    `Orphans (no workspaceId AND no boardId): notes=${noteOrphans}, ` +
      `history=${historyOrphans}. These will need manual inspection.`,
  );
};

const run = async () => {
  await connectDb();
  log("Starting Board → workspaceId backfill");

  const results = {
    notes: await backfillNotes(),
    history: await backfillNoteHistory(),
    users: await backfillUsers(),
  };

  await reportOrphans();

  log("Summary:", JSON.stringify(results));

  if (isDryRun) {
    log("Dry-run complete. Re-run without --dry-run to apply.");
  } else {
    log("Backfill complete.");
  }

  await mongoose.disconnect();
  process.exit(0);
};

run().catch((error) => {
  console.error("Backfill failed", error);
  process.exit(1);
});
