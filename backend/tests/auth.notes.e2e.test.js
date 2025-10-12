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
import Board from "../src/models/Board.js";
import Workspace from "../src/models/Workspace.js";
import CollabDocument from "../src/models/CollabDocument.js";
import Notebook from "../src/models/Notebook.js";
import NotebookMember from "../src/models/NotebookMember.js";

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
  await Board.deleteMany({});
  await Workspace.deleteMany({});
  await CollabDocument.deleteMany({});
  await Notebook.deleteMany({});
  await NotebookMember.deleteMany({});
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

  it("creates notes inside notebooks and returns them in notebook scoped queries", async () => {
    const { response: registerResponse, payload } = await registerUser({
      email: "notebooker@example.com",
    });
    expect(registerResponse.status).toBe(202);

    const verifyResponse = await verifyLatestEmail(payload.email);
    const accessToken = verifyResponse.body.accessToken;
    const clientId = verifyResponse.body.user.id;

    const notebookResponse = await request(app)
      .post("/api/notebooks")
      .set(authHeaders(accessToken, clientId))
      .send({
        name: "Product",
        color: "#22c55e",
        icon: "Rocket",
      });

    expect(notebookResponse.status).toBe(201);
    const notebookId = notebookResponse.body.id;
    expect(typeof notebookId).toBe("string");

    const noteResponse = await request(app)
      .post("/api/notes")
      .set(authHeaders(accessToken, clientId))
      .send({
        title: "Launch Checklist",
        content: "Prep the release",
        notebookId,
      });

    expect(noteResponse.status).toBe(201);
    expect(noteResponse.body.notebookId).toBeDefined();
    expect(noteResponse.body.notebookId.toString()).toBe(notebookId);

    const notebookNotesResponse = await request(app)
      .get("/api/notes")
      .query({ notebookId })
      .set(authHeaders(accessToken, clientId));

    expect(notebookNotesResponse.status).toBe(200);
    expect(Array.isArray(notebookNotesResponse.body)).toBe(true);
    expect(notebookNotesResponse.body).toHaveLength(1);
    expect(notebookNotesResponse.body[0].title).toBe("Launch Checklist");
    expect(notebookNotesResponse.body[0].notebookId.toString()).toBe(
      notebookId
    );

    const notebooksListResponse = await request(app)
      .get("/api/notebooks")
      .set(authHeaders(accessToken, clientId));

    expect(notebooksListResponse.status).toBe(200);
    const createdNotebook = notebooksListResponse.body.notebooks.find(
      (entry) => entry.id === notebookId
    );
    expect(createdNotebook?.noteCount).toBe(1);
  });

  it("allows invited notebook members to accept invitations", async () => {
    const { response: ownerRegister, payload: ownerPayload } =
      await registerUser({
        email: "owner@example.com",
      });
    expect(ownerRegister.status).toBe(202);

    const ownerVerify = await verifyLatestEmail(ownerPayload.email);
    const ownerToken = ownerVerify.body.accessToken;
    const ownerClientId = ownerVerify.body.user.id;

    const notebookResponse = await request(app)
      .post("/api/notebooks")
      .set(authHeaders(ownerToken, ownerClientId))
      .send({ name: "Shared Research" });
    expect(notebookResponse.status).toBe(201);
    const notebookId = notebookResponse.body.id;

    const { response: inviteeRegister, payload: inviteePayload } =
      await registerUser({
        email: "invitee@example.com",
      });
    expect(inviteeRegister.status).toBe(202);

    const inviteeVerify = await verifyLatestEmail(inviteePayload.email);
    const inviteeToken = inviteeVerify.body.accessToken;
    const inviteeClientId = inviteeVerify.body.user.id;

    sentEmails.length = 0;
    sendMailMock.mockClear();

    const inviteResponse = await request(app)
      .post(`/api/notebooks/${notebookId}/members`)
      .set(authHeaders(ownerToken, ownerClientId))
      .send({ email: inviteePayload.email, role: "viewer" });
    expect(inviteResponse.status).toBe(201);
    expect(sendMailMock).toHaveBeenCalledTimes(1);

    const inviteMail = sentEmails[0];
    expect(inviteMail?.text).toBeTruthy();
    const linkMatch = inviteMail.text.match(/https?:\/\/[^\s]+/i);
    expect(linkMatch?.[0]).toBeTruthy();
    const inviteToken = new URL(linkMatch[0]).searchParams.get("token");
    expect(inviteToken).toBeTruthy();

    const acceptResponse = await request(app)
      .post("/api/notebooks/invitations/accept")
      .set(authHeaders(inviteeToken, inviteeClientId))
      .send({ token: inviteToken });
    expect(acceptResponse.status).toBe(200);
    expect(acceptResponse.body?.accepted).toBe(true);
    expect(acceptResponse.body?.notebookId).toBe(notebookId);

    const membership = await NotebookMember.findOne({
      notebookId: new mongoose.Types.ObjectId(notebookId),
      userId: new mongoose.Types.ObjectId(inviteeClientId),
    });
    expect(membership).toBeTruthy();
    expect(membership.status).toBe("active");
    expect(membership.role).toBe("viewer");
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

  it("resend verification email for legacy accounts without tokens", async () => {
    const user = new User({
      name: "Legacy User",
      email: "legacy@example.com",
      emailVerified: false,
    });

    await user.setPassword("LegacyPass1");
    user.emailVerification = undefined;
    await user.save();

    sentEmails.length = 0;
    sendMailMock.mockClear();

    const response = await request(app)
      .post("/api/auth/verify-email/resend")
      .set("X-Test-Client-Id", "legacy@example.com")
      .send({ email: "legacy@example.com" });

    expect(response.status).toBe(200);
    expect(response.body?.message).toMatch(/verification email/i);
    expect(sendMailMock).toHaveBeenCalledTimes(1);

    const updatedUser = await User.findOne({ email: "legacy@example.com" });
    expect(updatedUser?.emailVerification?.token).toBeDefined();
    expect(updatedUser?.emailVerification?.expiresAt).toBeInstanceOf(Date);

    const token = extractVerificationToken();
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(10);
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

  it("allows users to update their profile and re-verifies email when changed", async () => {
    const { response: registerResponse, payload } = await registerUser({
      email: "profile@example.com",
      password: "ProfilePass1",
    });
    expect(registerResponse.status).toBe(202);
    const verifyResponse = await verifyLatestEmail(payload.email);

    const accessToken = verifyResponse.body.accessToken;
    const clientId = verifyResponse.body.user.id;

    sentEmails.length = 0;
    sendMailMock.mockClear();

    const profileResponse = await request(app)
      .put("/api/auth/profile")
      .set(authHeaders(accessToken, clientId))
      .send({
        name: "Ada Byron",
        email: "ada.byron@example.com",
        currentPassword: payload.password,
        verificationRedirectUrl: "http://localhost:5173/verify-email",
      });

    expect(profileResponse.status).toBe(200);
    expect(profileResponse.body?.user?.name).toBe("Ada Byron");
    expect(profileResponse.body?.user?.email).toBe("ada.byron@example.com");
    expect(profileResponse.body?.user?.emailVerified).toBe(false);
    expect(profileResponse.body?.emailVerificationRequired).toBe(true);
    expect(profileResponse.body?.accessToken).toBeDefined();
    expect(sendMailMock).toHaveBeenCalledTimes(1);

    const cookies = profileResponse.get("set-cookie");
    expect(cookies).toBeTruthy();

    const updatedUser = await User.findOne({ email: "ada.byron@example.com" });
    expect(updatedUser).toBeTruthy();
    expect(updatedUser?.emailVerified).toBe(false);
    expect(updatedUser?.emailVerification?.token).toBeDefined();

    const newToken = profileResponse.body.accessToken;
    const meResponse = await request(app)
      .get("/api/auth/me")
      .set(authHeaders(newToken, clientId));
    expect(meResponse.status).toBe(200);
    expect(meResponse.body?.user?.email).toBe("ada.byron@example.com");
    expect(meResponse.body?.user?.name).toBe("Ada Byron");
  });

  it("updates the password when the current password is correct", async () => {
    const { response: registerResponse, payload } = await registerUser({
      email: "changepass@example.com",
      password: "InitialPass1",
    });
    expect(registerResponse.status).toBe(202);
    const verifyResponse = await verifyLatestEmail(payload.email);

    const accessToken = verifyResponse.body.accessToken;
    const clientId = verifyResponse.body.user.id;

    const changeResponse = await request(app)
      .post("/api/auth/password/change")
      .set(authHeaders(accessToken, clientId))
      .send({
        currentPassword: payload.password,
        newPassword: "UpdatedPass9",
      });

    expect(changeResponse.status).toBe(200);
    expect(changeResponse.body?.message).toMatch(/password updated/i);
    expect(changeResponse.body?.accessToken).toBeDefined();

    const oldLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: payload.email, password: payload.password });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: payload.email, password: "UpdatedPass9" });
    expect(newLogin.status).toBe(200);
    expect(newLogin.body?.accessToken).toBeDefined();
  });

  it("supports bulk note actions and board discovery", async () => {
    const { response: registerResponse, payload } = await registerUser({
      email: "bulk@example.com",
    });
    expect(registerResponse.status).toBe(202);
    const verifyResponse = await verifyLatestEmail(payload.email);

    const accessToken = verifyResponse.body.accessToken;
    const clientId = verifyResponse.body.user.id;

    const createNote = async (overrides = {}) => {
      const response = await request(app)
        .post("/api/notes")
        .set(authHeaders(accessToken, clientId))
        .send({
          title: "Bulk note",
          content: "Collaborative content",
          tags: ["initial"],
          ...overrides,
        });
      expect(response.status).toBe(201);
      return response.body;
    };

    const noteA = await createNote({ title: "Alpha note" });
    const noteB = await createNote({ title: "Beta note" });
    const noteC = await createNote({ title: "Gamma note" });

    const dbUser = await User.findById(clientId);
    expect(dbUser?.defaultBoard).toBeDefined();
    expect(dbUser?.defaultWorkspace).toBeDefined();

    const extraBoard = await Board.create({
      workspaceId: dbUser.defaultWorkspace,
      name: "Research Deck",
      slug: `research-${Date.now()}`,
      createdBy: dbUser._id,
    });

    const boardsResponse = await request(app)
      .get("/api/boards")
      .set(authHeaders(accessToken, clientId));

    expect(boardsResponse.status).toBe(200);
    expect(Array.isArray(boardsResponse.body?.boards)).toBe(true);
    expect(boardsResponse.body.boards.length).toBeGreaterThanOrEqual(2);
    const boardIds = boardsResponse.body.boards.map((board) => board.id);
    expect(boardIds).toContain(dbUser.defaultBoard.toString());
    expect(boardIds).toContain(extraBoard._id.toString());

    const bulkPinResponse = await request(app)
      .post("/api/notes/bulk")
      .set(authHeaders(accessToken, clientId))
      .send({ action: "pin", noteIds: [noteA._id, noteB._id, noteC._id] });

    expect(bulkPinResponse.status).toBe(200);
    expect(bulkPinResponse.body.updated).toBe(3);

    const listAfterPin = await request(app)
      .get("/api/notes")
      .set(authHeaders(accessToken, clientId));
    expect(listAfterPin.body.every((note) => note.pinned)).toBe(true);

    const bulkTagsResponse = await request(app)
      .post("/api/notes/bulk")
      .set(authHeaders(accessToken, clientId))
      .send({
        action: "addTags",
        noteIds: [noteA._id, noteB._id, noteC._id],
        tags: ["Focus", " Deep Work "],
      });

    expect(bulkTagsResponse.status).toBe(200);
    expect(bulkTagsResponse.body.tags).toEqual(["focus", "deep work"]);

    const bulkMoveResponse = await request(app)
      .post("/api/notes/bulk")
      .set(authHeaders(accessToken, clientId))
      .send({
        action: "move",
        noteIds: [noteA._id, noteB._id, noteC._id],
        boardId: extraBoard._id.toString(),
      });

    expect(bulkMoveResponse.status).toBe(200);
    expect(bulkMoveResponse.body.boardId.toString()).toBe(
      extraBoard._id.toString()
    );

    const listAfterMove = await request(app)
      .get("/api/notes")
      .query({ boardId: extraBoard._id.toString() })
      .set(authHeaders(accessToken, clientId));
    expect(listAfterMove.status).toBe(200);
    expect(listAfterMove.body).toHaveLength(3);

    const bulkDeleteResponse = await request(app)
      .post("/api/notes/bulk")
      .set(authHeaders(accessToken, clientId))
      .send({ action: "delete", noteIds: [noteA._id, noteB._id] });

    expect(bulkDeleteResponse.status).toBe(200);
    expect(bulkDeleteResponse.body.deleted).toBe(2);

    const finalList = await request(app)
      .get("/api/notes")
      .query({ boardId: extraBoard._id.toString() })
      .set(authHeaders(accessToken, clientId));
    expect(finalList.body).toHaveLength(1);
    expect(finalList.body[0]._id).toBe(noteC._id);
  });
});
