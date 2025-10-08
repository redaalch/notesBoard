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

    const response = await request(app)
      .post("/api/auth/register")
      .set("X-Test-Client-Id", payload.email)
      .send(payload);
    return { payload, response };
  };

  const extractVerificationToken = () => {
    expect(sentEmails.length).toBeGreaterThan(0);
    const latestEmail = sentEmails[sentEmails.length - 1];
    const linkMatch = latestEmail?.text?.match(/https?:\/\/[^\s]+/i);
    expect(linkMatch?.[0]).toBeTruthy();
    const url = new URL(linkMatch[0]);
    const token = url.searchParams.get("token");
    expect(token).toBeTruthy();
    return token;
  };

  const verifyLatestEmail = async (email) => {
    const token = extractVerificationToken();
    const verificationResponse = await request(app)
      .post("/api/auth/verify-email")
      .set("X-Test-Client-Id", email)
      .send({ token });
    expect(verificationResponse.status).toBe(200);
    return verificationResponse;
  };

  it("allows a user to register, authenticate, and manage notes", async () => {
    const { response: registerResponse, payload } = await registerUser();
    expect(registerResponse.status).toBe(202);
    expect(registerResponse.body?.accessToken).toBeUndefined();
    expect(sentEmails).toHaveLength(1);

    const verifyResponse = await verifyLatestEmail(payload.email);
    const cookies = verifyResponse.get("set-cookie");
    expect(cookies).toBeTruthy();

    const accessToken = verifyResponse.body.accessToken;
    const clientId = verifyResponse.body.user.id;

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

  it("requires users to verify their email before logging in", async () => {
    const { response: registerResponse, payload } = await registerUser({
      email: "pending@example.com",
    });
    expect(registerResponse.status).toBe(202);

    const preVerifyLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: payload.email, password: payload.password });

    expect(preVerifyLogin.status).toBe(403);
    expect(preVerifyLogin.body?.message).toMatch(/verify/i);

    await verifyLatestEmail(payload.email);

    const postVerifyLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: payload.email, password: payload.password });

    expect(postVerifyLogin.status).toBe(200);
    expect(postVerifyLogin.body.accessToken).toBeDefined();
  });

  it("prevents one user from accessing another user's notes", async () => {
    const { response: registerRes1, payload: payload1 } = await registerUser({
      email: "user1@example.com",
    });
    expect(registerRes1.status).toBe(202);
    const verifyRes1 = await verifyLatestEmail(payload1.email);

    const { response: registerRes2, payload: payload2 } = await registerUser({
      email: "user2@example.com",
    });
    expect(registerRes2.status).toBe(202);
    const verifyRes2 = await verifyLatestEmail(payload2.email);

    const token1 = verifyRes1.body.accessToken;
    const token2 = verifyRes2.body.accessToken;
    const clientId1 = verifyRes1.body.user.id;
    const clientId2 = verifyRes2.body.user.id;

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
    const { response: registerResponse, payload } = await registerUser({
      email: "stats@example.com",
    });
    expect(registerResponse.status).toBe(202);
    const verifyResponse = await verifyLatestEmail(payload.email);

    const token = verifyResponse.body.accessToken;
    const clientId = verifyResponse.body.user.id;

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
    const { response: registerResponse, payload } = await registerUser({
      email: "reset@example.com",
    });
    expect(registerResponse.status).toBe(202);
    await verifyLatestEmail(payload.email);
    sentEmails.length = 0;
    sendMailMock.mockClear();

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
    const { response: registerResponse, payload } = await registerUser({
      email: "reset-flow@example.com",
      password: "OldPassword1",
    });
    expect(registerResponse.status).toBe(202);
    await verifyLatestEmail(payload.email);
    sentEmails.length = 0;
    sendMailMock.mockClear();

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
