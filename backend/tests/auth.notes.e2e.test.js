import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

import Note from "../src/models/Note.js";
import User from "../src/models/User.js";

const sentEmails = [];
const sendMailMock = vi.fn(async (options) => {
  sentEmails.push(options);
  return { messageId: "test" };
});

vi.mock("../src/utils/mailer.js", () => ({
  sendMail: sendMailMock,
}));

let app;
let mongo;

const authHeaders = (token, clientId) => ({
  Authorization: `Bearer ${token}`,
  "X-Test-Client-Id": clientId ?? token.slice(-16),
});

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  process.env.JWT_ACCESS_SECRET = "test-access-secret";
  process.env.JWT_ACCESS_TTL = "10m";
  process.env.JWT_REFRESH_TTL_MS = "86400000"; // 1 day
  process.env.PASSWORD_RESET_TTL_MS = "3600000"; // 1 hour
  process.env.PASSWORD_RESET_URL = "http://localhost:5173/reset-password";

  mongo = await MongoMemoryServer.create();
  const uri = mongo.getUri();
  process.env.MONGO_URI = uri;
  process.env.MONGO_DB = "notesBoardTest";

  await mongoose.connect(uri, { dbName: process.env.MONGO_DB });

  ({ default: app } = await import("../src/app.js"));
});

