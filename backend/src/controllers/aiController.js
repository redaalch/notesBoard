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
import { resolveNoteForUser } from "../utils/access.js";

const INTERNAL_SERVER_ERROR = { message: "Internal server error" };
const NOTE_NOT_FOUND = { message: "Note not found" };
const INVALID_NOTE_ID = { message: "Invalid note id" };
const AI_UNAVAILABLE = {
  message:
    "AI features are not configured. Set the GROQ_API_KEY environment variable.",
};

const isAiConfigured = () => Boolean(process.env.GROQ_API_KEY);

/**
 * Resolve note access for the current user.
 * Returns { note, permissions } or sends an error response and returns null.
 */
const resolveNoteAccess = async (req, res, { requireEdit = false } = {}) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    res.status(400).json(INVALID_NOTE_ID);
    return null;
  }

  const userId = req.user.id;
  const access = await resolveNoteForUser(id, userId);
  if (!access) {
    res.status(404).json(NOTE_NOT_FOUND);
    return null;
  }

  if (requireEdit && !access.permissions?.canEdit) {
    res.status(403).json({ message: "Insufficient permissions" });
    return null;
  }

  return access;
};

/* ─────── POST /api/ai/notes/:id/summary ─────── */
export const summarizeNote = async (req, res) => {
  try {
    if (!isAiConfigured()) {
      return res.status(503).json(AI_UNAVAILABLE);
    }

    const access = await resolveNoteAccess(req, res);
    if (!access) return;

    const { note } = access;

    const result = await generateNoteSummary(note);

    if (result?.skipped) {
      const messages = {
        too_short: "Note is too short to summarise.",
        ai_unavailable: "AI summarisation is temporarily unavailable. Please try again later.",
        no_note: "Note not found.",
      };
      const statusCode = result.reason === "ai_unavailable" ? 503 : 200;
      return res.status(statusCode).json({
        summary: null,
        actionItems: [],
        message: messages[result.reason] ?? "Unable to generate summary.",
      });
    }

    const now = new Date();

    // Persist the structured summary on the note document
    await Note.updateOne(
      { _id: note._id },
      {
        $set: {
          "aiSummary.summary": result.summary,
          "aiSummary.actionItems": result.actionItems,
          "aiSummary.generatedAt": now,
        },
      },
    );

    // Re-read so Mongoose assigns _id to each action item
    const updated = await Note.findById(note._id).select("aiSummary").lean();

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

    const access = await resolveNoteAccess(req, res);
    if (!access) return;

    const { note } = access;
    const userId = req.user.id;
    const userObjectId = new mongoose.Types.ObjectId(userId);

    // Gather the user's existing tag vocabulary (scoped to owned notes for relevance)
    const existingTagDocs = await Note.aggregate([
      { $match: { owner: userObjectId, tags: { $exists: true, $ne: [] } } },
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
      { _id: note._id },
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

    const access = await resolveNoteAccess(req, res, { requireEdit: true });
    if (!access) return;

    const { note } = access;

    const text = buildNoteEmbeddingText(note);
    const embedding = await embedText(text);

    if (!embedding) {
      return res.status(200).json({
        embedded: false,
        message: "Embedding generation failed.",
      });
    }

    await Note.updateOne(
      { _id: note._id },
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

    const access = await resolveNoteAccess(req, res, { requireEdit: true });
    if (!access) return;

    const note = await Note.findById(id).select("aiSummary");
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
