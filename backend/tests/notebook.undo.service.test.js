import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

import Notebook from "../src/models/Notebook.js";
import Note from "../src/models/Note.js";
import NotebookMember from "../src/models/NotebookMember.js";
import ShareLink from "../src/models/ShareLink.js";
import NotebookPublication from "../src/models/NotebookPublication.js";
import CollabDocument from "../src/models/CollabDocument.js";
import NotebookIndex from "../src/models/NotebookIndex.js";
import { applyUndoForNotebookEvent } from "../src/services/notebookUndoService.js";

let mongo;

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri(), {
    dbName: "notebookUndoTest",
  });
});

afterEach(async () => {
  await Promise.all([
    Note.deleteMany({}),
    Notebook.deleteMany({}),
    NotebookMember.deleteMany({}),
    ShareLink.deleteMany({}),
    NotebookPublication.deleteMany({}),
    CollabDocument.deleteMany({}),
    NotebookIndex.deleteMany({}),
  ]);
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongo) {
    await mongo.stop();
  }
});

describe("notebook undo service", () => {
  it("deletes a newly created notebook when undoing create", async () => {
    const ownerId = new mongoose.Types.ObjectId();

    const notebook = await Notebook.create({
      owner: ownerId,
      name: "Temporary Notebook",
    });

    const event = {
      payload: {},
      inversePayload: {
        action: "deleteNotebook",
      },
    };

    const result = await applyUndoForNotebookEvent({
      notebook,
      event,
      session: null,
    });

    expect(result).toMatchObject({ supported: true, action: "deleteNotebook" });

    const notebooks = await Notebook.find({});
    expect(notebooks).toHaveLength(0);
  });

  it("restores notebook, notes, members, share links, collab docs, and publication", async () => {
    const ownerId = new mongoose.Types.ObjectId();
    const notebookId = new mongoose.Types.ObjectId();
    const noteId = new mongoose.Types.ObjectId();
    const publishedAt = new Date().toISOString();

    const inversePayload = {
      action: "restoreNotebook",
      notebook: {
        id: notebookId.toString(),
        owner: ownerId.toString(),
        workspaceId: null,
        name: "Restored Notebook",
        description: "Recovered description",
        color: null,
        icon: null,
        isPublic: true,
        publicSlug: "restored-notebook",
        publicMetadata: { theme: "dark" },
        publishedAt,
        noteOrder: [noteId.toString()],
        offlineRevision: 3,
        offlineSnapshotHash: "snapshot-hash",
        offlineSnapshotUpdatedAt: new Date().toISOString(),
      },
      notes: [
        {
          id: noteId.toString(),
          owner: ownerId.toString(),
          workspaceId: null,
          boardId: null,
          title: "Recovered note",
          content: "Recovered content",
          contentText: "Recovered content",
          tags: ["recovered"],
          pinned: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          docName: "note:restored",
          richContent: { blocks: [] },
        },
      ],
      members: [
        {
          userId: ownerId.toString(),
          role: "owner",
          status: "active",
          invitedAt: new Date().toISOString(),
          acceptedAt: new Date().toISOString(),
          metadata: {},
        },
      ],
      shareLinks: [
        {
          resourceType: "notebook",
          tokenHash: "token-hash",
          role: "viewer",
          expiresAt: null,
          createdBy: ownerId.toString(),
          metadata: {},
        },
      ],
      collabDocuments: [
        {
          name: "note:restored",
          state: Buffer.from("collab-state").toString("base64"),
          awareness: {},
          updatedAt: new Date().toISOString(),
        },
      ],
      publication: {
        ownerId: ownerId.toString(),
        publicSlug: "restored-notebook",
        snapshot: { title: "Restored Notebook" },
        snapshotHash: "pub-hash",
        html: "<p>Restored</p>",
        metadata: { layout: "grid" },
        publishedAt,
      },
      deleteCollaborative: true,
    };

    const event = {
      payload: {
        mode: "delete",
        noteIds: [noteId.toString()],
      },
      inversePayload,
    };

    const notebookStub = {
      _id: notebookId,
      owner: ownerId,
      workspaceId: null,
    };

    const result = await applyUndoForNotebookEvent({
      notebook: notebookStub,
      event,
      session: null,
    });

    expect(result).toMatchObject({
      supported: true,
      action: "restoreNotebook",
    });
    expect(result.affectedNotebookIds).toContain(notebookId.toString());

    const restoredNotebook = await Notebook.findById(notebookId).lean();
    expect(restoredNotebook).not.toBeNull();
    expect(restoredNotebook?.name).toBe("Restored Notebook");
    expect(restoredNotebook?.isPublic).toBe(true);
    expect(restoredNotebook?.publicSlug).toBe("restored-notebook");

    const restoredNote = await Note.findById(noteId).lean();
    expect(restoredNote).not.toBeNull();
    expect(restoredNote?.notebookId?.toString()).toBe(notebookId.toString());
    expect(restoredNote?.title).toBe("Recovered note");
    expect(restoredNote?.pinned).toBe(true);

    const members = await NotebookMember.find({ notebookId }).lean();
    expect(members).toHaveLength(1);
    expect(members[0].userId.toString()).toBe(ownerId.toString());

    const shareLinks = await ShareLink.find({ notebookId }).lean();
    expect(shareLinks).toHaveLength(1);
    expect(shareLinks[0].tokenHash).toBe("token-hash");

    const collabDocs = await CollabDocument.find({
      name: "note:restored",
    }).lean();
    expect(collabDocs).toHaveLength(1);

    const publication = await NotebookPublication.findOne({
      notebookId,
    }).lean();
    expect(publication).not.toBeNull();
    expect(publication?.publicSlug).toBe("restored-notebook");
  });

  describe("restoreNotebookPublication", () => {
    it("reverts a publish action back to private", async () => {
      const ownerId = new mongoose.Types.ObjectId();
      const notebook = await Notebook.create({
        owner: ownerId,
        name: "Publish Undo",
        isPublic: true,
        publicSlug: "fresh-slug",
        publicMetadata: { hero: "sun" },
        publishedAt: new Date(),
      });

      await NotebookPublication.create({
        notebookId: notebook._id,
        ownerId,
        publicSlug: "fresh-slug",
        publishedAt: new Date(),
      });

      const event = {
        payload: {},
        inversePayload: {
          action: "restoreNotebookPublication",
          previous: {
            isPublic: false,
            publicSlug: null,
            publicMetadata: null,
            publishedAt: null,
            offlineSnapshotHash: null,
            offlineSnapshotUpdatedAt: null,
            publication: null,
          },
        },
      };

      const result = await applyUndoForNotebookEvent({
        notebook,
        event,
        session: null,
      });
      expect(result).toMatchObject({
        supported: true,
        action: "restoreNotebookPublication",
      });

      const updatedNotebook = await Notebook.findById(notebook._id).lean();
      expect(updatedNotebook).not.toBeNull();
      expect(updatedNotebook?.isPublic).toBe(false);
      expect(updatedNotebook?.publicSlug).toBeNull();

      const publications = await NotebookPublication.find({
        notebookId: notebook._id,
      });
      expect(publications).toHaveLength(0);
    });

    it("restores publication metadata when undoing unpublish", async () => {
      const ownerId = new mongoose.Types.ObjectId();
      const notebook = await Notebook.create({
        owner: ownerId,
        name: "Unpublish Undo",
        isPublic: false,
        publicSlug: null,
        publicMetadata: null,
        publishedAt: null,
      });

      const previousState = {
        isPublic: true,
        publicSlug: "republished",
        publicMetadata: { accent: "blue" },
        publishedAt: new Date().toISOString(),
        offlineSnapshotHash: "hash",
        offlineSnapshotUpdatedAt: new Date().toISOString(),
        publication: {
          ownerId: ownerId.toString(),
          publicSlug: "republished",
          snapshot: { title: "Notebook" },
          snapshotHash: "hash",
          html: "<main>Notebook</main>",
          metadata: { accent: "blue" },
          publishedAt: new Date().toISOString(),
        },
      };

      const event = {
        payload: {},
        inversePayload: {
          action: "restoreNotebookPublication",
          previous: previousState,
        },
      };

      const result = await applyUndoForNotebookEvent({
        notebook,
        event,
        session: null,
      });
      expect(result).toMatchObject({
        supported: true,
        action: "restoreNotebookPublication",
      });

      const updatedNotebook = await Notebook.findById(notebook._id).lean();
      expect(updatedNotebook).not.toBeNull();
      expect(updatedNotebook?.isPublic).toBe(true);
      expect(updatedNotebook?.publicSlug).toBe("republished");
      expect(updatedNotebook?.publicMetadata).toEqual({ accent: "blue" });

      const publication = await NotebookPublication.findOne({
        notebookId: notebook._id,
      }).lean();
      expect(publication).not.toBeNull();
      expect(publication?.publicSlug).toBe("republished");
    });
  });
});
