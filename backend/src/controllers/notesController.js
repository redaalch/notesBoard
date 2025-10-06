import mongoose from "mongoose";
import Note from "../models/Note.js";

export const getAllNotes = async (_req, res) => {
  try {
    const notes = await Note.find().sort({ createdAt: -1 });
    return res.status(200).json(notes);
  } catch (error) {
    console.error("Error in getAllNotes", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getNoteById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid note id" });
    }

    const note = await Note.findById(id);
    if (!note) return res.status(404).json({ message: "Note not found" });

    return res.status(200).json(note);
  } catch (error) {
    console.error("Error in getNoteById", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const createNote = async (req, res) => {
  try {
    const { title, content, tags } = req.body;
    if (!title || !content) {
      return res
        .status(400)
        .json({ message: "title and content are required" });
    }

    // One-liner create:
    const savedNote = await Note.create({ title, content, tags });
    return res.status(201).json(savedNote);
  } catch (error) {
    console.error("Error in createNote", error);
    if (error instanceof mongoose.Error.ValidationError) {
      return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const updateNote = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, tags } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid note id" });
    }

    const updates = {};
    if (typeof title !== "undefined") updates.title = title;
    if (typeof content !== "undefined") updates.content = content;
    if (typeof tags !== "undefined") updates.tags = tags;

    if (!Object.keys(updates).length) {
      return res.status(400).json({ message: "No update data provided" });
    }

    const updatedNote = await Note.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    });

    if (!updatedNote) {
      return res.status(404).json({ message: "Note not found" });
    }

    return res.status(200).json(updatedNote);
  } catch (error) {
    console.error("Error in updateNote", error);
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

    const deletedNote = await Note.findByIdAndDelete(id);
    if (!deletedNote) {
      return res.status(404).json({ message: "Note not found" });
    }

    // 204 No Content is common; 200 is fine too.
    return res.status(200).json({ message: "Deleted" });
  } catch (error) {
    console.error("Error in deleteNote", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getTagStats = async (_req, res) => {
  try {
    const aggregation = await Note.aggregate([
      {
        $match: {
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
