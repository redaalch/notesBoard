import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import bcrypt from "bcryptjs";

import cacheService from "../src/services/cacheService.js";
import { generateAccessToken } from "../src/utils/tokenService.js";
import User from "../src/models/User.js";
import Note from "../src/models/Note.js";
import NoteHistory from "../src/models/NoteHistory.js";

let app;
let mongo;

const authHeaders = (token) => ({
  Authorization: `Bearer ${token}`,
  "X-Test-Client-Id": "activity-heatmap-tests",
});

const startOfUtcDay = (date) => {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

const addDays = (date, days) => {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
};

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  process.env.JWT_ACCESS_SECRET = "test-access-secret";

  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri(), { dbName: "activityHeatmap" });
  ({ default: app } = await import("../src/app.js"));
});

afterEach(async () => {
  await Promise.all([
    Note.deleteMany({}),
    NoteHistory.deleteMany({}),
    User.deleteMany({}),
  ]);
  cacheService.flush();
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

describe("GET /api/activity/heatmap", () => {
  it("aggregates edit events per day and computes streaks + word counts", async () => {
    const passwordHash = await bcrypt.hash("Password123!", 10);
    const user = await User.create({
      name: "Streak User",
      email: "streak@example.com",
      passwordHash,
      emailVerified: true,
    });

    const note = await Note.create({
      owner: user._id,
      title: "Today's note",
      content: "alpha beta gamma delta epsilon",
    });

    const today = startOfUtcDay(new Date());

    await NoteHistory.create([
      { noteId: note._id, actorId: user._id, eventType: "edit", createdAt: today },
      { noteId: note._id, actorId: user._id, eventType: "edit", createdAt: today },
      { noteId: note._id, actorId: user._id, eventType: "edit", createdAt: addDays(today, -1) },
      { noteId: note._id, actorId: user._id, eventType: "pin", createdAt: addDays(today, -3) },
    ]);

    const token = generateAccessToken({
      id: user._id.toString(),
      email: user.email,
      role: user.role,
    });

    const res = await request(app)
      .get("/api/activity/heatmap?days=14")
      .set(authHeaders(token));

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.days)).toBe(true);
    expect(res.body.days).toHaveLength(14);

    const last = res.body.days[res.body.days.length - 1];
    expect(last.editCount).toBe(2);
    expect(last.eventCount).toBe(2);

    const yesterday = res.body.days[res.body.days.length - 2];
    expect(yesterday.editCount).toBe(1);

    const threeDaysAgo = res.body.days[res.body.days.length - 4];
    expect(threeDaysAgo.editCount).toBe(0);
    expect(threeDaysAgo.eventCount).toBe(1);

    expect(res.body.currentStreak).toBe(2);
    expect(res.body.bestStreak).toBeGreaterThanOrEqual(2);
    expect(res.body.wordsLastWeek).toBe(5);
    expect(res.body.notesTouched).toBe(1);
  });

  it("returns 401 without an auth token", async () => {
    const res = await request(app).get("/api/activity/heatmap");
    expect(res.status).toBe(401);
  });

  it("isolates activity per user", async () => {
    const passwordHash = await bcrypt.hash("Password123!", 10);
    const [alice, bob] = await User.create([
      {
        name: "Alice",
        email: "alice@example.com",
        passwordHash,
        emailVerified: true,
      },
      {
        name: "Bob",
        email: "bob@example.com",
        passwordHash,
        emailVerified: true,
      },
    ]);

    const bobNote = await Note.create({
      owner: bob._id,
      title: "Bob's note",
      content: "hidden",
    });

    await NoteHistory.create({
      noteId: bobNote._id,
      actorId: bob._id,
      eventType: "edit",
      createdAt: new Date(),
    });

    const aliceToken = generateAccessToken({
      id: alice._id.toString(),
      email: alice.email,
      role: alice.role,
    });

    const res = await request(app)
      .get("/api/activity/heatmap?days=14")
      .set(authHeaders(aliceToken));

    expect(res.status).toBe(200);
    expect(res.body.days.every((d) => d.eventCount === 0)).toBe(true);
    expect(res.body.currentStreak).toBe(0);
    expect(res.body.bestStreak).toBe(0);
    expect(res.body.wordsLastWeek).toBe(0);
  });
});