afterEach(async () => {
  sentEmails.length = 0;
  sendMailMock.mockClear();
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

    return request(app)
      .post("/api/auth/register")
      .set("X-Test-Client-Id", payload.email)
      .send(payload);
  };

  it("allows a user to register, authenticate, and manage notes", async () => {
    const registerResponse = await registerUser();
    expect(registerResponse.status).toBe(201);
    expect(registerResponse.body?.accessToken).toBeDefined();
    const cookies = registerResponse.get("set-cookie");
    expect(cookies).toBeTruthy();

    const accessToken = registerResponse.body.accessToken;
    const clientId = registerResponse.body.user.id;

    const createRes = await request(app)
      .post("/api/notes")
      .set(authHeaders(accessToken, clientId))
      .send({
        title: "First Note",
        content: "Secure content",
        tags: ["security", "demo"],
      });
    expect(createRes.status).toBe(201);
    expect(createRes.body.owner).toBeDefined();

    const listRes = await request(app)
      .get("/api/notes")
      .set(authHeaders(accessToken, clientId));
    expect(listRes.status).toBe(200);
    expect(Array.isArray(listRes.body)).toBe(true);
    expect(listRes.body).toHaveLength(1);

    const noteId = listRes.body[0]._id;

    const updateRes = await request(app)
      .put(`/api/notes/${noteId}`)
      .set(authHeaders(accessToken, clientId))
      .send({ title: "Updated title" });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.title).toBe("Updated title");

    const deleteRes = await request(app)
      .delete(`/api/notes/${noteId}`)
      .set(authHeaders(accessToken, clientId));
    expect(deleteRes.status).toBe(200);

    const listAfterDelete = await request(app)
      .get("/api/notes")
      .set(authHeaders(accessToken, clientId));
    expect(listAfterDelete.body).toHaveLength(0);
  });

  it("prevents one user from accessing another user's notes", async () => {
    const user1 = await registerUser({ email: "user1@example.com" });
    const user2 = await registerUser({ email: "user2@example.com" });

    const token1 = user1.body.accessToken;
    const token2 = user2.body.accessToken;
    const clientId1 = user1.body.user.id;
    const clientId2 = user2.body.user.id;

    const noteRes = await request(app)
      .post("/api/notes")
      .set(authHeaders(token1, clientId1))
      .send({ title: "Private note", content: "Secret", tags: [] });

    expect(noteRes.status).toBe(201);
    const noteId = noteRes.body._id;

    const getForbidden = await request(app)
      .get(`/api/notes/${noteId}`)
      .set(authHeaders(token2, clientId2));
    expect(getForbidden.status).toBe(404);

    const updateForbidden = await request(app)
      .put(`/api/notes/${noteId}`)
      .set(authHeaders(token2, clientId2))
      .send({ title: "Hack" });
    expect(updateForbidden.status).toBe(404);

    const deleteForbidden = await request(app)
      .delete(`/api/notes/${noteId}`)
      .set(authHeaders(token2, clientId2));
    expect(deleteForbidden.status).toBe(404);
  });

  it("returns aggregated tag statistics for the authenticated user", async () => {
    const registerResponse = await registerUser({ email: "stats@example.com" });
    expect(registerResponse.status).toBe(201);

    const token = registerResponse.body.accessToken;
    const clientId = registerResponse.body.user.id;

    const createNote = (payload) =>
      request(app)
        .post("/api/notes")
        .set(authHeaders(token, clientId))
        .send(payload);

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
      .set(authHeaders(token, clientId));

    expect(statsResponse.status).toBe(200);
    expect(statsResponse.body.uniqueTags).toBe(3);
    expect(statsResponse.body.topTag).toEqual({ _id: "work", count: 2 });
    expect(statsResponse.body.tags).toEqual([
      { _id: "work", count: 2 },
      { _id: "ideas", count: 1 },
      { _id: "urgent", count: 1 },
    ]);
  });

  it("sends a password reset email when requested", async () => {
    const registerResponse = await registerUser({
      email: "reset@example.com",
    });
    expect(registerResponse.status).toBe(201);

    const response = await request(app)
      .post("/api/auth/password/forgot")
      .set("X-Test-Client-Id", "reset@example.com")
      .send({ email: "reset@example.com" });

    expect(response.status).toBe(200);
    expect(response.body?.message).toMatch(/password reset email/i);
    expect(sendMailMock).toHaveBeenCalledTimes(1);

    const capturedMail = sentEmails[0];
    expect(capturedMail?.to).toBe("reset@example.com");

    const user = await User.findOne({ email: "reset@example.com" });
    expect(user?.passwordReset?.token).toBeDefined();
    expect(user?.passwordReset?.expiresAt).toBeInstanceOf(Date);

    // The email includes the reset link with the token as a query param
    const linkMatch = capturedMail?.text?.match(/https?:\/\/\S+/);
    expect(linkMatch?.[0]).toBeDefined();
    const tokenInLink = new URL(linkMatch[0]).searchParams.get("token");
    expect(tokenInLink).toBeDefined();

    const hashed = user.passwordReset.token;
    expect(hashed).toBeDefined();
    expect(hashed).not.toBe(tokenInLink); // ensure hashed stored
  });

  it("allows resetting the password with a valid token", async () => {
    const registerResponse = await registerUser({
      email: "reset-flow@example.com",
      password: "OldPassword1",
    });
    expect(registerResponse.status).toBe(201);

    const requestResponse = await request(app)
      .post("/api/auth/password/forgot")
      .set("X-Test-Client-Id", "reset-flow@example.com")
      .send({ email: "reset-flow@example.com" });

    expect(requestResponse.status).toBe(200);

    const mail = sentEmails[0];
    const linkMatch = mail?.text?.match(/https?:\/\/\S+/);
    const resetLink = linkMatch?.[0];
    expect(resetLink).toBeDefined();

    const token = new URL(resetLink).searchParams.get("token");
    expect(token).toBeDefined();

    const resetResponse = await request(app)
      .post("/api/auth/password/reset")
      .set("X-Test-Client-Id", "reset-flow@example.com")
      .send({ token, password: "NewPassword9" });

    expect(resetResponse.status).toBe(200);
    expect(resetResponse.body?.message).toMatch(/password updated/i);

    const user = await User.findOne({ email: "reset-flow@example.com" });
    expect(user?.passwordReset?.token).toBeUndefined();
    expect(user?.passwordReset?.expiresAt).toBeUndefined();
    expect(user?.refreshTokens).toHaveLength(0);

    const loginResponse = await request(app)
      .post("/api/auth/login")
      .set("X-Test-Client-Id", "reset-flow@example.com")
      .send({ email: "reset-flow@example.com", password: "NewPassword9" });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body?.accessToken).toBeDefined();
  });
});
