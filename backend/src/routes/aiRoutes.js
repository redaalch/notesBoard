/**
 * AI Routes – /api/ai
 *
 * Provides endpoints for:
 *   - Note summarisation & action-item extraction
 *   - Predictive tag suggestions
 *   - On-demand embedding regeneration
 *   - AI feature status check
 */
import express from "express";
import auth from "../middleware/auth.js";
import {
  summarizeNote,
  suggestTags,
  regenerateEmbedding,
  toggleActionItem,
  getAiStatus,
} from "../controllers/aiController.js";

const router = express.Router();

// All AI routes require authentication (rate limiting applied globally in app.js)
router.use(auth);

// Feature status (no AI key required – tells the frontend what's available)
router.get("/status", getAiStatus);

// Summarisation & action items
router.post("/notes/:id/summary", summarizeNote);

// Predictive tag suggestions
router.post("/notes/:id/suggest-tags", suggestTags);

// On-demand embedding regeneration
router.post("/notes/:id/embed", regenerateEmbedding);

// Toggle action item completed state
router.patch("/notes/:id/action-items/:itemId", toggleActionItem);

export default router;
