/**
 * Embedding Service – Generates dense vector embeddings for semantic search.
 *
 * Supports pluggable providers via environment variables.
 * Supported providers: Gemini and Groq (OpenAI-compatible embeddings API).
 * Falls back gracefully when embeddings are disabled or no API key is configured.
 */
import logger from "../utils/logger.js";

const DEFAULT_PROVIDER = "none";
const GEMINI_PROVIDER = "gemini";
const GROQ_PROVIDER = "groq";

const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL ?? "";
const GEMINI_EMBEDDING_MODEL = EMBEDDING_MODEL || "gemini-embedding-001";
const GROQ_EMBEDDING_MODEL = EMBEDDING_MODEL || "text-embedding-3-small";

const GEMINI_EMBEDDING_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_EMBEDDING_MODEL}:embedContent`;
const GEMINI_BATCH_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_EMBEDDING_MODEL}:batchEmbedContents`;
const GROQ_EMBEDDING_URL = "https://api.groq.com/openai/v1/embeddings";

/** Timeout for Gemini API calls – matches Groq timeout used in aiService. */
const EMBEDDING_TIMEOUT_MS = 30_000;

/** Retry config for transient Gemini failures (429 / 5xx). */
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_BASE_MS = 1_000;

const resolveDimensions = () => {
  const fromEnv = Number(process.env.EMBEDDING_DIMENSIONS);
  if (Number.isFinite(fromEnv) && fromEnv > 0) {
    return Math.floor(fromEnv);
  }

  const provider = (process.env.EMBEDDING_PROVIDER ?? "").toLowerCase().trim();
  if (provider === GROQ_PROVIDER) return 1536;

  return 3072;
};

/** Dimensions expected from the configured embedding provider/model. */
export const EMBEDDING_DIMENSIONS = resolveDimensions();

/** Maximum characters we send to the embedding API (safety cap). */
const MAX_INPUT_CHARS = 8_000;

const getProvider = () =>
  (
    process.env.EMBEDDING_PROVIDER ??
    (process.env.GROQ_API_KEY
      ? GROQ_PROVIDER
      : process.env.EMBEDDING_API_KEY || process.env.GEMINI_API_KEY
        ? GEMINI_PROVIDER
        : DEFAULT_PROVIDER)
  )
    .toLowerCase()
    .trim();

const getApiKey = (provider) => {
  if (provider === GROQ_PROVIDER) {
    return process.env.EMBEDDING_API_KEY ?? process.env.GROQ_API_KEY ?? null;
  }
  if (provider === GEMINI_PROVIDER) {
    return process.env.EMBEDDING_API_KEY ?? process.env.GEMINI_API_KEY ?? null;
  }
  return null;
};

export const isEmbeddingEnabled = () => {
  const provider = getProvider();
  if (provider !== GEMINI_PROVIDER && provider !== GROQ_PROVIDER) return false;
  return Boolean(getApiKey(provider));
};

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
  const provider = getProvider();
  if (!isEmbeddingEnabled()) {
    logger.debug("Skipping embedding – provider disabled or API key missing", {
      provider,
    });
    return null;
  }

  const apiKey = getApiKey(provider);

  if (typeof text !== "string" || !text.trim()) {
    return null;
  }

  const truncated = text.slice(0, MAX_INPUT_CHARS);

  for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt++) {
    const isLastAttempt = attempt === MAX_RETRY_ATTEMPTS - 1;
    try {
      // Pass the API key as a header instead of a URL query param — keys in
      // URLs appear in server access logs, proxies, and referrer headers.
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        EMBEDDING_TIMEOUT_MS,
      );
      let response;
      try {
        if (provider === GROQ_PROVIDER) {
          response = await fetch(GROQ_EMBEDDING_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: GROQ_EMBEDDING_MODEL,
              input: truncated,
            }),
            signal: controller.signal,
          });
        } else {
          response = await fetch(GEMINI_EMBEDDING_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": apiKey,
            },
            body: JSON.stringify({
              model: `models/${GEMINI_EMBEDDING_MODEL}`,
              content: { parts: [{ text: truncated }] },
            }),
            signal: controller.signal,
          });
        }
      } finally {
        clearTimeout(timeoutId);
      }

      if (response.ok) {
        const data = await response.json();
        const values =
          provider === GROQ_PROVIDER
            ? data?.data?.[0]?.embedding
            : data?.embedding?.values;
        if (!Array.isArray(values) || values.length !== EMBEDDING_DIMENSIONS) {
          logger.warn("Unexpected embedding response shape", {
            provider,
            valuesLength: values?.length ?? 0,
            expectedDimensions: EMBEDDING_DIMENSIONS,
          });
          return null;
        }
        return values;
      }

      const isTransient = response.status === 429 || response.status >= 500;
      const errorBody = await response.text().catch(() => "");
      logger.warn("Embedding request failed", {
        provider,
        status: response.status,
        attempt: attempt + 1,
        body: errorBody.slice(0, 500),
      });
      if (!isTransient || isLastAttempt) return null;
    } catch (error) {
      logger.warn("Embedding generation error", {
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

/**
 * Embed multiple texts in a single batch call (Gemini batchEmbedContents).
 *
 * @param {string[]} texts – array of text strings
 * @returns {Promise<(number[]|null)[]>} – parallel array of embeddings
 */
export const embedBatch = async (texts) => {
  if (!Array.isArray(texts) || texts.length === 0) {
    return [];
  }

  const provider = getProvider();

  if (!isEmbeddingEnabled()) {
    return texts.map(() => null);
  }

  const apiKey = getApiKey(provider);
  if (!apiKey) {
    return texts.map(() => null);
  }

  const normalizedTexts = texts.map((text) =>
    (typeof text === "string" ? text : "").slice(0, MAX_INPUT_CHARS),
  );

  const requests = normalizedTexts.map((text) => ({
    model: `models/${GEMINI_EMBEDDING_MODEL}`,
    content: { parts: [{ text }] },
  }));

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      EMBEDDING_TIMEOUT_MS,
    );
    let response;
    try {
      if (provider === GROQ_PROVIDER) {
        response = await fetch(GROQ_EMBEDDING_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: GROQ_EMBEDDING_MODEL,
            input: normalizedTexts,
          }),
          signal: controller.signal,
        });
      } else {
        response = await fetch(GEMINI_BATCH_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify({ requests }),
          signal: controller.signal,
        });
      }
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      logger.warn("Batch embedding failed", {
        provider,
        status: response.status,
        body: errorBody.slice(0, 500),
      });
      return texts.map(() => null);
    }

    const data = await response.json();
    const embeddings =
      provider === GROQ_PROVIDER
        ? Array.isArray(data?.data)
          ? data.data.map((entry) => entry?.embedding)
          : []
        : (data?.embeddings ?? []);

    return texts.map((_, i) => {
      const values =
        provider === GROQ_PROVIDER ? embeddings[i] : embeddings[i]?.values;
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
