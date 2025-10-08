import mongoose from "mongoose";
import Note from "../models/Note.js";
import Board from "../models/Board.js";
import Workspace from "../models/Workspace.js";
import CollabDocument from "../models/CollabDocument.js";
import logger from "../utils/logger.js";
import { isValidObjectId } from "../utils/validators.js";

const INTERNAL_SERVER_ERROR = {
  message: "Internal server error",
};

const INVALID_NOTE_ID = {
  message: "Invalid note id",
};

const NOTE_NOT_FOUND = {
  message: "Note not found",
};

const hasWorkspaceRole = (workspace, userId) => {
  if (!workspace) return false;
  if (String(workspace.ownerId) === String(userId)) return true;
  return (workspace.members ?? []).some(
    (member) => String(member.userId) === String(userId)
  );
};

const MAX_TAGS_PER_NOTE = 8;

const normalizeNoteIds = (ids) => {
  if (!Array.isArray(ids)) return [];
  return Array.from(
    new Set(
      ids
        .map((value) => {
          if (!value) return null;
          const stringValue = String(value).trim();
          if (!isValidObjectId(stringValue)) return null;
          return stringValue;
        })
        .filter(Boolean)
    )
  );
};

const normalizeTags = (tags) => {
  if (!Array.isArray(tags)) return [];
  const cleaned = tags
    .map((tag) =>
      typeof tag === "string"
        ? tag.trim().toLowerCase().replace(/\s+/g, " ")
        : ""
    )
    .filter(Boolean);

  const unique = Array.from(new Set(cleaned));
  return unique.slice(0, MAX_TAGS_PER_NOTE);
};

const loadBoardContext = async (userId, boardId) => {
  if (!boardId || !isValidObjectId(boardId)) {
    return null;
  }

  const board = await Board.findById(boardId).lean();
  if (!board) {
    return null;
  }

  const workspace = await Workspace.findById(board.workspaceId).lean();
  if (!workspace) {
    return null;
  }

  if (!hasWorkspaceRole(workspace, userId)) {
    return null;
  }

  return { board, workspace };
};

const resolveBoardContext = async (req, explicitBoardId) => {
  const desiredBoardId = explicitBoardId || req.user?.defaultBoard;
  if (!desiredBoardId) {
    return null;
  }

  return loadBoardContext(req.user.id, desiredBoardId);
};

export const getAllNotes = async (req, res) => {
  try {
    const filter = { owner: req.user.id };

    const requestedBoardId = req.query?.boardId;
    if (requestedBoardId) {
      const context = await resolveBoardContext(req, requestedBoardId);
      if (!context) {
        return res.status(404).json({ message: "Board not found" });
      }
      filter.boardId = context.board._id;
    } else if (req.user?.defaultBoard) {
      filter.boardId = req.user.defaultBoard;
    }

    if (filter.boardId && !isValidObjectId(filter.boardId)) {
      return res.status(400).json({ message: "Invalid board id" });
    }

    const normalizedFilter = { ...filter };
    if (filter.boardId) {
      normalizedFilter.boardId = new mongoose.Types.ObjectId(filter.boardId);
    }

    const notes = await Note.find(normalizedFilter)
      .sort({ pinned: -1, updatedAt: -1, createdAt: -1 })
      .lean();
    return res.status(200).json(notes);
  } catch (error) {
    logger.error("Error in getAllNotes", { error: error?.message });
    return res.status(500).json(INTERNAL_SERVER_ERROR);
  }
};

export const getNoteById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json(INVALID_NOTE_ID);
    }

    const note = await Note.findOne({ _id: id, owner: req.user.id });
    if (!note) return res.status(404).json(NOTE_NOT_FOUND);

    return res.status(200).json(note);
  } catch (error) {
    logger.error("Error in getNoteById", { error: error?.message });
    return res.status(500).json(INTERNAL_SERVER_ERROR);
  }
};

