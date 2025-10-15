import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import bcrypt from "bcryptjs";

import cacheService from "../src/services/cacheService.js";
import { generateAccessToken } from "../src/utils/tokenService.js";
import User from "../src/models/User.js";
import Notebook from "../src/models/Notebook.js";
import Note from "../src/models/Note.js";
import NoteHistory from "../src/models/NoteHistory.js";
import NotebookMember from "../src/models/NotebookMember.js";
import NoteCollaborator from "../src/models/NoteCollaborator.js";
import NotebookAnalyticsSnapshot from "../src/models/NotebookAnalyticsSnapshot.js";
import { collectNotebookSnapshotsForRange } from "../src/services/notebookAnalyticsSnapshotService.js";
import {
  addUtcDays,
  startOfUtcDay,
} from "../src/services/notebookAnalyticsShared.js";

let app;
let mongo;

const authHeaders = (token) => ({
  Authorization: `Bearer ${token}`,
  "X-Test-Client-Id": "analytics-controller-tests",
});

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  process.env.JWT_ACCESS_SECRET = "test-access-secret";

  mongo = await MongoMemoryServer.create();
  const uri = mongo.getUri();
  await mongoose.connect(uri, {
    dbName: "notebookAnalyticsController",
  });

  ({ default: app } = await import("../src/app.js"));
});

afterEach(async () => {
  await Promise.all([
    Note.deleteMany({}),
    NoteHistory.deleteMany({}),
    Notebook.deleteMany({}),
    NotebookMember.deleteMany({}),
    NoteCollaborator.deleteMany({}),
    NotebookAnalyticsSnapshot.deleteMany({}),
    User.deleteMany({}),
  ]);
  cacheService.flush();
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongo) {
    await mongo.stop();
  }
});

describe("notebook analytics endpoints", () => {
  it("returns analytics slices for notebook members and enforces access control", async () => {
    const ownerPassword = await bcrypt.hash("Password123!", 10);
    const owner = await User.create({
      name: "Owner",
      email: "owner@example.com",
      passwordHash: ownerPassword,
      emailVerified: true,
    });

    const editorPassword = await bcrypt.hash("Password123!", 10);
    const editor = await User.create({
      name: "Editor",
      email: "editor@example.com",
      passwordHash: editorPassword,
      emailVerified: true,
    });

    const outsiderPassword = await bcrypt.hash("Password123!", 10);
    const outsider = await User.create({
      name: "Outsider",
      email: "outsider@example.com",
      passwordHash: outsiderPassword,
      emailVerified: true,
    });

    const notebook = await Notebook.create({
      owner: owner._id,
      name: "Controller Coverage",
    });

    await NotebookMember.create({
      notebookId: notebook._id,
      userId: editor._id,
      role: "editor",
      status: "active",
    });

    const baseDate = startOfUtcDay(new Date());

    const seedDay = async (offset, tags, actorId = owner._id) => {
      const createdAt = addUtcDays(baseDate, -offset);
      const note = await Note.create({
        owner: owner._id,
        notebookId: notebook._id,
        title: `Event ${offset}`,
        content: "Body",
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

    const note = await seedDay(1, ["ops", "planning"]);
    await seedDay(2, ["infra"]);

    await NoteCollaborator.create({
      noteId: note._id,
      userId: editor._id,
      invitedBy: owner._id,
      role: "commenter",
    });

    await collectNotebookSnapshotsForRange({
      notebookId: notebook._id,
      startDate: addUtcDays(baseDate, -6),
      endExclusive: addUtcDays(baseDate, 1),
      notebook,
    });

    const ownerToken = generateAccessToken({
      id: owner._id.toString(),
      email: owner.email,
      role: owner.role,
    });

    const outsiderToken = generateAccessToken({
      id: outsider._id.toString(),
      email: outsider.email,
      role: outsider.role,
    });

    const notebookId = notebook._id.toString();

    const activityRes = await request(app)
      .get(`/api/notebooks/${notebookId}/analytics/activity?range=7d`)
      .set(authHeaders(ownerToken));

    expect(activityRes.status).toBe(200);
    expect(Array.isArray(activityRes.body.labels)).toBe(true);
    expect(activityRes.body.series[0].label).toBe("notesCreated");

    const tagsRes = await request(app)
      .get(`/api/notebooks/${notebookId}/analytics/tags?range=7d`)
      .set(authHeaders(ownerToken));

    expect(tagsRes.status).toBe(200);
    expect(Array.isArray(tagsRes.body.series[0].data)).toBe(true);

    const collaboratorsRes = await request(app)
      .get(`/api/notebooks/${notebookId}/analytics/collaborators`)
      .set(authHeaders(ownerToken));

    expect(collaboratorsRes.status).toBe(200);
    expect(collaboratorsRes.body.labels).toEqual(
      expect.arrayContaining(["owner", "editor", "commenter"])
    );

    const snapshotsRes = await request(app)
      .get(`/api/notebooks/${notebookId}/analytics/snapshots?range=7d`)
      .set(authHeaders(ownerToken));

    expect(snapshotsRes.status).toBe(200);
    expect(snapshotsRes.body.series).toHaveLength(3);
    expect(Array.isArray(snapshotsRes.body.meta?.details)).toBe(true);

    const forbiddenRes = await request(app)
      .get(`/api/notebooks/${notebookId}/analytics`)
      .set(authHeaders(outsiderToken));

    expect(forbiddenRes.status).toBe(403);
    expect(forbiddenRes.body?.message).toMatch(/access denied/i);
  });
});
