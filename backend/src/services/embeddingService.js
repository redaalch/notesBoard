/**
 * Embedding Service – Generates dense vector embeddings for semantic search.
 *
 * Uses the Google Gemini gemini-embedding-001 model (3072-dimensional output).
 * Falls back gracefully when no API key is configured.
 */
import logger from "../utils/logger.js";

const GEMINI_EMBEDDING_MODEL = "gemini-embedding-001";
const GEMINI_EMBEDDING_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_EMBEDDING_MODEL}:embedContent`;

/** Dimensions produced by gemini-embedding-001 */
export const EMBEDDING_DIMENSIONS = 3072;

/** Maximum characters we send to the embedding API (safety cap). */
const MAX_INPUT_CHARS = 8_000;

const getApiKey = () => process.env.GEMINI_API_KEY ?? null;

/**
 * Strip common Markdown formatting so the embedding model receives cleaner text.
 */
export const stripMarkdown = (text) => {
  if (typeof text !== "string") return "";
  return text
    .replace(/#{1,6}\s+/g, "") // headings
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "") // images
    .replace(/\[[^\]]*\]\([^)]*\)/g, "") // links
    .replace(/[*_~`>]/g, "") // emphasis / blockquotes / code
    .replace(/```[\s\S]*?```/g, "") // fenced code blocks
    .replace(/\n{2,}/g, "\n") // collapse blank lines
    .trim();
};

/**
 * Produce a single embedding vector for a given text string.
 *
 * @param {string} text – raw text to embed
 * @returns {Promise<number[]|null>} – 3072-dim float array, or null on failure
 */
export const embedText = async (text) => {
  const apiKey = getApiKey();
  if (!apiKey) {
    logger.debug("Skipping embedding – GEMINI_API_KEY not configured");
    return null;
  }

  if (typeof text !== "string" || !text.trim()) {
    return null;
  }

  const truncated = text.slice(0, MAX_INPUT_CHARS);

  try {
    const response = await fetch(`${GEMINI_EMBEDDING_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: `models/${GEMINI_EMBEDDING_MODEL}`,
        content: { parts: [{ text: truncated }] },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      logger.warn("Gemini embedding request failed", {
        status: response.status,
        body: errorBody.slice(0, 500),
      });
      return null;
    }

    const data = await response.json();
    const values = data?.embedding?.values;

    if (!Array.isArray(values) || values.length !== EMBEDDING_DIMENSIONS) {
      logger.warn("Unexpected embedding response shape", {
        valuesLength: values?.length ?? 0,
      });
      return null;
    }

    return values;
  } catch (error) {
    logger.warn("Embedding generation error", { message: error?.message });
    return null;
  }
};

/**
 * Embed multiple texts in a single batch call (Gemini batchEmbedContents).
 *
 * @param {string[]} texts – array of text strings
 * @returns {Promise<(number[]|null)[]>} – parallel array of embeddings
 */
export const embedBatch = async (texts) => {
  const apiKey = getApiKey();
  if (!apiKey || !Array.isArray(texts) || texts.length === 0) {
    return texts.map(() => null);
  }

  const batchUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_EMBEDDING_MODEL}:batchEmbedContents?key=${apiKey}`;

  const requests = texts.map((text) => ({
    model: `models/${GEMINI_EMBEDDING_MODEL}`,
    content: {
      parts: [
        {
          text: (typeof text === "string" ? text : "").slice(
            0,
            MAX_INPUT_CHARS,
          ),
        },
      ],
    },
  }));

  try {
    const response = await fetch(batchUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requests }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      logger.warn("Gemini batch embedding failed", {
        status: response.status,
        body: errorBody.slice(0, 500),
      });
      return texts.map(() => null);
    }

    const data = await response.json();
    const embeddings = data?.embeddings ?? [];

    return texts.map((_, i) => {
      const values = embeddings[i]?.values;
      if (Array.isArray(values) && values.length === EMBEDDING_DIMENSIONS) {
        return values;
      }
      return null;
    });
  } catch (error) {
    logger.warn("Batch embedding error", { message: error?.message });
    return texts.map(() => null);
  }
};

/**
 * Build a combined text representation from a single note for embedding.
 */
export const buildNoteEmbeddingText = (note) => {
  const parts = [];
  if (note?.title) parts.push(note.title);

  const body = note?.contentText || note?.content || "";
  const cleaned = stripMarkdown(body);
  if (cleaned) parts.push(cleaned);

  if (Array.isArray(note?.tags) && note.tags.length) {
    parts.push(`Tags: ${note.tags.join(", ")}`);
  }

  return parts.join("\n\n");
};

export default {
  embedText,
  embedBatch,
  buildNoteEmbeddingText,
  stripMarkdown,
  EMBEDDING_DIMENSIONS,
};