export const createNote = async (req, res) => {
  try {
    const { title, content, tags, pinned, boardId, richContent, contentText } =
      req.body;
    if (!title || !content) {
      return res
        .status(400)
        .json({ message: "title and content are required" });
    }

    const boardContext =
      (await resolveBoardContext(req, boardId)) ??
      (await resolveBoardContext(req, req.user?.defaultBoard));

    if (!boardContext) {
      return res
        .status(404)
        .json({ message: "Board not found or inaccessible" });
    }

    const payload = {
      owner: req.user.id,
      workspaceId: boardContext.workspace._id,
      boardId: boardContext.board._id,
      title,
      content,
      tags,
    };

    if (typeof richContent !== "undefined") {
      payload.richContent = richContent;
    }

    if (typeof contentText === "string") {
      payload.contentText = contentText;
    }

    if (typeof pinned !== "undefined") {
      payload.pinned = typeof pinned === "boolean" ? pinned : Boolean(pinned);
    }

    const savedNote = await Note.create(payload);
    return res.status(201).json(savedNote);
  } catch (error) {
    logger.error("Error in createNote", { error: error?.message });
    if (error instanceof mongoose.Error.ValidationError) {
      return res.status(400).json({ message: error.message });
    }
    return res.status(500).json(INTERNAL_SERVER_ERROR);
  }
};

export const updateNote = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, tags, pinned, boardId, richContent, contentText } =
      req.body;

    if (!isValidObjectId(id)) {
      return res.status(400).json(INVALID_NOTE_ID);
    }

    const updates = {};
    if (typeof title !== "undefined") updates.title = title;
    if (typeof content !== "undefined") updates.content = content;
    if (typeof tags !== "undefined") updates.tags = tags;
    if (typeof pinned !== "undefined") {
      updates.pinned = typeof pinned === "boolean" ? pinned : Boolean(pinned);
    }

    if (typeof richContent !== "undefined") {
      updates.richContent = richContent;
    }

    if (typeof contentText === "string") {
      updates.contentText = contentText;
    }

    if (typeof boardId !== "undefined") {
      const boardContext = await resolveBoardContext(req, boardId);
      if (!boardContext) {
        return res
          .status(404)
          .json({ message: "Board not found or inaccessible" });
      }
      updates.boardId = boardContext.board._id;
      updates.workspaceId = boardContext.workspace._id;
    }

    if (!Object.keys(updates).length) {
      return res.status(400).json({ message: "No update data provided" });
    }

    const updatedNote = await Note.findOneAndUpdate(
      { _id: id, owner: req.user.id },
      updates,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!updatedNote) {
      return res.status(404).json(NOTE_NOT_FOUND);
    }

    return res.status(200).json(updatedNote);
  } catch (error) {
    logger.error("Error in updateNote", { error: error?.message });
    if (error instanceof mongoose.Error.ValidationError) {
      return res.status(400).json({ message: error.message });
    }
    return res.status(500).json(INTERNAL_SERVER_ERROR);
  }
};

export const deleteNote = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json(INVALID_NOTE_ID);
    }

    const deletedNote = await Note.findOneAndDelete({
      _id: id,
      owner: req.user.id,
    });
    if (!deletedNote) {
      return res.status(404).json(NOTE_NOT_FOUND);
    }

    if (deletedNote.docName) {
      await CollabDocument.findOneAndDelete({ name: deletedNote.docName });
    }

    // 204 No Content is common; 200 is fine too.
    return res.status(200).json({ message: "Deleted" });
  } catch (error) {
    logger.error("Error in deleteNote", { error: error?.message });
    return res.status(500).json(INTERNAL_SERVER_ERROR);
  }
};

