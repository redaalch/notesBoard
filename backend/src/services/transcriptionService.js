/**
 * Transcription Service – Speech-to-text via Groq Whisper API.
 *
 * Records audio in the browser, uploads to this service, which forwards
 * it to Groq's Whisper endpoint (whisper-large-v3-turbo) for transcription.
 */
import logger from "../utils/logger.js";

const WHISPER_MODEL = "whisper-large-v3-turbo";
const GROQ_WHISPER_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
const MAX_AUDIO_SIZE = 25 * 1024 * 1024; // 25 MB (Whisper API limit)
const WHISPER_TIMEOUT_MS = 60_000;

const MAX_RETRY_ATTEMPTS = 3;
const RETRY_BASE_MS = 1_000;

const getApiKey = () => process.env.GROQ_API_KEY ?? null;

/**
 * Transcribe an audio buffer to text via Groq Whisper.
 *
 * @param {Buffer} audioBuffer  Raw audio data
 * @param {string} mimeType     MIME type (e.g. "audio/webm", "audio/mp4")
 * @param {string} [language]   Optional BCP-47 language hint (e.g. "en")
 * @returns {Promise<{ text: string, duration: number, language: string } | null>}
 */
export const transcribeAudio = async (audioBuffer, mimeType, language) => {
  const apiKey = getApiKey();
  if (!apiKey) {
    logger.debug("Skipping transcription – GROQ_API_KEY not configured");
    return null;
  }

  if (!audioBuffer || audioBuffer.length === 0) {
    logger.warn("Transcription skipped – empty audio buffer");
    return null;
  }

  if (audioBuffer.length > MAX_AUDIO_SIZE) {
    logger.warn("Transcription skipped – audio exceeds 25 MB limit", {
      size: audioBuffer.length,
    });
    return null;
  }

  // Map MIME type to a file extension Whisper expects
  const extMap = {
    "audio/webm": "webm",
    "audio/mp4": "mp4",
    "audio/mpeg": "mp3",
    "audio/wav": "wav",
    "audio/ogg": "ogg",
    "audio/flac": "flac",
    "audio/x-m4a": "m4a",
  };
  const ext = extMap[mimeType?.split(";")[0]] ?? "webm";

  for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt++) {
    const isLastAttempt = attempt === MAX_RETRY_ATTEMPTS - 1;
    try {
      const formData = new FormData();
      formData.append(
        "file",
        new Blob([audioBuffer], { type: mimeType }),
        `recording.${ext}`,
      );
      formData.append("model", WHISPER_MODEL);
      formData.append("response_format", "verbose_json");
      if (language) {
        formData.append("language", language);
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), WHISPER_TIMEOUT_MS);
      let response;
      try {
        response = await fetch(GROQ_WHISPER_URL, {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}` },
          body: formData,
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }

      if (response.ok) {
        const data = await response.json();
        return {
          text: data.text ?? "",
          duration: data.duration ?? 0,
          language: data.language ?? "unknown",
        };
      }

      const isTransient = response.status === 429 || response.status >= 500;
      const errorBody = await response.text().catch(() => "");
      logger.warn("Groq Whisper request failed", {
        status: response.status,
        attempt: attempt + 1,
        body: errorBody.slice(0, 500),
      });

      if (!isTransient || isLastAttempt) return null;
    } catch (error) {
      logger.warn("Groq Whisper error", {
        message: error?.message,
        attempt: attempt + 1,
      });
      if (isLastAttempt) return null;
    }

    await new Promise((r) =>
      setTimeout(r, RETRY_BASE_MS * Math.pow(2, attempt)),
    );
  }

  return null;
};

export default { transcribeAudio };
