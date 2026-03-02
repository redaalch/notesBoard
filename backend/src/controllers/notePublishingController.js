import mongoose from "mongoose";
import Note from "../models/Note.js";
import NotePublication from "../models/NotePublication.js";
import logger from "../utils/logger.js";
import {
  generateNotebookPublicSlug as generatePublicSlug,
  normalizeNotebookPublicSlug as normalizePublicSlug,
  computeNotebookSnapshotHash as computeSnapshotHash,
} from "../utils/notebooks.js";
import { resolveNoteForUser } from "../utils/access.js";

const INTERNAL_SERVER_ERROR = { message: "Internal server error" };

const buildNotePublicationSnapshot = (note) => {
  if (!note) return null;

  return {
    note: {
      id: note._id.toString(),
      title: note.title,
      content: note.content,
      contentText: note.contentText ?? note.content ?? "",
      richContent: note.richContent ?? null,
      tags: Array.isArray(note.tags) ? note.tags : [],
      pinned: Boolean(note.pinned),
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
    },
    generatedAt: new Date().toISOString(),
  };
};

export const getNotePublishingState = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { id } = req.params;
    const resolved = await resolveNoteForUser(id, userId);
    if (!resolved) {
      return res.status(404).json({ message: "Note not found" });
    }

    const { note, permissions } = resolved;
    if (!permissions?.isOwner) {
      return res
        .status(403)
        .json({ message: "Only the note owner can manage publishing" });
    }

    const publication = await NotePublication.findOne({ noteId: note._id })
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      isPublic: Boolean(note.isPublic),
      slug: note.publicSlug ?? null,
      publishedAt: note.publishedAt ?? null,
      snapshotHash: publication?.snapshotHash ?? null,
      lastPublishedAt: publication?.updatedAt ?? publication?.createdAt ?? null,
    });
  } catch (error) {
    logger.error("Failed to fetch note publishing state", {
      message: error?.message,
    });
    return res.status(500).json(INTERNAL_SERVER_ERROR);
  }
};

export const publishNote = async (req, res) => {
  const session = await mongoose.startSession();
  let responsePayload = null;
  try {
    const userId = req.user?.id;
    if (!userId) {
      await session.endSession();
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { id } = req.params;
    const { slug: requestedSlug } = req.body ?? {};
    const actorObjectId = new mongoose.Types.ObjectId(userId);

    await session.withTransaction(async () => {
      const note = await Note.findOne({
        _id: id,
        owner: actorObjectId,
      }).session(session);

      if (!note) {
        throw new Error("NOTE_NOT_FOUND");
      }

      const normalizedSlug = (() => {
        if (requestedSlug === undefined || requestedSlug === null) {
          return note.publicSlug || generatePublicSlug();
        }
        return normalizePublicSlug(requestedSlug);
      })();

      if (!normalizedSlug) {
        throw new Error("INVALID_SLUG");
      }

      const snapshot = buildNotePublicationSnapshot(note);
      const snapshotHash = computeSnapshotHash(snapshot);
      const publishedAt = note.publishedAt ?? new Date();

      note.set({
        isPublic: true,
        publicSlug: normalizedSlug,
        publishedAt,
      });

      await note.save({ session });

      await NotePublication.findOneAndUpdate(
        { noteId: note._id },
        {
          $set: {
            ownerId: note.owner,
            publicSlug: normalizedSlug,
            snapshot,
            snapshotHash,
            publishedAt,
          },
        },
        { upsert: true, new: true, session },
      );

      responsePayload = {
        isPublic: true,
        slug: normalizedSlug,
        publishedAt,
        snapshotHash,
      };
    });
  } catch (error) {
    await session.endSession();
    if (error?.message === "NOTE_NOT_FOUND") {
      return res.status(404).json({ message: "Note not found" });
    }
    if (error?.message === "INVALID_SLUG") {
      return res.status(400).json({ message: "Invalid slug provided" });
    }
    if (error?.code === 11000) {
      return res.status(409).json({ message: "Slug already in use" });
    }
    logger.error("Failed to publish note", { message: error?.message });
    return res.status(500).json(INTERNAL_SERVER_ERROR);
  }

  await session.endSession();
  if (responsePayload) {
    return res.status(200).json(responsePayload);
  }
  return undefined;
};

export const unpublishNote = async (req, res) => {
  const session = await mongoose.startSession();
  let responsePayload = null;
  try {
    const userId = req.user?.id;
    if (!userId) {
      await session.endSession();
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { id } = req.params;
    const actorObjectId = new mongoose.Types.ObjectId(userId);

    await session.withTransaction(async () => {
      const note = await Note.findOne({
        _id: id,
        owner: actorObjectId,
      }).session(session);

      if (!note) {
        throw new Error("NOTE_NOT_FOUND");
      }

      note.set({
        isPublic: false,
        publicSlug: null,
        publishedAt: null,
      });

      await note.save({ session });

      await NotePublication.deleteOne({ noteId: note._id }, { session });

      responsePayload = {
        isPublic: false,
        slug: null,
        publishedAt: null,
      };
    });
  } catch (error) {
    await session.endSession();
    if (error?.message === "NOTE_NOT_FOUND") {
      return res.status(404).json({ message: "Note not found" });
    }
    logger.error("Failed to unpublish note", { message: error?.message });
    return res.status(500).json(INTERNAL_SERVER_ERROR);
  }

  await session.endSession();
  if (responsePayload) {
    return res.status(200).json(responsePayload);
  }
  return undefined;
};

export default {
  getNotePublishingState,
  publishNote,
  unpublishNote,
};
