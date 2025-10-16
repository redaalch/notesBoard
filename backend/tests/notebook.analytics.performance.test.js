import { performance } from "node:perf_hooks";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

import Notebook from "../src/models/Notebook.js";
import Note from "../src/models/Note.js";
import NoteHistory from "../src/models/NoteHistory.js";
import NotebookMember from "../src/models/NotebookMember.js";
import NoteCollaborator from "../src/models/NoteCollaborator.js";
import NotebookAnalyticsSnapshot from "../src/models/NotebookAnalyticsSnapshot.js";
import cacheService from "../src/services/cacheService.js";
import {
  getNotebookAnalyticsOverview,
  getNotebookActivityAnalytics,
  getNotebookTagAnalytics,
  getNotebookCollaboratorAnalytics,
  getNotebookSnapshotAnalytics,
} from "../src/services/notebookAnalyticsService.js";
import { seedNotebookAnalyticsDataset } from "../src/services/notebookAnalyticsFixture.js";

let mongo;

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri(), {
    dbName: "notebookAnalyticsPerformanceTest",
  });
});

afterEach(async () => {
  await Promise.all([
    Note.deleteMany({}),
    NoteHistory.deleteMany({}),
    Notebook.deleteMany({}),
    NotebookMember.deleteMany({}),
    NoteCollaborator.deleteMany({}),
    NotebookAnalyticsSnapshot.deleteMany({}),
  ]);
  cacheService.flush();
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongo) {
    await mongo.stop();
  }
});

describe("notebook analytics performance", () => {
  it("computes overview metrics within the smoke threshold", async () => {
    const seed = await seedNotebookAnalyticsDataset({
      days: 120,
      notesPerDay: 10,
    });

    const startedAt = performance.now();
    const overview = await getNotebookAnalyticsOverview({
      notebookId: seed.notebook._id.toString(),
      range: "365d",
      ownerId: seed.ownerId,
      viewerContext: null,
      memo: null,
    });
    const duration = performance.now() - startedAt;

    expect(duration).toBeLessThan(2000);
    expect(overview.metrics.notesCreated.total).toBe(seed.noteCount);
    expect(overview.metrics.topTags.length).toBeGreaterThan(0);
    expect(overview.metrics.collaborators.notebookRoles.owner).toBe(1);
  });

  it("returns slice analytics under load without exceeding combined budget", async () => {
    const seed = await seedNotebookAnalyticsDataset({
      days: 90,
      notesPerDay: 8,
    });

    const memo = new Map();
    const range = "90d";

    const startedAt = performance.now();
    const [activity, tags, collaborators, snapshots] = await Promise.all([
      getNotebookActivityAnalytics({
        notebookId: seed.notebook._id.toString(),
        range,
        viewerContext: null,
        memo,
      }),
      getNotebookTagAnalytics({
        notebookId: seed.notebook._id.toString(),
        range,
        viewerContext: null,
        memo,
      }),
      getNotebookCollaboratorAnalytics({
        notebookId: seed.notebook._id.toString(),
        ownerId: seed.ownerId,
        viewerContext: null,
        range,
      }),
      getNotebookSnapshotAnalytics({
        notebookId: seed.notebook._id.toString(),
        range,
        memo,
      }),
    ]);
    const duration = performance.now() - startedAt;

    expect(duration).toBeLessThan(2000);
    expect(activity.series[0].data.length).toBeGreaterThan(0);
    expect(tags.series[0].data.length).toBeGreaterThan(0);
    expect(collaborators.series.length).toBe(2);
    expect(snapshots.meta.range.key).toBe(range);
  });
});
