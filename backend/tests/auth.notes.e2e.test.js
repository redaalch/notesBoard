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
import NotebookTemplate from "../src/models/NotebookTemplate.js";

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
  await NotebookTemplate.deleteMany({});
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

  it("exports notebook templates and instantiates new notebooks", async () => {
    const { response: registerResponse, payload } = await registerUser({
      email: "templates@example.com",
    });
    expect(registerResponse.status).toBe(202);

    const verifyResponse = await verifyLatestEmail(payload.email);
    const accessToken = verifyResponse.body.accessToken;
    const clientId = verifyResponse.body.user.id;

    const notebookResponse = await request(app)
      .post("/api/notebooks")
      .set(authHeaders(accessToken, clientId))
      .send({
        name: "Release Notes",
        color: "#0ea5e9",
      });
    expect(notebookResponse.status).toBe(201);
    const notebookId = notebookResponse.body.id;

    const createNote = async (title, content) => {
      const noteRes = await request(app)
        .post("/api/notes")
        .set(authHeaders(accessToken, clientId))
        .send({ title, content, notebookId });
      expect(noteRes.status).toBe(201);
      return noteRes.body._id;
    };

    await createNote("Changelog", "1. Added exported templates");
    await createNote("Launch Email", "Draft copy for launch");

    const exportResponse = await request(app)
      .post(`/api/notebooks/${notebookId}/templates`)
      .set(authHeaders(accessToken, clientId))
      .send({
        name: "Release Template",
        description: "Reusable release prep notes",
        tags: ["release", "ops"],
      });
    expect(exportResponse.status).toBe(201);
    const templateId = exportResponse.body.id;
    expect(typeof templateId).toBe("string");

    const listResponse = await request(app)
      .get("/api/templates")
      .set(authHeaders(accessToken, clientId));
    expect(listResponse.status).toBe(200);
    expect(Array.isArray(listResponse.body)).toBe(true);
    expect(listResponse.body).toHaveLength(1);
    expect(listResponse.body[0].name).toBe("Release Template");

    const detailResponse = await request(app)
      .get(`/api/templates/${templateId}`)
      .set(authHeaders(accessToken, clientId));
    expect(detailResponse.status).toBe(200);
    expect(detailResponse.body?.notes).toHaveLength(2);
    expect(detailResponse.body.notes[0].title).toBe("Changelog");

    const instantiateResponse = await request(app)
      .post(`/api/templates/${templateId}/instantiate`)
      .set(authHeaders(accessToken, clientId))
      .send({ name: "Release Prep Notebook" });
    expect(instantiateResponse.status).toBe(201);
    const createdNotebookId = instantiateResponse.body.notebookId;
    expect(createdNotebookId).toBeTruthy();
    expect(createdNotebookId).not.toBe(notebookId);

    const notebooksList = await request(app)
      .get("/api/notebooks")
      .set(authHeaders(accessToken, clientId));
    expect(notebooksList.status).toBe(200);
    expect(notebooksList.body.notebooks).toHaveLength(2);

    const newNotebookNotes = await request(app)
      .get("/api/notes")
      .query({ notebookId: createdNotebookId })
      .set(authHeaders(accessToken, clientId));
    expect(newNotebookNotes.status).toBe(200);
    expect(Array.isArray(newNotebookNotes.body)).toBe(true);
    expect(newNotebookNotes.body).toHaveLength(2);
    expect(newNotebookNotes.body[0].notebookId.toString()).toBe(
      createdNotebookId
    );
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

  describe("Notebook Share Links", () => {
    it("allows owners to create share links for notebooks", async () => {
      const { response: ownerRegister, payload: ownerPayload } =
        await registerUser({
          email: "shareowner@example.com",
        });
      expect(ownerRegister.status).toBe(202);

      const ownerVerify = await verifyLatestEmail(ownerPayload.email);
      const ownerToken = ownerVerify.body.accessToken;
      const ownerClientId = ownerVerify.body.user.id;

      const notebookResponse = await request(app)
        .post("/api/notebooks")
        .set(authHeaders(ownerToken, ownerClientId))
        .send({ name: "Shareable Notebook" });
      expect(notebookResponse.status).toBe(201);
      const notebookId = notebookResponse.body.id;

      const shareLinkResponse = await request(app)
        .post(`/api/notebooks/${notebookId}/share-links`)
        .set(authHeaders(ownerToken, ownerClientId))
        .send({ role: "viewer", expiresInHours: 168 });
      expect(shareLinkResponse.status).toBe(201);
      expect(shareLinkResponse.body.shareLink.token).toBeDefined();
      expect(shareLinkResponse.body.shareLink.role).toBe("viewer");
      expect(shareLinkResponse.body.shareLink.url).toBeDefined();
      expect(shareLinkResponse.body.shareLink.expiresAt).toBeDefined();
    });

    it("lists all active share links for a notebook", async () => {
      const { response: ownerRegister, payload: ownerPayload } =
        await registerUser({
          email: "listowner@example.com",
        });
      expect(ownerRegister.status).toBe(202);

      const ownerVerify = await verifyLatestEmail(ownerPayload.email);
      const ownerToken = ownerVerify.body.accessToken;
      const ownerClientId = ownerVerify.body.user.id;

      const notebookResponse = await request(app)
        .post("/api/notebooks")
        .set(authHeaders(ownerToken, ownerClientId))
        .send({ name: "Multi-Link Notebook" });
      expect(notebookResponse.status).toBe(201);
      const notebookId = notebookResponse.body.id;

      await request(app)
        .post(`/api/notebooks/${notebookId}/share-links`)
        .set(authHeaders(ownerToken, ownerClientId))
        .send({ role: "viewer", expiresInHours: 168 });

      await request(app)
        .post(`/api/notebooks/${notebookId}/share-links`)
        .set(authHeaders(ownerToken, ownerClientId))
        .send({ role: "editor", expiresInHours: 720 });

      const listResponse = await request(app)
        .get(`/api/notebooks/${notebookId}/share-links`)
        .set(authHeaders(ownerToken, ownerClientId));

      expect(listResponse.status).toBe(200);
      expect(Array.isArray(listResponse.body.shareLinks)).toBe(true);
      expect(listResponse.body.shareLinks.length).toBe(2);
      expect(listResponse.body.shareLinks[0].role).toBeDefined();
      expect(listResponse.body.shareLinks[1].role).toBeDefined();
    });

    it("allows owners to revoke share links", async () => {
      const { response: ownerRegister, payload: ownerPayload } =
        await registerUser({
          email: "revokeowner@example.com",
        });
      expect(ownerRegister.status).toBe(202);

      const ownerVerify = await verifyLatestEmail(ownerPayload.email);
      const ownerToken = ownerVerify.body.accessToken;
      const ownerClientId = ownerVerify.body.user.id;

      const notebookResponse = await request(app)
        .post("/api/notebooks")
        .set(authHeaders(ownerToken, ownerClientId))
        .send({ name: "Revokable Notebook" });
      expect(notebookResponse.status).toBe(201);
      const notebookId = notebookResponse.body.id;

      const shareLinkResponse = await request(app)
        .post(`/api/notebooks/${notebookId}/share-links`)
        .set(authHeaders(ownerToken, ownerClientId))
        .send({ role: "viewer", expiresInHours: 168 });
      expect(shareLinkResponse.status).toBe(201);
      const shareLinkId = shareLinkResponse.body.shareLink.id;

      const revokeResponse = await request(app)
        .delete(`/api/notebooks/${notebookId}/share-links/${shareLinkId}`)
        .set(authHeaders(ownerToken, ownerClientId));
      expect(revokeResponse.status).toBe(200);
      expect(revokeResponse.body.shareLinks).toBeDefined();

      const listResponse = await request(app)
        .get(`/api/notebooks/${notebookId}/share-links`)
        .set(authHeaders(ownerToken, ownerClientId));
      expect(listResponse.status).toBe(200);
      expect(
        listResponse.body.shareLinks.filter((l) => !l.revokedAt).length
      ).toBe(0);
    });

    it("prevents expired share links from being listed", async () => {
      const { response: ownerRegister, payload: ownerPayload } =
        await registerUser({
          email: "expireowner@example.com",
        });
      expect(ownerRegister.status).toBe(202);

      const ownerVerify = await verifyLatestEmail(ownerPayload.email);
      const ownerToken = ownerVerify.body.accessToken;
      const ownerClientId = ownerVerify.body.user.id;

      const notebookResponse = await request(app)
        .post("/api/notebooks")
        .set(authHeaders(ownerToken, ownerClientId))
        .send({ name: "Expiring Notebook" });
      expect(notebookResponse.status).toBe(201);
      const notebookId = notebookResponse.body.id;

      const ShareLink = (await import("../src/models/ShareLink.js")).default;
      const rawToken = ShareLink.generateToken();
      const tokenHash = ShareLink.hash(rawToken);

      const expiredLink = new ShareLink({
        notebookId: new mongoose.Types.ObjectId(notebookId),
        resourceType: "notebook",
        role: "viewer",
        createdBy: new mongoose.Types.ObjectId(ownerClientId),
        expiresAt: new Date(Date.now() - 1000),
        tokenHash,
      });
      await expiredLink.save();

      const listResponse = await request(app)
        .get(`/api/notebooks/${notebookId}/share-links`)
        .set(authHeaders(ownerToken, ownerClientId));
      expect(listResponse.status).toBe(200);
      expect(listResponse.body.shareLinks.length).toBe(1);
    });
  });

  describe("Notebook Member Permissions", () => {
    it(
      "prevents viewers from inviting members",
      { timeout: 10000 },
      async () => {
        const { response: ownerRegister, payload: ownerPayload } =
          await registerUser({
            email: "permowner@example.com",
          });
        expect(ownerRegister.status).toBe(202);
        const ownerVerify = await verifyLatestEmail(ownerPayload.email);
        const ownerToken = ownerVerify.body.accessToken;
        const ownerClientId = ownerVerify.body.user.id;

        const { response: viewerRegister, payload: viewerPayload } =
          await registerUser({
            email: "viewer@example.com",
          });
        expect(viewerRegister.status).toBe(202);
        const viewerVerify = await verifyLatestEmail(viewerPayload.email);
        const viewerToken = viewerVerify.body.accessToken;
        const viewerClientId = viewerVerify.body.user.id;

        const notebookResponse = await request(app)
          .post("/api/notebooks")
          .set(authHeaders(ownerToken, ownerClientId))
          .send({ name: "Permission Test Notebook" });
        expect(notebookResponse.status).toBe(201);
        const notebookId = notebookResponse.body.id;

        sentEmails.length = 0;
        sendMailMock.mockClear();

        const inviteResponse = await request(app)
          .post(`/api/notebooks/${notebookId}/members`)
          .set(authHeaders(ownerToken, ownerClientId))
          .send({ email: viewerPayload.email, role: "viewer" });
        expect(inviteResponse.status).toBe(201);
        expect(sendMailMock).toHaveBeenCalledTimes(1);

        const inviteMail = sentEmails[0];
        const linkMatch = inviteMail.text.match(/https?:\/\/[^\s]+/i);
        const inviteToken = new URL(linkMatch[0]).searchParams.get("token");

        await request(app)
          .post("/api/notebooks/invitations/accept")
          .set(authHeaders(viewerToken, viewerClientId))
          .send({ token: inviteToken });

        const { response: newUserRegister, payload: newUserPayload } =
          await registerUser({
            email: "newuser@example.com",
          });
        expect(newUserRegister.status).toBe(202);
        await verifyLatestEmail(newUserPayload.email);

        const forbiddenInvite = await request(app)
          .post(`/api/notebooks/${notebookId}/members`)
          .set(authHeaders(viewerToken, viewerClientId))
          .send({ email: newUserPayload.email, role: "viewer" });

        expect(forbiddenInvite.status).toBe(403);
      }
    );

    it(
      "allows editors to view but not modify member list",
      { timeout: 10000 },
      async () => {
        const { response: ownerRegister, payload: ownerPayload } =
          await registerUser({
            email: "viewowner@example.com",
          });
        expect(ownerRegister.status).toBe(202);
        const ownerVerify = await verifyLatestEmail(ownerPayload.email);
        const ownerToken = ownerVerify.body.accessToken;
        const ownerClientId = ownerVerify.body.user.id;

        const { response: editorRegister, payload: editorPayload } =
          await registerUser({
            email: "vieweditor@example.com",
          });
        expect(editorRegister.status).toBe(202);
        const editorVerify = await verifyLatestEmail(editorPayload.email);
        const editorToken = editorVerify.body.accessToken;
        const editorClientId = editorVerify.body.user.id;

        const notebookResponse = await request(app)
          .post("/api/notebooks")
          .set(authHeaders(ownerToken, ownerClientId))
          .send({ name: "View Test Notebook" });
        expect(notebookResponse.status).toBe(201);
        const notebookId = notebookResponse.body.id;

        sentEmails.length = 0;
        sendMailMock.mockClear();

        const inviteResponse = await request(app)
          .post(`/api/notebooks/${notebookId}/members`)
          .set(authHeaders(ownerToken, ownerClientId))
          .send({ email: editorPayload.email, role: "editor" });
        expect(inviteResponse.status).toBe(201);
        expect(sendMailMock).toHaveBeenCalledTimes(1);

        const inviteMail = sentEmails[0];
        const linkMatch = inviteMail.text.match(/https?:\/\/[^\s]+/i);
        const inviteToken = new URL(linkMatch[0]).searchParams.get("token");

        await request(app)
          .post("/api/notebooks/invitations/accept")
          .set(authHeaders(editorToken, editorClientId))
          .send({ token: inviteToken });

        const listResponse = await request(app)
          .get(`/api/notebooks/${notebookId}/members`)
          .set(authHeaders(editorToken, editorClientId));
        expect(listResponse.status).toBe(200);
        expect(Array.isArray(listResponse.body.members)).toBe(true);
      }
    );

    it(
      "prevents owners from being removed or demoted",
      { timeout: 10000 },
      async () => {
        const { response: ownerRegister, payload: ownerPayload } =
          await registerUser({
            email: "protectedowner@example.com",
          });
        expect(ownerRegister.status).toBe(202);
        const ownerVerify = await verifyLatestEmail(ownerPayload.email);
        const ownerToken = ownerVerify.body.accessToken;
        const ownerClientId = ownerVerify.body.user.id;

        const notebookResponse = await request(app)
          .post("/api/notebooks")
          .set(authHeaders(ownerToken, ownerClientId))
          .send({ name: "Owner Protection Test" });
        expect(notebookResponse.status).toBe(201);
        const notebookId = notebookResponse.body.id;

        const ownerMembership = await NotebookMember.findOne({
          notebookId: new mongoose.Types.ObjectId(notebookId),
          userId: new mongoose.Types.ObjectId(ownerClientId),
        });
        expect(ownerMembership.role).toBe("owner");

        const updateResponse = await request(app)
          .patch(`/api/notebooks/${notebookId}/members/${ownerMembership._id}`)
          .set(authHeaders(ownerToken, ownerClientId))
          .send({ role: "editor" });
        expect([400, 403]).toContain(updateResponse.status);

        const deleteResponse = await request(app)
          .delete(`/api/notebooks/${notebookId}/members/${ownerMembership._id}`)
          .set(authHeaders(ownerToken, ownerClientId));
        expect([400, 403]).toContain(deleteResponse.status);
      }
    );

    it("allows owners to update member roles", { timeout: 10000 }, async () => {
      const { response: ownerRegister, payload: ownerPayload } =
        await registerUser({
          email: "roleowner@example.com",
        });
      expect(ownerRegister.status).toBe(202);
      const ownerVerify = await verifyLatestEmail(ownerPayload.email);
      const ownerToken = ownerVerify.body.accessToken;
      const ownerClientId = ownerVerify.body.user.id;

      const { response: memberRegister, payload: memberPayload } =
        await registerUser({
          email: "rolemember@example.com",
        });
      expect(memberRegister.status).toBe(202);
      const memberVerify = await verifyLatestEmail(memberPayload.email);
      const memberToken = memberVerify.body.accessToken;
      const memberClientId = memberVerify.body.user.id;

      const notebookResponse = await request(app)
        .post("/api/notebooks")
        .set(authHeaders(ownerToken, ownerClientId))
        .send({ name: "Role Update Test" });
      expect(notebookResponse.status).toBe(201);
      const notebookId = notebookResponse.body.id;

      sentEmails.length = 0;
      sendMailMock.mockClear();

      const inviteResponse = await request(app)
        .post(`/api/notebooks/${notebookId}/members`)
        .set(authHeaders(ownerToken, ownerClientId))
        .send({ email: memberPayload.email, role: "viewer" });
      expect(inviteResponse.status).toBe(201);
      expect(sendMailMock).toHaveBeenCalledTimes(1);

      const inviteMail = sentEmails[0];
      const linkMatch = inviteMail.text.match(/https?:\/\/[^\s]+/i);
      const inviteToken = new URL(linkMatch[0]).searchParams.get("token");

      await request(app)
        .post("/api/notebooks/invitations/accept")
        .set(authHeaders(memberToken, memberClientId))
        .send({ token: inviteToken });

      const updatedMembership = await NotebookMember.findOne({
        notebookId: new mongoose.Types.ObjectId(notebookId),
        userId: new mongoose.Types.ObjectId(memberClientId),
      });

      const updateResponse = await request(app)
        .patch(`/api/notebooks/${notebookId}/members/${updatedMembership._id}`)
        .set(authHeaders(ownerToken, ownerClientId))
        .send({ role: "editor" });
      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body.members).toBeDefined();

      const updatedMember = await NotebookMember.findById(
        updatedMembership._id
      );
      expect(updatedMember.role).toBe("editor");
    });

    it("allows owners to remove members", { timeout: 10000 }, async () => {
      const { response: ownerRegister, payload: ownerPayload } =
        await registerUser({
          email: "removeowner@example.com",
        });
      expect(ownerRegister.status).toBe(202);
      const ownerVerify = await verifyLatestEmail(ownerPayload.email);
      const ownerToken = ownerVerify.body.accessToken;
      const ownerClientId = ownerVerify.body.user.id;

      const { response: memberRegister, payload: memberPayload } =
        await registerUser({
          email: "removemember@example.com",
        });
      expect(memberRegister.status).toBe(202);
      const memberVerify = await verifyLatestEmail(memberPayload.email);
      const memberToken = memberVerify.body.accessToken;
      const memberClientId = memberVerify.body.user.id;

      const notebookResponse = await request(app)
        .post("/api/notebooks")
        .set(authHeaders(ownerToken, ownerClientId))
        .send({ name: "Remove Test" });
      expect(notebookResponse.status).toBe(201);
      const notebookId = notebookResponse.body.id;

      sentEmails.length = 0;
      sendMailMock.mockClear();

      const inviteResponse = await request(app)
        .post(`/api/notebooks/${notebookId}/members`)
        .set(authHeaders(ownerToken, ownerClientId))
        .send({ email: memberPayload.email, role: "viewer" });
      expect(inviteResponse.status).toBe(201);
      expect(sendMailMock).toHaveBeenCalledTimes(1);

      const inviteMail = sentEmails[0];
      const linkMatch = inviteMail.text.match(/https?:\/\/[^\s]+/i);
      const inviteToken = new URL(linkMatch[0]).searchParams.get("token");

      await request(app)
        .post("/api/notebooks/invitations/accept")
        .set(authHeaders(memberToken, memberClientId))
        .send({ token: inviteToken });

      const updatedMembership = await NotebookMember.findOne({
        notebookId: new mongoose.Types.ObjectId(notebookId),
        userId: new mongoose.Types.ObjectId(memberClientId),
      });

      const removeResponse = await request(app)
        .delete(`/api/notebooks/${notebookId}/members/${updatedMembership._id}`)
        .set(authHeaders(ownerToken, ownerClientId));
      expect(removeResponse.status).toBe(200);

      const checkMembership = await NotebookMember.findById(
        updatedMembership._id
      );
      expect(checkMembership.status).toBe("revoked");
      expect(checkMembership.revokedAt).toBeDefined();
    });

    it(
      "cascades notebook permissions to notes",
      { timeout: 10000 },
      async () => {
        const { response: ownerRegister, payload: ownerPayload } =
          await registerUser({
            email: "cascadeowner@example.com",
          });
        expect(ownerRegister.status).toBe(202);
        const ownerVerify = await verifyLatestEmail(ownerPayload.email);
        const ownerToken = ownerVerify.body.accessToken;
        const ownerClientId = ownerVerify.body.user.id;

        const { response: memberRegister, payload: memberPayload } =
          await registerUser({
            email: "cascademember@example.com",
          });
        expect(memberRegister.status).toBe(202);
        const memberVerify = await verifyLatestEmail(memberPayload.email);
        const memberToken = memberVerify.body.accessToken;
        const memberClientId = memberVerify.body.user.id;

        const notebookResponse = await request(app)
          .post("/api/notebooks")
          .set(authHeaders(ownerToken, ownerClientId))
          .send({ name: "Cascade Test Notebook" });
        expect(notebookResponse.status).toBe(201);
        const notebookId = notebookResponse.body.id;

        const noteResponse = await request(app)
          .post("/api/notes")
          .set(authHeaders(ownerToken, ownerClientId))
          .send({
            title: "Notebook Note",
            content: "Test content",
            tags: [],
            notebookId,
          });
        expect(noteResponse.status).toBe(201);
        const noteId = noteResponse.body._id;

        const forbiddenAccess = await request(app)
          .get(`/api/notes/${noteId}`)
          .set(authHeaders(memberToken, memberClientId));
        expect(forbiddenAccess.status).toBe(404);

        sentEmails.length = 0;
        sendMailMock.mockClear();

        const inviteResponse = await request(app)
          .post(`/api/notebooks/${notebookId}/members`)
          .set(authHeaders(ownerToken, ownerClientId))
          .send({ email: memberPayload.email, role: "viewer" });
        expect(inviteResponse.status).toBe(201);
        expect(sendMailMock).toHaveBeenCalledTimes(1);

        const inviteMail = sentEmails[0];
        const linkMatch = inviteMail.text.match(/https?:\/\/[^\s]+/i);
        const inviteToken = new URL(linkMatch[0]).searchParams.get("token");

        await request(app)
          .post("/api/notebooks/invitations/accept")
          .set(authHeaders(memberToken, memberClientId))
          .send({ token: inviteToken });

        const allowedAccess = await request(app)
          .get(`/api/notes/${noteId}`)
          .set(authHeaders(memberToken, memberClientId));
        expect(allowedAccess.status).toBe(200);
        expect(allowedAccess.body._id).toBe(noteId);

        const forbiddenEdit = await request(app)
          .put(`/api/notes/${noteId}`)
          .set(authHeaders(memberToken, memberClientId))
          .send({ title: "Hacked" });
        expect(forbiddenEdit.status).toBe(403);
      }
    );
  });

  describe("Invitation Lifecycle", () => {
    it(
      "prevents duplicate invitations to the same email",
      { timeout: 10000 },
      async () => {
        const { response: ownerRegister, payload: ownerPayload } =
          await registerUser({
            email: "dupowner@example.com",
          });
        expect(ownerRegister.status).toBe(202);
        const ownerVerify = await verifyLatestEmail(ownerPayload.email);
        const ownerToken = ownerVerify.body.accessToken;
        const ownerClientId = ownerVerify.body.user.id;

        const { response: memberRegister, payload: memberPayload } =
          await registerUser({
            email: "duplicatetest@example.com",
          });
        expect(memberRegister.status).toBe(202);
        const memberVerify = await verifyLatestEmail(memberPayload.email);
        const memberToken = memberVerify.body.accessToken;
        const memberClientId = memberVerify.body.user.id;

        const notebookResponse = await request(app)
          .post("/api/notebooks")
          .set(authHeaders(ownerToken, ownerClientId))
          .send({ name: "Duplicate Test" });
        expect(notebookResponse.status).toBe(201);
        const notebookId = notebookResponse.body.id;

        sentEmails.length = 0;
        sendMailMock.mockClear();

        const firstInvite = await request(app)
          .post(`/api/notebooks/${notebookId}/members`)
          .set(authHeaders(ownerToken, ownerClientId))
          .send({ email: memberPayload.email, role: "viewer" });
        expect(firstInvite.status).toBe(201);
        expect(sendMailMock).toHaveBeenCalledTimes(1);

        const inviteMail = sentEmails[0];
        const linkMatch = inviteMail.text.match(/https?:\/\/[^\s]+/i);
        const inviteToken = new URL(linkMatch[0]).searchParams.get("token");

        await request(app)
          .post("/api/notebooks/invitations/accept")
          .set(authHeaders(memberToken, memberClientId))
          .send({ token: inviteToken });

        const secondInvite = await request(app)
          .post(`/api/notebooks/${notebookId}/members`)
          .set(authHeaders(ownerToken, ownerClientId))
          .send({ email: memberPayload.email, role: "editor" });
        expect(secondInvite.status).toBe(409);
      }
    );

    it("rejects expired invitation tokens", async () => {
      const { response: ownerRegister, payload: ownerPayload } =
        await registerUser({
          email: "expiredowner@example.com",
        });
      expect(ownerRegister.status).toBe(202);
      const ownerVerify = await verifyLatestEmail(ownerPayload.email);
      const ownerToken = ownerVerify.body.accessToken;
      const ownerClientId = ownerVerify.body.user.id;

      const { response: memberRegister, payload: memberPayload } =
        await registerUser({
          email: "expiredmember@example.com",
        });
      expect(memberRegister.status).toBe(202);
      const memberVerify = await verifyLatestEmail(memberPayload.email);
      const memberToken = memberVerify.body.accessToken;
      const memberClientId = memberVerify.body.user.id;

      const notebookResponse = await request(app)
        .post("/api/notebooks")
        .set(authHeaders(ownerToken, ownerClientId))
        .send({ name: "Expired Invite Test" });
      expect(notebookResponse.status).toBe(201);
      const notebookId = notebookResponse.body.id;

      sentEmails.length = 0;
      sendMailMock.mockClear();

      const inviteResponse = await request(app)
        .post(`/api/notebooks/${notebookId}/members`)
        .set(authHeaders(ownerToken, ownerClientId))
        .send({ email: memberPayload.email, role: "viewer" });
      expect(inviteResponse.status).toBe(201);
      expect(sendMailMock).toHaveBeenCalledTimes(1);

      const inviteMail = sentEmails[0];
      const linkMatch = inviteMail.text.match(/https?:\/\/[^\s]+/i);
      const inviteToken = new URL(linkMatch[0]).searchParams.get("token");

      const membership = await NotebookMember.findOne({
        notebookId: new mongoose.Types.ObjectId(notebookId),
        userId: new mongoose.Types.ObjectId(memberVerify.body.user.id),
      });
      membership.inviteExpiresAt = new Date(Date.now() - 1000);
      await membership.save();

      const acceptResponse = await request(app)
        .post("/api/notebooks/invitations/accept")
        .set(authHeaders(memberToken, memberClientId))
        .send({ token: inviteToken });
      expect([400, 410]).toContain(acceptResponse.status);
    });
  });
});
