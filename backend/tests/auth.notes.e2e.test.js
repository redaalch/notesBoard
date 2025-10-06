import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

import Note from "../src/models/Note.js";
import User from "../src/models/User.js";

let app;
let mongo;

const authHeaders = (token) => ({
  Authorization: `Bearer ${token}`,
});

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  process.env.JWT_ACCESS_SECRET = "test-access-secret";
  process.env.JWT_ACCESS_TTL = "10m";
  process.env.JWT_REFRESH_TTL_MS = "86400000"; // 1 day

  mongo = await MongoMemoryServer.create();
  const uri = mongo.getUri();
  process.env.MONGO_URI = uri;
  process.env.MONGO_DB = "notesBoardTest";

  await mongoose.connect(uri, { dbName: process.env.MONGO_DB });

  ({ default: app } = await import("../src/app.js"));
});

afterEach(async () => {
  await Note.deleteMany({});
  await User.deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongo) {
    await mongo.stop();
  }
});

describe("Auth and notes integration", () => {
  const registerUser = async (overrides = {}) => {
    const payload = {
      name: "Ada Lovelace",
      email: "ada@example.com",
      password: "Secure123",
      ...overrides,
    };

    return request(app).post("/api/auth/register").send(payload);
  };

  it("allows a user to register, authenticate, and manage notes", async () => {
    const registerResponse = await registerUser();
    expect(registerResponse.status).toBe(201);
    expect(registerResponse.body?.accessToken).toBeDefined();
    const cookies = registerResponse.get("set-cookie");
    expect(cookies).toBeTruthy();

    const accessToken = registerResponse.body.accessToken;

    const createRes = await request(app)
      .post("/api/notes")
      .set(authHeaders(accessToken))
      .send({
        title: "First Note",
        content: "Secure content",
        tags: ["security", "demo"],
      });
    expect(createRes.status).toBe(201);
    expect(createRes.body.owner).toBeDefined();

    const listRes = await request(app)
      .get("/api/notes")
      .set(authHeaders(accessToken));
    expect(listRes.status).toBe(200);
    expect(Array.isArray(listRes.body)).toBe(true);
    expect(listRes.body).toHaveLength(1);

    const noteId = listRes.body[0]._id;

    const updateRes = await request(app)
      .put(`/api/notes/${noteId}`)
      .set(authHeaders(accessToken))
      .send({ title: "Updated title" });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.title).toBe("Updated title");

    const deleteRes = await request(app)
      .delete(`/api/notes/${noteId}`)
      .set(authHeaders(accessToken));
    expect(deleteRes.status).toBe(200);

    const listAfterDelete = await request(app)
      .get("/api/notes")
      .set(authHeaders(accessToken));
    expect(listAfterDelete.body).toHaveLength(0);
  });

  it("prevents one user from accessing another user's notes", async () => {
    const user1 = await registerUser({ email: "user1@example.com" });
    const user2 = await registerUser({ email: "user2@example.com" });

    const token1 = user1.body.accessToken;
    const token2 = user2.body.accessToken;

    const noteRes = await request(app)
      .post("/api/notes")
      .set(authHeaders(token1))
      .send({ title: "Private note", content: "Secret", tags: [] });

    expect(noteRes.status).toBe(201);
    const noteId = noteRes.body._id;

    const getForbidden = await request(app)
      .get(`/api/notes/${noteId}`)
      .set(authHeaders(token2));
    expect(getForbidden.status).toBe(404);

    const updateForbidden = await request(app)
      .put(`/api/notes/${noteId}`)
      .set(authHeaders(token2))
      .send({ title: "Hack" });
    expect(updateForbidden.status).toBe(404);

    const deleteForbidden = await request(app)
      .delete(`/api/notes/${noteId}`)
      .set(authHeaders(token2));
    expect(deleteForbidden.status).toBe(404);
  });

  it("returns aggregated tag statistics for the authenticated user", async () => {
    const registerResponse = await registerUser({ email: "stats@example.com" });
    expect(registerResponse.status).toBe(201);

    const token = registerResponse.body.accessToken;

    const createNote = (payload) =>
      request(app).post("/api/notes").set(authHeaders(token)).send(payload);

    await createNote({
      title: "Note one",
      content: "Content A",
      tags: ["Work", " urgent "],
    });

    await createNote({
      title: "Note two",
      content: "Content B",
      tags: ["work", "ideas"],
    });

    await createNote({
      title: "Note without tags",
      content: "Content C",
    });

    const statsResponse = await request(app)
      .get("/api/notes/tags/stats")
      .set(authHeaders(token));

    expect(statsResponse.status).toBe(200);
    expect(statsResponse.body.uniqueTags).toBe(3);
    expect(statsResponse.body.topTag).toEqual({ _id: "work", count: 2 });
    expect(statsResponse.body.tags).toEqual([
      { _id: "work", count: 2 },
      { _id: "ideas", count: 1 },
      { _id: "urgent", count: 1 },
    ]);
  });
});
