import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

import Workspace from "../src/models/Workspace.js";
import Notebook from "../src/models/Notebook.js";
import NotebookMember from "../src/models/NotebookMember.js";
import Note from "../src/models/Note.js";
import NoteCollaborator from "../src/models/NoteCollaborator.js";
import {
  getWorkspaceMembership,
  ensureWorkspaceMember,
  getNotebookMembership,
  ensureNotebookAccess,
  resolveNoteForUser,
  listAccessibleWorkspaceIds,
} from "../src/utils/access.js";

let mongo;
let slugSeq = 0;
const slug = () => `test-ws-${Date.now()}-${++slugSeq}`;

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri(), { dbName: "accessUtilTest" });
});

afterEach(async () => {
  await Promise.all([
    Workspace.deleteMany({}),
    Notebook.deleteMany({}),
    NotebookMember.deleteMany({}),
    Note.deleteMany({}),
    NoteCollaborator.deleteMany({}),
  ]);
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

// ── getWorkspaceMembership ──────────────────────────────────────────────────

describe("getWorkspaceMembership", () => {
  it("returns owner role when userId is the workspace owner", async () => {
    const ownerId = new mongoose.Types.ObjectId();
    const ws = await Workspace.create({ name: "WS", slug: slug(), ownerId });

    const result = await getWorkspaceMembership(ws._id.toString(), ownerId.toString());

    expect(result).not.toBeNull();
    expect(result.member.role).toBe("owner");
    expect(result.workspace._id.toString()).toBe(ws._id.toString());
  });

  it("returns the member record for an active member", async () => {
    const ownerId = new mongoose.Types.ObjectId();
    const memberId = new mongoose.Types.ObjectId();
    const ws = await Workspace.create({
      name: "WS",
      slug: slug(),
      ownerId,
      members: [{ userId: memberId, role: "editor", status: "active" }],
    });

    const result = await getWorkspaceMembership(ws._id.toString(), memberId.toString());

    expect(result).not.toBeNull();
    expect(result.member.role).toBe("editor");
  });

  it("returns null for a revoked member", async () => {
    const ownerId = new mongoose.Types.ObjectId();
    const memberId = new mongoose.Types.ObjectId();
    const ws = await Workspace.create({
      name: "WS",
      slug: slug(),
      ownerId,
      members: [{ userId: memberId, role: "editor", status: "revoked" }],
    });

    const result = await getWorkspaceMembership(ws._id.toString(), memberId.toString());

    expect(result).toBeNull();
  });

  it("returns null when workspace does not exist", async () => {
    const result = await getWorkspaceMembership(
      new mongoose.Types.ObjectId().toString(),
      new mongoose.Types.ObjectId().toString(),
    );
    expect(result).toBeNull();
  });

  it("returns null for invalid ObjectId strings", async () => {
    expect(await getWorkspaceMembership("not-an-id", "not-an-id")).toBeNull();
  });

  it("returns null when called with null", async () => {
    expect(await getWorkspaceMembership(null, null)).toBeNull();
  });
});

// ── ensureWorkspaceMember ───────────────────────────────────────────────────

describe("ensureWorkspaceMember", () => {
  it("throws a 403 error when user is not a workspace member", async () => {
    const ownerId = new mongoose.Types.ObjectId();
    const stranger = new mongoose.Types.ObjectId();
    const ws = await Workspace.create({ name: "WS", slug: slug(), ownerId });

    const err = await ensureWorkspaceMember(
      ws._id.toString(),
      stranger.toString(),
    ).catch((e) => e);

    expect(err).toBeInstanceOf(Error);
    expect(err.status).toBe(403);
    expect(err.message).toMatch(/workspace access denied/i);
  });

  it("returns the membership when user is the owner", async () => {
    const ownerId = new mongoose.Types.ObjectId();
    const ws = await Workspace.create({ name: "WS", slug: slug(), ownerId });

    const result = await ensureWorkspaceMember(ws._id.toString(), ownerId.toString());

    expect(result.member.role).toBe("owner");
  });
});

// ── getNotebookMembership ───────────────────────────────────────────────────

describe("getNotebookMembership", () => {
  it("returns owner role when userId is the notebook owner", async () => {
    const ownerId = new mongoose.Types.ObjectId();
    const notebook = await Notebook.create({ owner: ownerId, name: "My NB" });

    const result = await getNotebookMembership(
      notebook._id.toString(),
      ownerId.toString(),
    );

    expect(result).not.toBeNull();
    expect(result.membership.role).toBe("owner");
  });

  it("returns member record for an active notebook member", async () => {
    const ownerId = new mongoose.Types.ObjectId();
    const editorId = new mongoose.Types.ObjectId();
    const notebook = await Notebook.create({ owner: ownerId, name: "Shared NB" });
    await NotebookMember.create({
      notebookId: notebook._id,
      userId: editorId,
      role: "editor",
      status: "active",
    });

    const result = await getNotebookMembership(
      notebook._id.toString(),
      editorId.toString(),
    );

    expect(result).not.toBeNull();
    expect(result.membership.role).toBe("editor");
  });

  it("returns null for a pending (not yet accepted) member", async () => {
    const ownerId = new mongoose.Types.ObjectId();
    const inviteeId = new mongoose.Types.ObjectId();
    const notebook = await Notebook.create({ owner: ownerId, name: "Pending NB" });
    await NotebookMember.create({
      notebookId: notebook._id,
      userId: inviteeId,
      role: "editor",
      status: "pending",
    });

    const result = await getNotebookMembership(
      notebook._id.toString(),
      inviteeId.toString(),
    );

    expect(result).toBeNull();
  });

  it("returns null when notebook does not exist", async () => {
    const result = await getNotebookMembership(
      new mongoose.Types.ObjectId().toString(),
      new mongoose.Types.ObjectId().toString(),
    );
    expect(result).toBeNull();
  });

  it("returns null for invalid ObjectId strings", async () => {
    expect(await getNotebookMembership("bad-id", "also-bad")).toBeNull();
  });
});

// ── ensureNotebookAccess ────────────────────────────────────────────────────

describe("ensureNotebookAccess", () => {
  it("throws 403 for a user with no notebook access", async () => {
    const ownerId = new mongoose.Types.ObjectId();
    const stranger = new mongoose.Types.ObjectId();
    const notebook = await Notebook.create({ owner: ownerId, name: "Private NB" });

    const err = await ensureNotebookAccess(
      notebook._id.toString(),
      stranger.toString(),
    ).catch((e) => e);

    expect(err).toBeInstanceOf(Error);
    expect(err.status).toBe(403);
    expect(err.message).toMatch(/notebook access denied/i);
  });

  it("resolves successfully for an active notebook member", async () => {
    const ownerId = new mongoose.Types.ObjectId();
    const viewerId = new mongoose.Types.ObjectId();
    const notebook = await Notebook.create({ owner: ownerId, name: "Shared NB" });
    await NotebookMember.create({
      notebookId: notebook._id,
      userId: viewerId,
      role: "viewer",
      status: "active",
    });

    const result = await ensureNotebookAccess(
      notebook._id.toString(),
      viewerId.toString(),
    );

    expect(result.membership.role).toBe("viewer");
  });
});

// ── resolveNoteForUser ──────────────────────────────────────────────────────

describe("resolveNoteForUser", () => {
  it("grants full owner permissions to the note owner", async () => {
    const ownerId = new mongoose.Types.ObjectId();
    const note = await Note.create({ owner: ownerId, title: "My Note", content: "." });

    const result = await resolveNoteForUser(note._id.toString(), ownerId.toString());

    expect(result).not.toBeNull();
    expect(result.permissions.isOwner).toBe(true);
    expect(result.permissions.canEdit).toBe(true);
    expect(result.permissions.canManageCollaborators).toBe(true);
    expect(result.permissions.effectiveRole).toBe("owner");
  });

  it("returns null for a user with no access path", async () => {
    const ownerId = new mongoose.Types.ObjectId();
    const stranger = new mongoose.Types.ObjectId();
    const note = await Note.create({ owner: ownerId, title: "Private", content: "." });

    const result = await resolveNoteForUser(note._id.toString(), stranger.toString());

    expect(result).toBeNull();
  });

  it("grants editor permissions via active notebook editor membership", async () => {
    const ownerId = new mongoose.Types.ObjectId();
    const editorId = new mongoose.Types.ObjectId();
    const notebook = await Notebook.create({ owner: ownerId, name: "NB" });
    const note = await Note.create({
      owner: ownerId,
      notebookId: notebook._id,
      title: "Shared",
      content: ".",
    });
    await NotebookMember.create({
      notebookId: notebook._id,
      userId: editorId,
      role: "editor",
      status: "active",
    });

    const result = await resolveNoteForUser(note._id.toString(), editorId.toString());

    expect(result).not.toBeNull();
    expect(result.permissions.canEdit).toBe(true);
    expect(result.permissions.effectiveRole).toBe("editor");
  });

  it("grants comment-only permissions via notebook viewer membership", async () => {
    const ownerId = new mongoose.Types.ObjectId();
    const viewerId = new mongoose.Types.ObjectId();
    const notebook = await Notebook.create({ owner: ownerId, name: "NB" });
    const note = await Note.create({
      owner: ownerId,
      notebookId: notebook._id,
      title: "Viewable",
      content: ".",
    });
    await NotebookMember.create({
      notebookId: notebook._id,
      userId: viewerId,
      role: "viewer",
      status: "active",
    });

    const result = await resolveNoteForUser(note._id.toString(), viewerId.toString());

    expect(result).not.toBeNull();
    expect(result.permissions.canEdit).toBeFalsy();
    // "viewer" notebook role is in NOTEBOOK_VIEW_ROLES → canComment = true
    expect(result.permissions.canComment).toBe(true);
    expect(result.permissions.canManageCollaborators).toBeFalsy();
    // canEdit=false, canComment=true → effectiveRole="commenter"
    expect(result.permissions.effectiveRole).toBe("commenter");
  });

  it("grants commenter permissions via direct NoteCollaborator (commenter role)", async () => {
    const ownerId = new mongoose.Types.ObjectId();
    const commenterId = new mongoose.Types.ObjectId();
    const note = await Note.create({ owner: ownerId, title: "Collab", content: "." });
    await NoteCollaborator.create({
      noteId: note._id,
      userId: commenterId,
      invitedBy: ownerId,
      role: "commenter",
    });

    const result = await resolveNoteForUser(note._id.toString(), commenterId.toString());

    expect(result).not.toBeNull();
    expect(result.permissions.canEdit).toBeFalsy();
    expect(result.permissions.canComment).toBe(true);
    expect(result.permissions.effectiveRole).toBe("commenter");
  });

  it("grants edit permissions via direct NoteCollaborator (editor role)", async () => {
    const ownerId = new mongoose.Types.ObjectId();
    const editorId = new mongoose.Types.ObjectId();
    const note = await Note.create({ owner: ownerId, title: "Editable", content: "." });
    await NoteCollaborator.create({
      noteId: note._id,
      userId: editorId,
      invitedBy: ownerId,
      role: "editor",
    });

    const result = await resolveNoteForUser(note._id.toString(), editorId.toString());

    expect(result).not.toBeNull();
    expect(result.permissions.canEdit).toBe(true);
    expect(result.permissions.effectiveRole).toBe("editor");
  });

  it("returns null for an invalid noteId", async () => {
    const result = await resolveNoteForUser(
      "not-valid",
      new mongoose.Types.ObjectId().toString(),
    );
    expect(result).toBeNull();
  });

  it("returns null when the note does not exist", async () => {
    const result = await resolveNoteForUser(
      new mongoose.Types.ObjectId().toString(),
      new mongoose.Types.ObjectId().toString(),
    );
    expect(result).toBeNull();
  });

  it("returns null when called with null arguments", async () => {
    expect(await resolveNoteForUser(null, null)).toBeNull();
  });
});

// ── listAccessibleWorkspaceIds ──────────────────────────────────────────────

describe("listAccessibleWorkspaceIds", () => {
  it("returns both owned and member workspace ids", async () => {
    const userId = new mongoose.Types.ObjectId();
    const owned = await Workspace.create({
      name: "Owned",
      slug: slug(),
      ownerId: userId,
    });
    const member = await Workspace.create({
      name: "Member",
      slug: slug(),
      ownerId: new mongoose.Types.ObjectId(),
      members: [{ userId, role: "editor", status: "active" }],
    });

    const ids = await listAccessibleWorkspaceIds(userId.toString());

    expect(ids).toContain(owned._id.toString());
    expect(ids).toContain(member._id.toString());
  });

  it("returns an empty array when user has no workspaces", async () => {
    const ids = await listAccessibleWorkspaceIds(
      new mongoose.Types.ObjectId().toString(),
    );
    expect(ids).toEqual([]);
  });

  it("returns an empty array for an invalid userId", async () => {
    expect(await listAccessibleWorkspaceIds("not-valid")).toEqual([]);
    expect(await listAccessibleWorkspaceIds(null)).toEqual([]);
  });
});
