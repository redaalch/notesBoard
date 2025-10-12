import mongoose from "mongoose";
import Note from "../models/Note.js";
import CollabDocument from "../models/CollabDocument.js";
import NoteHistory from "../models/NoteHistory.js";
import logger from "../utils/logger.js";
import Notebook from "../models/Notebook.js";
import NotebookMember from "../models/NotebookMember.js";
import ShareLink from "../models/ShareLink.js";
import {
  appendNotesToNotebookOrder,
  ensureNotebookOwnership,
  normalizeObjectId,
  removeNotesFromNotebookOrder,
} from "../utils/notebooks.js";
import {
  isAllowedNotebookColor,
  isAllowedNotebookIcon,
  normalizeNotebookColor,
  normalizeNotebookIcon,
} from "../../../shared/notebookOptions.js";

const INTERNAL_SERVER_ERROR = { message: "Internal server error" };

export const listNotebooks = async (req, res) => {
  try {
    const ownerId = req.user?.id;
    if (!ownerId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const notebooks = await Notebook.find({ owner: ownerId })
      .sort({ createdAt: 1 })
      .lean();

    const notebookIds = notebooks.map((doc) => doc._id);
    const counts = await Note.aggregate([
      {
        $match: {
          owner: new mongoose.Types.ObjectId(ownerId),
        },
      },
      {
        $group: {
          _id: "$notebookId",
          count: { $sum: 1 },
        },
      },
    ]);

    const countMap = new Map(
      counts.map((entry) => [String(entry._id), entry.count])
    );

    const response = notebooks.map((notebook) => ({
      id: notebook._id.toString(),
      name: notebook.name,
      color: notebook.color,
      icon: notebook.icon,
      description: notebook.description,
      noteCount: countMap.get(notebook._id.toString()) ?? 0,
      createdAt: notebook.createdAt,
      updatedAt: notebook.updatedAt,
    }));

    const uncategorizedCount =
      countMap.get("null") ?? countMap.get("undefined") ?? 0;

    return res.status(200).json({
      notebooks: response,
      uncategorizedCount,
    });
  } catch (error) {
    logger.error("Failed to list notebooks", { message: error?.message });
    return res.status(500).json(INTERNAL_SERVER_ERROR);
  }
};

export const createNotebook = async (req, res) => {
  try {
    const ownerId = req.user?.id;
    if (!ownerId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { name, color, icon, description = "" } = req.body ?? {};
    if (!name || typeof name !== "string") {
      return res.status(400).json({ message: "Name is required" });
    }

    if (color !== undefined && !isAllowedNotebookColor(color)) {
      return res.status(400).json({ message: "Invalid notebook color" });
    }

    if (icon !== undefined && !isAllowedNotebookIcon(icon)) {
      return res.status(400).json({ message: "Invalid notebook icon" });
    }

    const normalizedColor =
      color === undefined ? null : normalizeNotebookColor(color);
    const normalizedIcon =
      icon === undefined ? null : normalizeNotebookIcon(icon);
    const normalizedDescription =
      typeof description === "string" ? description.trim() : "";

    const notebook = await Notebook.create({
      owner: ownerId,
      name: name.trim(),
      color: normalizedColor,
      icon: normalizedIcon,
      description: normalizedDescription,
    });

    try {
      await NotebookMember.findOneAndUpdate(
        {
          notebookId: notebook._id,
          userId: notebook.owner,
        },
        {
          $setOnInsert: {
            role: "owner",
            status: "active",
            invitedBy: notebook.owner,
            invitedAt: notebook.createdAt ?? new Date(),
            acceptedAt: notebook.createdAt ?? new Date(),
          },
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        }
      );
    } catch (membershipError) {
      logger.error("Failed to seed notebook owner membership", {
        message: membershipError?.message,
        notebookId: notebook._id?.toString?.() ?? null,
      });
    }

    return res.status(201).json({
      id: notebook._id.toString(),
      name: notebook.name,
      color: notebook.color,
      icon: notebook.icon,
      description: notebook.description,
      createdAt: notebook.createdAt,
      updatedAt: notebook.updatedAt,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res
        .status(409)
        .json({ message: "A notebook with this name already exists" });
    }
    logger.error("Failed to create notebook", { message: error?.message });
    return res.status(500).json(INTERNAL_SERVER_ERROR);
  }
};

export const updateNotebook = async (req, res) => {
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

    const updates = {};
    const { name, color, icon, description } = req.body ?? {};

    if (typeof name === "string" && name.trim().length) {
      updates.name = name.trim();
    }

    if (color !== undefined) {
      if (!isAllowedNotebookColor(color)) {
        return res.status(400).json({ message: "Invalid notebook color" });
      }
      updates.color = normalizeNotebookColor(color);
    }

    if (icon !== undefined) {
      if (!isAllowedNotebookIcon(icon)) {
        return res.status(400).json({ message: "Invalid notebook icon" });
      }
      updates.icon = normalizeNotebookIcon(icon);
    }

    if (typeof description === "string") {
      updates.description = description.trim();
    }

    if (!Object.keys(updates).length) {
      return res.status(400).json({ message: "No updates provided" });
    }

    const updated = await Notebook.findOneAndUpdate(
      { _id: notebook._id },
      updates,
      { new: true }
    ).lean();

    return res.status(200).json({
      id: updated._id.toString(),
      name: updated.name,
      color: updated.color,
      icon: updated.icon,
      description: updated.description,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res
        .status(409)
        .json({ message: "A notebook with this name already exists" });
    }
    logger.error("Failed to update notebook", { message: error?.message });
    return res.status(500).json(INTERNAL_SERVER_ERROR);
  }
};

export const deleteNotebook = async (req, res) => {
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

    const {
      mode = "move",
      targetNotebookId = null,
      deleteCollaborative = false,
    } = req.body ?? {};

    let targetId = null;
    if (mode === "move" && targetNotebookId) {
      if (String(targetNotebookId) === String(notebook._id)) {
        return res
          .status(400)
          .json({ message: "Cannot move notes to the same notebook" });
      }
      const targetNotebook = await ensureNotebookOwnership(
        targetNotebookId,
        ownerId
      );
      if (!targetNotebook) {
        return res.status(404).json({ message: "Target notebook not found" });
      }
      targetId = targetNotebook._id;
    }

    const notebookObjectId = new mongoose.Types.ObjectId(notebook._id);
    const notes = await Note.find({ notebookId: notebookObjectId }).select({
      _id: 1,
      docName: 1,
      workspaceId: 1,
      boardId: 1,
    });

    const noteIds = notes.map((doc) => doc._id);
    const docNames = notes
      .map((doc) => doc.docName)
      .filter((value) => typeof value === "string" && value.length > 0);

    if (mode === "delete") {
      if (noteIds.length) {
        await Note.deleteMany({ _id: { $in: noteIds } });
        if (docNames.length && deleteCollaborative) {
          await CollabDocument.deleteMany({ name: { $in: docNames } });
        }
        await NoteHistory.insertMany(
          notes.map((note) => ({
            noteId: note._id,
            workspaceId: note.workspaceId ?? null,
            boardId: note.boardId ?? null,
            actorId: ownerId,
            eventType: "delete",
            summary: "Deleted as part of notebook removal",
          }))
        );
      }
    } else {
      const updatePayload = targetId
        ? { notebookId: targetId }
        : { notebookId: null };
      if (noteIds.length) {
        await Note.updateMany(
          { _id: { $in: noteIds } },
          { $set: updatePayload }
        );
        if (targetId) {
          await appendNotesToNotebookOrder(targetId, noteIds);
        }
      }
    }

    if (noteIds.length) {
      await removeNotesFromNotebookOrder(notebookObjectId, noteIds);
    }

    await Notebook.deleteOne({ _id: notebookObjectId });

    await Promise.all([
      NotebookMember.deleteMany({ notebookId: notebookObjectId }),
      ShareLink.deleteMany({ notebookId: notebookObjectId }),
    ]);

    return res.status(200).json({
      id: notebook._id.toString(),
      deletedNotes: mode === "delete" ? noteIds.length : 0,
      movedNotes: mode === "move" ? noteIds.length : 0,
    });
  } catch (error) {
    logger.error("Failed to delete notebook", { message: error?.message });
    return res.status(500).json(INTERNAL_SERVER_ERROR);
  }
};

export const moveNotesToNotebook = async (req, res) => {
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

    const { noteIds } = req.body ?? {};
    if (!Array.isArray(noteIds) || !noteIds.length) {
      return res.status(400).json({ message: "No note ids provided" });
    }

    const normalized = noteIds
      .map((value) => normalizeObjectId(value))
      .filter(Boolean);
    if (!normalized.length) {
      return res.status(400).json({ message: "No valid note ids provided" });
    }

    const ownerObjectId = new mongoose.Types.ObjectId(ownerId);
    const notes = await Note.find({
      _id: { $in: normalized },
      owner: ownerObjectId,
    }).select({ _id: 1, notebookId: 1 });

    if (!notes.length) {
      return res.status(404).json({ message: "No matching notes found" });
    }

    const sourceNotebookIds = new Set(
      notes
        .map((note) => note.notebookId)
        .filter((value) => value)
        .map((value) => value.toString())
    );

    await Note.updateMany(
      { _id: { $in: notes.map((note) => note._id) } },
      { $set: { notebookId: notebook._id } }
    );

    for (const notebookId of sourceNotebookIds) {
      await removeNotesFromNotebookOrder(
        new mongoose.Types.ObjectId(notebookId),
        notes.map((note) => note._id)
      );
    }

    await appendNotesToNotebookOrder(
      notebook._id,
      notes.map((note) => note._id)
    );

    return res.status(200).json({
      notebookId: notebook._id.toString(),
      moved: notes.length,
    });
  } catch (error) {
    logger.error("Failed to move notes to notebook", {
      message: error?.message,
    });
    return res.status(500).json(INTERNAL_SERVER_ERROR);
  }
};

export default {
  listNotebooks,
  createNotebook,
  updateNotebook,
  deleteNotebook,
  moveNotesToNotebook,
};
