import mongoose from "mongoose";
import Notebook from "../models/Notebook.js";
import Note from "../models/Note.js";
import NotebookPublication from "../models/NotebookPublication.js";
import logger from "../utils/logger.js";
import {
  computeNotebookSnapshotHash,
  ensureNotebookOwnership,
  generateNotebookPublicSlug,
  normalizeNotebookPublicSlug,
} from "../utils/notebooks.js";
import { appendNotebookEvent } from "../services/notebookEventService.js";

const INTERNAL_SERVER_ERROR = { message: "Internal server error" };

const toPlainObject = (value) => {
  if (!value) {
    return null;
  }
  if (value instanceof Map) {
    return Object.fromEntries(value.entries());
  }
  if (typeof value === "object" && !Array.isArray(value)) {
    return value;
  }
  return null;
};

const buildNotebookPublicationSnapshot = async ({ notebook }) => {
  if (!notebook) {
    return null;
  }

  const notes = await Note.find({ notebookId: notebook._id })
    .sort({ pinned: -1, updatedAt: -1 })
    .select({
      _id: 1,
      title: 1,
      content: 1,
      contentText: 1,
      tags: 1,
      pinned: 1,
      updatedAt: 1,
      createdAt: 1,
    })
    .lean();

  const serializedNotes = notes.map((note) => ({
    id: note._id.toString(),
    title: note.title,
    content: note.content,
    contentText: note.contentText ?? note.content ?? "",
    tags: Array.isArray(note.tags) ? note.tags : [],
    pinned: Boolean(note.pinned),
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
  }));

  return {
    notebook: {
      id: notebook._id.toString(),
      name: notebook.name,
      description: notebook.description,
      color: notebook.color,
      icon: notebook.icon,
      owner: notebook.owner?.toString?.() ?? null,
      workspaceId: notebook.workspaceId?.toString?.() ?? null,
      publishedAt: notebook.publishedAt ?? new Date(),
      noteOrder: Array.isArray(notebook.noteOrder)
        ? notebook.noteOrder.map((id) => id.toString())
        : [],
    },
    notes: serializedNotes,
    generatedAt: new Date().toISOString(),
  };
};

export const getNotebookPublishingState = async (req, res) => {
  try {
    const ownerId = req.user?.id;
    if (!ownerId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { id } = req.params;
    const notebook = await ensureNotebookOwnership(id, ownerId);
    if (!notebook) {
      return res.status(404).json({ message: "Notebook not found" });
    }

    const publication = await NotebookPublication.findOne({
      notebookId: notebook._id,
    })
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      isPublic: Boolean(notebook.isPublic),
      slug: notebook.publicSlug ?? null,
      publishedAt: notebook.publishedAt ?? null,
      metadata: toPlainObject(notebook.publicMetadata) ?? {},
      snapshotHash: notebook.offlineSnapshotHash ?? null,
      lastPublishedAt: publication?.updatedAt ?? publication?.createdAt ?? null,
    });
  } catch (error) {
    logger.error("Failed to fetch notebook publishing state", {
      message: error?.message,
    });
    return res.status(500).json(INTERNAL_SERVER_ERROR);
  }
};

