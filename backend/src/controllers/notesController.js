import mongoose from "mongoose";
import Note from "../models/Note.js";
import logger from "../utils/logger.js";

export const getAllNotes = async (req, res) => {
  try {
    const notes = await Note.find({ owner: req.user.id })
      .sort({ pinned: -1, updatedAt: -1, createdAt: -1 })
      .lean();
    return res.status(200).json(notes);
  } catch (error) {
    logger.error("Error in getAllNotes", { error: error?.message });
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getNoteById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid note id" });
    }

    const note = await Note.findOne({ _id: id, owner: req.user.id });
    if (!note) return res.status(404).json({ message: "Note not found" });

    return res.status(200).json(note);
  } catch (error) {
    logger.error("Error in getNoteById", { error: error?.message });
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const createNote = async (req, res) => {
  try {
    const { title, content, tags, pinned } = req.body;
    if (!title || !content) {
      return res
        .status(400)
        .json({ message: "title and content are required" });
    }

    const payload = {
      owner: req.user.id,
      title,
      content,
      tags,
    };

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
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const updateNote = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, tags, pinned } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid note id" });
    }

    const updates = {};
    if (typeof title !== "undefined") updates.title = title;
    if (typeof content !== "undefined") updates.content = content;
    if (typeof tags !== "undefined") updates.tags = tags;
    if (typeof pinned !== "undefined") {
      updates.pinned = typeof pinned === "boolean" ? pinned : Boolean(pinned);
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
      return res.status(404).json({ message: "Note not found" });
    }

    return res.status(200).json(updatedNote);
  } catch (error) {
    logger.error("Error in updateNote", { error: error?.message });
    if (error instanceof mongoose.Error.ValidationError) {
      return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const deleteNote = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid note id" });
    }

    const deletedNote = await Note.findOneAndDelete({
      _id: id,
      owner: req.user.id,
    });
    if (!deletedNote) {
      return res.status(404).json({ message: "Note not found" });
    }

    // 204 No Content is common; 200 is fine too.
    return res.status(200).json({ message: "Deleted" });
  } catch (error) {
    logger.error("Error in deleteNote", { error: error?.message });
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getTagStats = async (req, res) => {
  try {
    const ownerId = req.user?.id;

    if (!ownerId || !mongoose.Types.ObjectId.isValid(ownerId)) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    const rawAggregation = await Note.aggregate([
      {
        $match: {
          owner: new mongoose.Types.ObjectId(ownerId),
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
    return res.status(500).json({ message: "Internal server error" });
  }
};
