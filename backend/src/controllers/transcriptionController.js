/**
 * Transcription Controller – POST /api/ai/transcribe
 *
 * Accepts audio uploads (multipart/form-data) and returns transcribed text
 * via Groq Whisper.
 */
import { transcribeAudio } from "../services/transcriptionService.js";
import logger from "../utils/logger.js";

const AI_UNAVAILABLE = {
  message:
    "AI features are not configured. Set the GROQ_API_KEY environment variable.",
};

const ALLOWED_MIME_TYPES = new Set([
  "audio/webm",
  "audio/mp4",
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
  "audio/flac",
  "audio/x-m4a",
]);

const isAiConfigured = () => Boolean(process.env.GROQ_API_KEY);

export const transcribe = async (req, res) => {
  try {
    if (!isAiConfigured()) {
      return res.status(503).json(AI_UNAVAILABLE);
    }

    if (!req.file) {
      return res.status(400).json({ message: "No audio file provided" });
    }

    // Validate MIME type (strip codec params like "audio/webm;codecs=opus")
    const baseMime = req.file.mimetype?.split(";")[0];
    if (!ALLOWED_MIME_TYPES.has(baseMime)) {
      return res.status(400).json({
        message: `Unsupported audio format: ${baseMime}`,
      });
    }

    const language = req.body?.language || undefined;

    const result = await transcribeAudio(
      req.file.buffer,
      req.file.mimetype,
      language,
    );

    if (!result) {
      return res.status(502).json({
        message: "Transcription failed. Please try again.",
      });
    }

    if (!result.text || result.text.trim().length === 0) {
      return res.status(200).json({
        text: "",
        duration: result.duration,
        language: result.language,
        empty: true,
      });
    }

    return res.status(200).json({
      text: result.text,
      duration: result.duration,
      language: result.language,
    });
  } catch (error) {
    logger.error("Transcription endpoint error", {
      message: error?.message,
    });
    return res.status(500).json({ message: "Internal server error" });
  }
};

export default { transcribe };
