#!/usr/bin/env node
/**
 * Migration Script – Backfill vector embeddings for all existing notes
 * and print instructions for creating the Atlas Vector Search index.
 *
 * Usage:
 *   node backend/src/scripts/backfillEmbeddings.js
 *
 * Requires GEMINI_API_KEY and MONGO_URI in .env
 */
import "../config/env.js";
import mongoose from "mongoose";
import { dbManager } from "../config/database.js";
import Note from "../models/Note.js";
import {
  embedBatch,
  buildNoteEmbeddingText,
  EMBEDDING_DIMENSIONS,
} from "../services/embeddingService.js";

const BATCH_SIZE = 20;
const DELAY_BETWEEN_BATCHES_MS = 1_200; // rate-limit courtesy

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const run = async () => {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  NotesBoard – Embedding Backfill Migration");
  console.log("═══════════════════════════════════════════════════════════\n");

  if (!process.env.GEMINI_API_KEY) {
    console.error("❌ GEMINI_API_KEY is not set. Aborting.");
    process.exit(1);
  }

  await dbManager.connect();
  console.log("✓ Connected to database\n");

  // Count notes that need embeddings
  const totalNotes = await Note.countDocuments({
    $or: [
      { embedding: { $exists: false } },
      { embedding: null },
      { embedding: { $size: 0 } },
    ],
  });

  console.log(`Found ${totalNotes} notes without embeddings.\n`);

  if (totalNotes === 0) {
    console.log("✓ All notes already have embeddings. Nothing to do.");
    await dbManager.disconnect();
    return;
  }

  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  const cursor = Note.find({
    $or: [
      { embedding: { $exists: false } },
      { embedding: null },
      { embedding: { $size: 0 } },
    ],
  })
    .select({ title: 1, content: 1, contentText: 1, tags: 1 })
    .lean()
    .cursor();

  let batch = [];

  for await (const note of cursor) {
    batch.push(note);

    if (batch.length >= BATCH_SIZE) {
      const results = await processBatch(batch);
      processed += batch.length;
      succeeded += results.succeeded;
      failed += results.failed;
      batch = [];

      const pct = ((processed / totalNotes) * 100).toFixed(1);
      process.stdout.write(
        `\r  Progress: ${processed}/${totalNotes} (${pct}%) – ✓${succeeded} ✗${failed}`,
      );

      await sleep(DELAY_BETWEEN_BATCHES_MS);
    }
  }

  // Process remaining
  if (batch.length > 0) {
    const results = await processBatch(batch);
    processed += batch.length;
    succeeded += results.succeeded;
    failed += results.failed;
  }

  console.log(
    `\n\n✓ Backfill complete: ${succeeded} embedded, ${failed} failed out of ${processed} total.\n`,
  );

  // Print Atlas Vector Search index instructions
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  MongoDB Atlas Vector Search Index Setup");
  console.log("═══════════════════════════════════════════════════════════\n");
  console.log("Create the following index in your Atlas cluster:");
  console.log("  Database:   (your database name)");
  console.log("  Collection: notes");
  console.log("  Index name: note_embedding_index\n");
  console.log("Index definition (JSON):\n");
  console.log(
    JSON.stringify(
      {
        fields: [
          {
            type: "vector",
            path: "embedding",
            numDimensions: EMBEDDING_DIMENSIONS,
            similarity: "cosine",
          },
          {
            type: "filter",
            path: "owner",
          },
          {
            type: "filter",
            path: "notebookId",
          },
          {
            type: "filter",
            path: "workspaceId",
          },
        ],
      },
      null,
      2,
    ),
  );
  console.log(
    "\nYou can create this via the Atlas UI → Search → Create Search Index → JSON Editor.",
  );
  console.log("Choose 'Atlas Vector Search' as the index type.\n");

  await dbManager.disconnect();
};

const processBatch = async (notes) => {
  const texts = notes.map((note) => buildNoteEmbeddingText(note));
  let succeeded = 0;
  let failed = 0;

  try {
    const embeddings = await embedBatch(texts);
    const bulkOps = [];
    const now = new Date();

    for (let i = 0; i < notes.length; i++) {
      if (embeddings[i]) {
        bulkOps.push({
          updateOne: {
            filter: { _id: notes[i]._id },
            update: {
              $set: {
                embedding: embeddings[i],
                embeddingUpdatedAt: now,
              },
            },
          },
        });
        succeeded++;
      } else {
        failed++;
      }
    }

    if (bulkOps.length > 0) {
      await Note.bulkWrite(bulkOps, { ordered: false });
    }
  } catch (error) {
    console.error(`\n  Batch error: ${error.message}`);
    failed += notes.length;
  }

  return { succeeded, failed };
};

run().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
