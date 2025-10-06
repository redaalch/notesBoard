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
    const aggregation = await Note.aggregate([
      {
        $match: {
          owner: new mongoose.Types.ObjectId(req.user.id),
          tags: { $exists: true, $ne: [] },
        },
      },
      { $unwind: "$tags" },
      {
        $set: {
          normalizedTag: {
            $regexReplace: {
              input: {
                $toLower: {
                  $trim: { input: "$tags" },
                },
              },
              regex: /\s+/,
              replacement: " ",
            },
          },
        },
      },
      {
        $match: {
          normalizedTag: { $ne: "" },
        },
      },
      {
        $group: {
          _id: "$normalizedTag",
          count: { $sum: 1 },
        },
      },
      {
        $sort: { count: -1, _id: 1 },
      },
    ]);

    const uniqueTags = aggregation.length;
    const topTag = aggregation[0] ?? null;

    return res.status(200).json({
      tags: aggregation,
      uniqueTags,
      topTag,
    });
  } catch (error) {
    console.error("Error in getTagStats", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
