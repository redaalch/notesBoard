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
import multer from "multer";
import auth from "../middleware/auth.js";
import { validate, validationRules } from "../middleware/validation.js";
import {
  summarizeNote,
  suggestTags,
  regenerateEmbedding,
  toggleActionItem,
  getAiStatus,
} from "../controllers/aiController.js";
import { transcribe } from "../controllers/transcriptionController.js";

const router = express.Router();

// Multer config for audio uploads (memory storage, 25 MB limit)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

// All AI routes require authentication (rate limiting applied globally in app.js)
router.use(auth);

// Feature status (no AI key required – tells the frontend what's available)
router.get("/status", getAiStatus);

// Summarisation & action items
router.post("/notes/:id/summary", validate([validationRules.objectId("id")]), summarizeNote);

// Predictive tag suggestions
router.post("/notes/:id/suggest-tags", validate([validationRules.objectId("id")]), suggestTags);

// On-demand embedding regeneration
router.post("/notes/:id/embed", validate([validationRules.objectId("id")]), regenerateEmbedding);

// Toggle action item completed state
router.patch(
  "/notes/:id/action-items/:itemId",
  validate([validationRules.objectId("id"), validationRules.objectId("itemId")]),
  toggleActionItem,
);

// Voice input transcription (audio upload)
router.post("/transcribe", upload.single("audio"), transcribe);

export default router;