export const getTagStats = async (req, res) => {
  try {
    const ownerId = req.user?.id;

    if (!ownerId || !isValidObjectId(ownerId)) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    let targetBoardId = req.query?.boardId;
    if (targetBoardId) {
      const context = await resolveBoardContext(req, targetBoardId);
      if (!context) {
        return res
          .status(404)
          .json({ message: "Board not found or inaccessible" });
      }
      targetBoardId = context.board._id.toString();
    } else if (req.user?.defaultBoard) {
      targetBoardId = req.user.defaultBoard;
    }

    const rawAggregation = await Note.aggregate([
      {
        $match: {
          owner: new mongoose.Types.ObjectId(ownerId),
          ...(targetBoardId
            ? {
                boardId: new mongoose.Types.ObjectId(targetBoardId),
              }
            : {}),
          tags: { $exists: true, $ne: [] },
        },
      },
      { $project: { tags: 1 } },
      { $unwind: "$tags" },
      {
        $group: {
          _id: "$tags",
          count: { $sum: 1 },
        },
      },
    ]);

    const normalizeTag = (tag) =>
      typeof tag === "string"
        ? tag.trim().toLowerCase().replace(/\s+/g, " ")
        : "";

    const statsMap = rawAggregation.reduce((acc, { _id, count }) => {
      const normalized = normalizeTag(_id);
      if (!normalized) return acc;

      const currentCount = acc.get(normalized) ?? 0;
      acc.set(normalized, currentCount + count);
      return acc;
    }, new Map());

    const tags = Array.from(statsMap.entries())
      .map(([tag, count]) => ({ _id: tag, count }))
      .sort((a, b) => {
        if (b.count !== a.count) {
          return b.count - a.count;
        }
        return a._id.localeCompare(b._id);
      });

    const uniqueTags = tags.length;
    const topTag = tags[0] ?? null;

    return res.status(200).json({
      tags,
      uniqueTags,
      topTag,
    });
  } catch (error) {
    logger.error("Error in getTagStats", { error: error?.message });
    return res.status(500).json(INTERNAL_SERVER_ERROR);
  }
};

export const bulkUpdateNotes = async (req, res) => {
  try {
    const { action, noteIds, tags = [], boardId } = req.body ?? {};

    const validActions = new Set(["pin", "unpin", "delete", "addTags", "move"]);
    if (!validActions.has(action)) {
      return res.status(400).json({ message: "Unknown bulk action" });
    }

    const normalizedIds = normalizeNoteIds(noteIds);
    if (!normalizedIds.length) {
      return res.status(400).json({ message: "No valid note ids provided" });
    }

    const ownerId = req.user?.id;
    if (!ownerId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const baseFilter = {
      owner: new mongoose.Types.ObjectId(ownerId),
      _id: { $in: normalizedIds.map((id) => new mongoose.Types.ObjectId(id)) },
    };

    if (action === "pin" || action === "unpin") {
      const desiredPinned = action === "pin";
      const result = await Note.updateMany(baseFilter, {
        $set: { pinned: desiredPinned },
      });

      return res.status(200).json({
        action,
        updated: result.modifiedCount ?? 0,
        noteIds: normalizedIds,
      });
    }

    if (action === "delete") {
      const notes = await Note.find(baseFilter).select({ docName: 1 }).lean();
      const docNames = notes
        .map((note) => note.docName)
        .filter((name) => typeof name === "string" && name.length > 0);

      if (docNames.length) {
        await CollabDocument.deleteMany({ name: { $in: docNames } });
      }

      const result = await Note.deleteMany(baseFilter);

      return res.status(200).json({
        action,
        deleted: result.deletedCount ?? 0,
        noteIds: normalizedIds,
      });
    }

    if (action === "addTags") {
      const normalizedTags = normalizeTags(tags);
      if (!normalizedTags.length) {
        return res
          .status(400)
          .json({ message: "At least one valid tag is required" });
      }

      const notes = await Note.find(baseFilter);
      let updatedCount = 0;

      for (const note of notes) {
        const existingTags = Array.isArray(note.tags) ? note.tags : [];
        const merged = Array.from(
          new Set([
            ...existingTags.map((tag) => tag.toLowerCase()),
            ...normalizedTags,
          ])
        ).slice(0, MAX_TAGS_PER_NOTE);
        note.tags = merged;
        await note.save();
        updatedCount += 1;
      }

      return res.status(200).json({
        action,
        updated: updatedCount,
        noteIds: normalizedIds,
        tags: normalizedTags,
      });
    }

    if (action === "move") {
      const boardContext = await resolveBoardContext(req, boardId);
      if (!boardContext) {
        return res
          .status(404)
          .json({ message: "Board not found or inaccessible" });
      }

      const result = await Note.updateMany(baseFilter, {
        $set: {
          boardId: boardContext.board._id,
          workspaceId: boardContext.workspace._id,
        },
      });

      return res.status(200).json({
        action,
        updated: result.modifiedCount ?? 0,
        noteIds: normalizedIds,
        boardId: boardContext.board._id,
      });
    }

    return res.status(400).json({ message: "Unsupported action" });
  } catch (error) {
    logger.error("Bulk update notes failed", { error: error?.message });
    return res.status(500).json(INTERNAL_SERVER_ERROR);
  }
};
