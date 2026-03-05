/**
 * AI Controller – REST endpoints for note summarisation, predictive tagging,
 * and on-demand embedding regeneration.
 */
import mongoose from "mongoose";
import Note from "../models/Note.js";
import { generateNoteSummary, predictNoteTags } from "../services/aiService.js";
import {
  embedText,
  buildNoteEmbeddingText,
} from "../services/embeddingService.js";
import logger from "../utils/logger.js";
import { isValidObjectId } from "../utils/validators.js";

const INTERNAL_SERVER_ERROR = { message: "Internal server error" };
const NOTE_NOT_FOUND = { message: "Note not found" };
const INVALID_NOTE_ID = { message: "Invalid note id" };
const AI_UNAVAILABLE = {
  message:
    "AI features are not configured. Set the GEMINI_API_KEY environment variable.",
};

const isAiConfigured = () => Boolean(process.env.GEMINI_API_KEY);

/* ─────── POST /api/ai/notes/:id/summary ─────── */
export const summarizeNote = async (req, res) => {
  try {
    if (!isAiConfigured()) {
      return res.status(503).json(AI_UNAVAILABLE);
    }

    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json(INVALID_NOTE_ID);
    }

    const userId = req.user.id;
    const note = await Note.findOne({
      _id: id,
      $or: [{ owner: new mongoose.Types.ObjectId(userId) }],
    })
      .select({ title: 1, content: 1, contentText: 1, tags: 1, aiSummary: 1 })
      .lean();

    if (!note) {
      return res.status(404).json(NOTE_NOT_FOUND);
    }

    const result = await generateNoteSummary(note);

    if (!result) {
      return res.status(200).json({
        summary: null,
        actionItems: [],
        message: "Note is too short to summarise.",
      });
    }

    const now = new Date();

    // Persist the structured summary on the note document
    await Note.updateOne(
      { _id: id },
      {
        $set: {
          "aiSummary.summary": result.summary,
          "aiSummary.actionItems": result.actionItems,
          "aiSummary.generatedAt": now,
        },
      },
    );

    // Re-read so Mongoose assigns _id to each action item
    const updated = await Note.findById(id).select("aiSummary").lean();

    return res.status(200).json({
      summary: result.summary,
      actionItems: updated?.aiSummary?.actionItems ?? result.actionItems,
      generatedAt: now.toISOString(),
    });
  } catch (error) {
    logger.error("AI summarization endpoint error", {
      message: error?.message,
    });
    return res.status(500).json(INTERNAL_SERVER_ERROR);
  }
};

/* ─────── POST /api/ai/notes/:id/suggest-tags ─────── */
export const suggestTags = async (req, res) => {
  try {
    if (!isAiConfigured()) {
      return res.status(503).json(AI_UNAVAILABLE);
    }

    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json(INVALID_NOTE_ID);
    }

    const userId = req.user.id;
    const userObjectId = new mongoose.Types.ObjectId(userId);

    const note = await Note.findOne({
      _id: id,
      $or: [{ owner: userObjectId }],
    })
      .select({ title: 1, content: 1, contentText: 1, tags: 1 })
      .lean();

    if (!note) {
      return res.status(404).json(NOTE_NOT_FOUND);
    }

    // Gather the user's existing tag vocabulary
    const existingTagDocs = await Note.aggregate([
      { $match: { owner: userObjectId } },
      { $unwind: "$tags" },
      { $group: { _id: "$tags" } },
      { $sort: { _id: 1 } },
      { $limit: 200 },
    ]);
    const existingTags = existingTagDocs.map((doc) => doc._id);

    const suggestedTags = await predictNoteTags(note, existingTags);

    if (!suggestedTags || suggestedTags.length === 0) {
      return res.status(200).json({
        suggestedTags: [],
        message: "No tag suggestions available for this note.",
      });
    }

    // Persist suggestions on the note
    await Note.updateOne(
      { _id: id },
      {
        $set: {
          "suggestedTags.tags": suggestedTags,
          "suggestedTags.generatedAt": new Date(),
        },
      },
    );

    return res.status(200).json({
      suggestedTags,
      currentTags: note.tags ?? [],
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("AI tag suggestion endpoint error", {
      message: error?.message,
    });
    return res.status(500).json(INTERNAL_SERVER_ERROR);
  }
};

/* ─────── POST /api/ai/notes/:id/embed ─────── */
export const regenerateEmbedding = async (req, res) => {
  try {
    if (!isAiConfigured()) {
      return res.status(503).json(AI_UNAVAILABLE);
    }

    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json(INVALID_NOTE_ID);
    }

    const userId = req.user.id;
    const note = await Note.findOne({
      _id: id,
      $or: [{ owner: new mongoose.Types.ObjectId(userId) }],
    })
      .select({ title: 1, content: 1, contentText: 1, tags: 1 })
      .lean();

    if (!note) {
      return res.status(404).json(NOTE_NOT_FOUND);
    }

    const text = buildNoteEmbeddingText(note);
    const embedding = await embedText(text);

    if (!embedding) {
      return res.status(200).json({
        embedded: false,
        message: "Embedding generation failed.",
      });
    }

    await Note.updateOne(
      { _id: id },
      {
        $set: {
          embedding,
          embeddingUpdatedAt: new Date(),
        },
      },
    );

    return res.status(200).json({
      embedded: true,
      dimensions: embedding.length,
      embeddedAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Embedding regeneration endpoint error", {
      message: error?.message,
    });
    return res.status(500).json(INTERNAL_SERVER_ERROR);
  }
};

/* ─────── PATCH /api/ai/notes/:id/action-items/:itemId ─────── */
export const toggleActionItem = async (req, res) => {
  try {
    const { id, itemId } = req.params;
    if (!isValidObjectId(id) || !isValidObjectId(itemId)) {
      return res.status(400).json(INVALID_NOTE_ID);
    }

    const userId = req.user.id;
    const note = await Note.findOne({
      _id: id,
      $or: [{ owner: new mongoose.Types.ObjectId(userId) }],
    }).select("aiSummary");

    if (!note) {
      return res.status(404).json(NOTE_NOT_FOUND);
    }

    const item = note.aiSummary?.actionItems?.id(itemId);
    if (!item) {
      return res.status(404).json({ message: "Action item not found" });
    }

    item.completed = !item.completed;
    await note.save();

    return res.status(200).json({
      itemId: item._id,
      completed: item.completed,
    });
  } catch (error) {
    logger.error("Toggle action item error", { message: error?.message });
    return res.status(500).json(INTERNAL_SERVER_ERROR);
  }
};

/* ─────── GET /api/ai/status ─────── */
export const getAiStatus = async (_req, res) => {
  return res.status(200).json({
    configured: isAiConfigured(),
    features: {
      semanticSearch: isAiConfigured(),
      summarization: isAiConfigured(),
      predictiveTags: isAiConfigured(),
    },
  });
};

export default {
  summarizeNote,
  suggestTags,
  regenerateEmbedding,
  toggleActionItem,
  getAiStatus,
};