export const publishNotebook = async (req, res) => {
  const session = await mongoose.startSession();
  let responsePayload = null;
  try {
    const ownerId = req.user?.id;
    if (!ownerId) {
      await session.endSession();
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { id } = req.params;
    const { slug: requestedSlug, metadata = null } = req.body ?? {};
    const actorObjectId = new mongoose.Types.ObjectId(ownerId);

    await session.withTransaction(async () => {
      const notebook = await Notebook.findOne({
        _id: id,
        owner: actorObjectId,
      }).session(session);

      if (!notebook) {
        throw new Error("NOTEBOOK_NOT_FOUND");
      }

      const existingPublication = await NotebookPublication.findOne({
        notebookId: notebook._id,
      })
        .session(session)
        .lean();

      const previousState = {
        isPublic: Boolean(notebook.isPublic),
        publicSlug: notebook.publicSlug ?? null,
        publicMetadata: toPlainObject(notebook.publicMetadata) ?? null,
        publishedAt: notebook.publishedAt ?? null,
        offlineSnapshotHash: notebook.offlineSnapshotHash ?? null,
        offlineSnapshotUpdatedAt: notebook.offlineSnapshotUpdatedAt ?? null,
        publication: existingPublication
          ? {
              ownerId: existingPublication.ownerId?.toString?.() ?? null,
              publicSlug: existingPublication.publicSlug ?? null,
              snapshot: toPlainObject(existingPublication.snapshot) ?? null,
              snapshotHash: existingPublication.snapshotHash ?? null,
              html: existingPublication.html ?? null,
              metadata: toPlainObject(existingPublication.metadata) ?? {},
              createdAt: existingPublication.createdAt ?? null,
              updatedAt: existingPublication.updatedAt ?? null,
              publishedAt: existingPublication.publishedAt ?? null,
            }
          : null,
      };

      const normalizedSlug = (() => {
        if (requestedSlug === undefined || requestedSlug === null) {
          return generateNotebookPublicSlug();
        }
        return normalizeNotebookPublicSlug(requestedSlug);
      })();

      if (!normalizedSlug) {
        throw new Error("INVALID_SLUG");
      }

      const snapshot = await buildNotebookPublicationSnapshot({ notebook });
      const snapshotHash = computeNotebookSnapshotHash(snapshot);

      let metadataObject = null;
      if (metadata && typeof metadata === "object") {
        try {
          metadataObject = JSON.parse(JSON.stringify(metadata));
        } catch (_error) {
          throw new Error("INVALID_METADATA");
        }
      }

      const publishedAt = notebook.publishedAt ?? new Date();

      notebook.set({
        isPublic: true,
        publicSlug: normalizedSlug,
        publishedAt,
        publicMetadata: metadataObject,
        offlineSnapshotHash: snapshotHash,
        offlineSnapshotUpdatedAt: new Date(),
      });

      await notebook.save({ session });

      await NotebookPublication.findOneAndUpdate(
        { notebookId: notebook._id },
        {
          $set: {
            ownerId: notebook.owner,
            publicSlug: normalizedSlug,
            snapshot,
            snapshotHash,
            html: null,
            metadata: metadataObject,
            publishedAt,
          },
        },
        { upsert: true, new: true, session }
      );

      await appendNotebookEvent(
        {
          notebookId: notebook._id,
          ownerId: notebook.owner,
          workspaceId: notebook.workspaceId ?? null,
          actorId: actorObjectId,
          eventType: "notebook.publish",
          commandName: "publishNotebook",
          summary: `Published notebook ${notebook.name}`,
          payload: {
            slug: normalizedSlug,
            publishedAt,
          },
          inversePayload: {
            action: "restoreNotebookPublication",
            previous: previousState,
          },
        },
        { session }
      );

      responsePayload = {
        isPublic: true,
        slug: normalizedSlug,
        publishedAt,
        metadata: metadataObject ?? {},
        snapshotHash,
      };
    });
  } catch (error) {
    await session.endSession();
    if (error?.message === "NOTEBOOK_NOT_FOUND") {
      return res.status(404).json({ message: "Notebook not found" });
    }
    if (error?.message === "INVALID_SLUG") {
      return res.status(400).json({ message: "Invalid slug provided" });
    }
    if (error?.message === "INVALID_METADATA") {
      return res.status(400).json({ message: "Metadata must be serializable" });
    }
    if (error?.code === 11000) {
      return res.status(409).json({ message: "Slug already in use" });
    }
    logger.error("Failed to publish notebook", { message: error?.message });
    return res.status(500).json(INTERNAL_SERVER_ERROR);
  }

  await session.endSession();
  if (responsePayload) {
    return res.status(200).json(responsePayload);
  }
  return undefined;
};

export const unpublishNotebook = async (req, res) => {
  const session = await mongoose.startSession();
  let responsePayload = null;
  try {
    const ownerId = req.user?.id;
    if (!ownerId) {
      await session.endSession();
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { id } = req.params;
    const actorObjectId = new mongoose.Types.ObjectId(ownerId);

    await session.withTransaction(async () => {
      const notebook = await Notebook.findOne({
        _id: id,
        owner: actorObjectId,
      }).session(session);

      if (!notebook) {
        throw new Error("NOTEBOOK_NOT_FOUND");
      }

      const publicationDoc = await NotebookPublication.findOne({
        notebookId: notebook._id,
      })
        .session(session)
        .lean();

      const previousState = {
        isPublic: Boolean(notebook.isPublic),
        publicSlug: notebook.publicSlug ?? null,
        publicMetadata: toPlainObject(notebook.publicMetadata) ?? null,
        publishedAt: notebook.publishedAt ?? null,
        offlineSnapshotHash: notebook.offlineSnapshotHash ?? null,
        offlineSnapshotUpdatedAt: notebook.offlineSnapshotUpdatedAt ?? null,
        publication: publicationDoc
          ? {
              ownerId: publicationDoc.ownerId?.toString?.() ?? null,
              publicSlug: publicationDoc.publicSlug ?? null,
              snapshot: toPlainObject(publicationDoc.snapshot) ?? null,
              snapshotHash: publicationDoc.snapshotHash ?? null,
              html: publicationDoc.html ?? null,
              metadata: toPlainObject(publicationDoc.metadata) ?? {},
              createdAt: publicationDoc.createdAt ?? null,
              updatedAt: publicationDoc.updatedAt ?? null,
              publishedAt: publicationDoc.publishedAt ?? null,
            }
          : null,
      };

      const previousSlug = notebook.publicSlug ?? null;

      notebook.set({
        isPublic: false,
        publicSlug: null,
        publicMetadata: null,
        publishedAt: null,
      });

      await notebook.save({ session });

      await NotebookPublication.deleteOne(
        { notebookId: notebook._id },
        { session }
      );

      await appendNotebookEvent(
        {
          notebookId: notebook._id,
          ownerId: notebook.owner,
          workspaceId: notebook.workspaceId ?? null,
          actorId: actorObjectId,
          eventType: "notebook.unpublish",
          commandName: "unpublishNotebook",
          summary: `Unpublished notebook ${notebook.name}`,
          payload: {
            previousSlug,
          },
          inversePayload: {
            action: "restoreNotebookPublication",
            previous: previousState,
          },
        },
        { session }
      );

      responsePayload = {
        isPublic: false,
        slug: null,
        publishedAt: null,
      };
    });
  } catch (error) {
    await session.endSession();
    if (error?.message === "NOTEBOOK_NOT_FOUND") {
      return res.status(404).json({ message: "Notebook not found" });
    }
    logger.error("Failed to unpublish notebook", { message: error?.message });
    return res.status(500).json(INTERNAL_SERVER_ERROR);
  }

  await session.endSession();
  if (responsePayload) {
    return res.status(200).json(responsePayload);
  }
  return undefined;
};

export default {
  getNotebookPublishingState,
  publishNotebook,
  unpublishNotebook,
};
