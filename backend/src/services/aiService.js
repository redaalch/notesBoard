/**
 * AI Service – Summarization, action-item extraction, and predictive tagging.
 *
 * Uses the Google Gemini 2.0 Flash generative model for:
 *   • Auto-summarisation of long notes (max 3 sentences)
 *   • Action-item extraction from meeting notes / project specs
 *   • Zero-shot tag classification against the user's existing tags
 */
import logger from "../utils/logger.js";
import { stripMarkdown } from "./embeddingService.js";

const GEMINI_MODEL = "gemini-2.5-flash-lite";
const GEMINI_GENERATE_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const MAX_INPUT_CHARS = 12_000;
const SUMMARY_WORD_THRESHOLD = 150; // Only summarise notes above this word count

const getApiKey = () => process.env.GEMINI_API_KEY ?? null;

/**
 * Send a prompt to Gemini and return the text response.
 */
const callGemini = async (systemPrompt, userPrompt) => {
  const apiKey = getApiKey();
  if (!apiKey) {
    logger.debug("Skipping Gemini call – GEMINI_API_KEY not configured");
    return null;
  }

  try {
    const response = await fetch(`${GEMINI_GENERATE_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: systemPrompt }],
        },
        contents: [
          {
            parts: [{ text: userPrompt.slice(0, MAX_INPUT_CHARS) }],
          },
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 1024,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      logger.warn("Gemini generation request failed", {
        status: response.status,
        body: errorBody.slice(0, 500),
      });
      return null;
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
    return text;
  } catch (error) {
    logger.warn("Gemini generation error", { message: error?.message });
    return null;
  }
};

/**
 * Parse a JSON string safely, returning null on failure.
 */
const safeParse = (text) => {
  if (!text) return null;
  try {
    // Strip markdown code fences if LLM wraps the answer
    const cleaned = text
      .replace(/^```json\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
};

/* ───────────────────────────── Summarization ───────────────────────────── */

const SUMMARY_SYSTEM_PROMPT = `You are an AI assistant. Analyze the following note content.
Return a JSON object with exactly two keys:
- "summary": a 2-sentence overview of the note.
- "action_items": an array of strings extracting specific tasks, deliverables, or things people need to do. Each string should be a single actionable item. If there are no tasks, return an empty array.

Do not include markdown formatting in your response. Return ONLY valid JSON.`;

/**
 * Generate a summary and extract action items for a note.
 *
 * @param {{ title?: string, content?: string, contentText?: string }} note
 * @returns {Promise<{ summary: string, actionItems: string[] } | null>}
 */
export const generateNoteSummary = async (note) => {
  if (!note) return null;

  const rawText = stripMarkdown(note.contentText || note.content || "");
  const wordCount = rawText.split(/\s+/).filter(Boolean).length;

  if (wordCount < SUMMARY_WORD_THRESHOLD) {
    return null; // Note too short for summarisation
  }

  const userPrompt = `Title: ${note.title || "Untitled"}\n\n${rawText}`;
  const responseText = await callGemini(SUMMARY_SYSTEM_PROMPT, userPrompt);
  const parsed = safeParse(responseText);

  if (!parsed || typeof parsed.summary !== "string") {
    return null;
  }

  const rawItems = Array.isArray(parsed.action_items)
    ? parsed.action_items.filter(
        (item) => typeof item === "string" && item.trim(),
      )
    : [];

  return {
    summary: parsed.summary,
    actionItems: rawItems.map((text) => ({
      text: text.trim(),
      completed: false,
    })),
  };
};

/* ──────────────────────────── Predictive Tagging ──────────────────────── */

const TAGGING_SYSTEM_PROMPT = `You are an AI assistant for a note-taking app.
Given a note and the user's existing tags, pick the 3 most relevant existing tags for this note.
If the note introduces a completely new concept not covered by any existing tag, suggest exactly 1 new tag.

Return a JSON object:
- "existing_tags": an array of up to 3 strings chosen from the existing tags list.
- "new_tag": a single string for the suggested new tag, or null if none is needed.

Return ONLY valid JSON. No additional commentary.`;

/**
 * Predict tags for a note based on its content and the user's existing tag set.
 *
 * @param {{ title?: string, content?: string, contentText?: string }} note
 * @param {string[]} existingTags – the user's existing tag vocabulary
 * @returns {Promise<string[] | null>} – suggested tags (mix of existing + new)
 */
export const predictNoteTags = async (note, existingTags = []) => {
  if (!note) return null;

  const rawText = stripMarkdown(note.contentText || note.content || "");
  if (!rawText.trim()) return null;

  const tagList =
    existingTags.length > 0 ? existingTags.join(", ") : "(no existing tags)";

  const userPrompt = `Existing tags: ${tagList}\n\nNote title: ${note.title || "Untitled"}\n\nNote content:\n${rawText}`;
  const responseText = await callGemini(TAGGING_SYSTEM_PROMPT, userPrompt);
  const parsed = safeParse(responseText);

  if (!parsed) return null;

  const suggested = [];

  if (Array.isArray(parsed.existing_tags)) {
    for (const tag of parsed.existing_tags) {
      if (typeof tag === "string" && tag.trim()) {
        const normalised = tag.trim().toLowerCase();
        if (existingTags.includes(normalised)) {
          suggested.push(normalised);
        }
      }
    }
  }

  if (
    parsed.new_tag &&
    typeof parsed.new_tag === "string" &&
    parsed.new_tag.trim()
  ) {
    const newTag = parsed.new_tag.trim().toLowerCase();
    if (!suggested.includes(newTag)) {
      suggested.push(newTag);
    }
  }

  return suggested.length > 0 ? suggested : null;
};

/* ────────────────────────────── Exports ────────────────────────────────── */

export default {
  generateNoteSummary,
  predictNoteTags,
  SUMMARY_WORD_THRESHOLD,
};
