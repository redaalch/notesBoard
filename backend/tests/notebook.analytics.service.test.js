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
import { collectNotebookSnapshotsForRange } from "../src/services/notebookAnalyticsSnapshotService.js";
import {
  addUtcDays,
  startOfUtcDay,
} from "../src/services/notebookAnalyticsShared.js";

let mongo;

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri(), {
    dbName: "notebookAnalyticsTest",
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

describe("notebook analytics service", () => {
  it("computes notebook KPIs and caches the response", async () => {
    const ownerId = new mongoose.Types.ObjectId();
    const editorId = new mongoose.Types.ObjectId();
    const collaboratorId = new mongoose.Types.ObjectId();

    const notebook = await Notebook.create({
      owner: ownerId,
      name: "Insights",
    });

    const noteA = await Note.create({
      owner: ownerId,
      notebookId: notebook._id,
      title: "Daily planning",
      content: "Outline",
      tags: ["planning", "daily"],
    });
    const noteB = await Note.create({
      owner: ownerId,
      notebookId: notebook._id,
      title: "Retrospective",
      content: "Weekly review",
      tags: ["retro", "planning"],
    });

    const now = new Date();
    const twoDaysAgo = new Date(now);
    twoDaysAgo.setUTCDate(now.getUTCDate() - 2);
    const threeDaysAgo = new Date(now);
    threeDaysAgo.setUTCDate(now.getUTCDate() - 3);

    await Note.updateOne(
      { _id: noteA._id },
      { $set: { createdAt: threeDaysAgo, updatedAt: threeDaysAgo } }
    );
    await Note.updateOne(
      { _id: noteB._id },
      { $set: { createdAt: twoDaysAgo, updatedAt: twoDaysAgo } }
    );

    const lastActivityDate = new Date(now);
    const history = await NoteHistory.create({
      noteId: noteB._id,
      workspaceId: new mongoose.Types.ObjectId(),
      boardId: new mongoose.Types.ObjectId(),
      actorId: ownerId,
      eventType: "edit",
      updatedAt: lastActivityDate,
    });

    await NoteHistory.updateOne(
      { _id: history._id },
      { $set: { updatedAt: lastActivityDate } }
    );

    const editorMembership = new NotebookMember({
      notebookId: notebook._id,
      userId: editorId,
      role: "editor",
      status: "active",
    });
    editorMembership.setInviteToken(null);
    await editorMembership.save();

    await NoteCollaborator.create({
      noteId: noteA._id,
      userId: collaboratorId,
      invitedBy: ownerId,
      role: "commenter",
    });

    const result = await getNotebookAnalyticsOverview({
      notebookId: notebook._id.toString(),
      range: "7d",
      ownerId,
    });

    const cacheKey = `notebook:${notebook._id.toString()}:analytics:7d`;
    expect(cacheService.has(cacheKey)).toBe(true);

    expect(result.notebookId).toBe(notebook._id.toString());
    expect(result.range.key).toBe("7d");
    expect(result.metrics.notesCreated.total).toBe(2);
    expect(result.metrics.notesCreated.daily.length).toBe(7);
    expect(result.metrics.notesCreated.weekly.length).toBeGreaterThan(0);
    expect(result.metrics.topTags).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ tag: "planning", count: 2 }),
        expect.objectContaining({ tag: "daily", count: 1 }),
      ])
    );
    expect(result.metrics.collaborators.notebookRoles.owner).toBe(1);
    expect(result.metrics.collaborators.notebookRoles.editor).toBe(1);
    expect(result.metrics.collaborators.noteCollaborators.commenter).toBe(1);
    expect(new Date(result.metrics.lastActivity).getTime()).toBeGreaterThan(0);
    expect(result.meta.cache.hit).toBe(false);
    expect(result.meta.snapshots).toEqual(
      expect.objectContaining({ total: 0, missingDays: expect.any(Number) })
    );

    const cachedResult = await getNotebookAnalyticsOverview({
      notebookId: notebook._id.toString(),
      range: "7d",
      ownerId,
    });

    expect(typeof cachedResult.meta.cache.hit).toBe("boolean");
    expect(cachedResult.meta.cache.ttlSeconds).toBeGreaterThan(0);
    expect(cachedResult.metrics.notesCreated.total).toBe(2);
  });

  it("leverages stored snapshots when available", async () => {
    const ownerId = new mongoose.Types.ObjectId();

    const notebook = await Notebook.create({
      owner: ownerId,
      name: "Snapshot Coverage",
    });

    const baseDate = startOfUtcDay(new Date());

    const seedDay = async (offset, tags) => {
      const createdAt = addUtcDays(baseDate, -offset);
      const note = await Note.create({
        owner: ownerId,
        notebookId: notebook._id,
        title: `Entry ${offset}`,
        content: "Body",
        tags,
      });
      await Note.updateOne(
        { _id: note._id },
        { $set: { createdAt, updatedAt: createdAt } }
      );
      return note;
    };

    await Promise.all([
      seedDay(1, ["ops"]),
      seedDay(2, ["ops", "infra"]),
      seedDay(3, ["infra"]),
    ]);

    await collectNotebookSnapshotsForRange({
      notebookId: notebook._id,
      startDate: addUtcDays(baseDate, -6),
      endExclusive: addUtcDays(baseDate, 1),
      notebook,
    });

    const analytics = await getNotebookAnalyticsOverview({
      notebookId: notebook._id.toString(),
      range: "7d",
      ownerId,
    });

    expect(analytics.metrics.notesCreated.total).toBeGreaterThanOrEqual(3);
    expect(analytics.meta.snapshots.total).toBeGreaterThan(0);
    expect(analytics.meta.snapshots.missingDays).toBe(0);
    expect(analytics.metrics.topTags).toEqual(
      expect.arrayContaining([expect.objectContaining({ tag: "ops" })])
    );
  });

  it("provides granular analytics slices with consistent metadata", async () => {
    const ownerId = new mongoose.Types.ObjectId();
    const editorId = new mongoose.Types.ObjectId();
    const viewerId = new mongoose.Types.ObjectId();
    const commenterId = new mongoose.Types.ObjectId();

    const notebook = await Notebook.create({
      owner: ownerId,
      name: "Slice Coverage",
    });

    const editorMember = new NotebookMember({
      notebookId: notebook._id,
      userId: editorId,
      role: "editor",
      status: "active",
    });
    editorMember.setInviteToken(null);
    await editorMember.save();

    const viewerMember = new NotebookMember({
      notebookId: notebook._id,
      userId: viewerId,
      role: "viewer",
      status: "active",
    });
    viewerMember.setInviteToken(null);
    await viewerMember.save();

    const baseDate = startOfUtcDay(new Date());

    const seedDay = async (offset, tags, actorId = ownerId) => {
      const createdAt = addUtcDays(baseDate, -offset);
      const note = await Note.create({
        owner: ownerId,
        notebookId: notebook._id,
        title: `Slice ${offset}`,
        content: "Snapshot body",
        tags,
      });
      await Note.updateOne(
        { _id: note._id },
        { $set: { createdAt, updatedAt: createdAt } }
      );

      await NoteHistory.create({
        noteId: note._id,
        workspaceId: new mongoose.Types.ObjectId(),
        boardId: new mongoose.Types.ObjectId(),
        actorId,
        eventType: "edit",
        createdAt,
        updatedAt: createdAt,
      });

      return note;
    };

    const noteA = await seedDay(1, ["ops", "planning"]);
    await seedDay(2, ["infra"]);
    await seedDay(3, ["ops"]);

    await NoteCollaborator.create({
      noteId: noteA._id,
      userId: commenterId,
      invitedBy: ownerId,
      role: "commenter",
    });

    await collectNotebookSnapshotsForRange({
      notebookId: notebook._id,
      startDate: addUtcDays(baseDate, -6),
      endExclusive: addUtcDays(baseDate, 1),
      notebook,
    });

    const memo = new Map();
    const range = "7d";
    const notebookId = notebook._id.toString();

    const activity = await getNotebookActivityAnalytics({
      notebookId,
      range,
      viewerContext: null,
      memo,
    });

    expect(activity.labels).toHaveLength(7);
    expect(activity.series[0].label).toBe("notesCreated");
    expect(activity.series[0].data.some((count) => count > 0)).toBe(true);
    expect(activity.meta.snapshots.total).toBeGreaterThan(0);
    expect(activity.meta.snapshots.coverageRatio).toBeGreaterThan(0);

    const tags = await getNotebookTagAnalytics({
      notebookId,
      range,
      viewerContext: null,
      memo,
    });

    expect(tags.labels.length).toBeGreaterThan(0);
    expect(tags.series[0].data.length).toBe(tags.labels.length);
    expect(tags.meta.snapshots.total).toBe(activity.meta.snapshots.total);

    const collaborators = await getNotebookCollaboratorAnalytics({
      notebookId,
      ownerId,
      viewerContext: null,
      range,
    });

    expect(collaborators.labels).toEqual(
      expect.arrayContaining(["owner", "editor", "viewer", "commenter"])
    );
    expect(collaborators.series).toHaveLength(2);
    expect(
      collaborators.series[0].data.reduce((total, value) => total + value, 0)
    ).toBeGreaterThan(0);

    const snapshots = await getNotebookSnapshotAnalytics({
      notebookId,
      range,
      memo,
    });

    expect(snapshots.labels).toHaveLength(7);
    expect(snapshots.series).toHaveLength(3);
    expect(snapshots.meta.details.length).toBeGreaterThan(0);
    expect(snapshots.meta.snapshots.total).toBe(activity.meta.snapshots.total);
    expect(snapshots.meta.missingDates.length).toBe(0);
  });
});
