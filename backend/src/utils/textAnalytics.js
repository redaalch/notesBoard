import { MAX_TAG_FREQUENCIES } from "./constants.js";

const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "for", "with", "from", "that", "this",
  "are", "was", "were", "will", "would", "can", "could", "should", "has",
  "have", "had", "about", "into", "over", "after", "before", "under",
  "above", "between", "within", "out", "in", "on", "at", "to", "of", "by",
  "it", "its", "is", "be", "as", "not", "no", "yes", "but", "if", "so",
  "we", "they", "their", "our", "you", "your", "i",
]);

// #20 — Remove redundant /i flag; input is already lowercased before matching.
const TOKEN_PATTERN = /[a-z0-9]+/g;

// #13 — Cap per-note content to keep tokenization O(1) per note regardless of
// note size (max note content is 50 KB; 5 KB is plenty for TF-IDF).
const MAX_CONTENT_CHARS_PER_NOTE = 5_000;
const MAX_TITLE_CHARS_PER_NOTE = 300;

export const tokenizeText = (value) => {
  if (typeof value !== "string") {
    return [];
  }

  const matches = value.toLowerCase().match(TOKEN_PATTERN);
  if (!matches) {
    return [];
  }

  return matches.filter((token) => token.length > 2 && !STOP_WORDS.has(token));
};

export const buildNotebookVector = (notes = [], options = {}) => {
  const { maxTerms = 200 } = options;
  if (!Array.isArray(notes) || notes.length === 0) {
    return {
      vector: {},
      tokenCount: 0,
      documentCount: 0,
      distinctTerms: 0,
    };
  }

  const tokenizedDocuments = notes
    .filter((n) => n && typeof n === "object")
    .map((note) => {
      const segments = [];
      if (note?.title) {
        // #13 — Slice title and content before concatenation.
        segments.push(String(note.title).slice(0, MAX_TITLE_CHARS_PER_NOTE));
      }
      if (note?.contentText) {
        segments.push(String(note.contentText).slice(0, MAX_CONTENT_CHARS_PER_NOTE));
      } else if (note?.content) {
        segments.push(String(note.content).slice(0, MAX_CONTENT_CHARS_PER_NOTE));
      }
      return tokenizeText(segments.join(" "));
    });

  const documentFrequencies = new Map();
  tokenizedDocuments.forEach((tokens) => {
    const uniqueTokens = new Set(tokens);
    uniqueTokens.forEach((token) => {
      documentFrequencies.set(token, (documentFrequencies.get(token) ?? 0) + 1);
    });
  });

  const vectorScores = new Map();
  let totalTokenCount = 0;
  const documentCount = tokenizedDocuments.length;

  tokenizedDocuments.forEach((tokens) => {
    if (!tokens.length) {
      return;
    }

    totalTokenCount += tokens.length;
    const termCounts = tokens.reduce((acc, token) => {
      acc.set(token, (acc.get(token) ?? 0) + 1);
      return acc;
    }, new Map());

    const tokenTotal = tokens.length;

    termCounts.forEach((count, token) => {
      const tf = count / tokenTotal;
      const df = documentFrequencies.get(token) ?? 1;
      const idf = Math.log((1 + documentCount) / (1 + df)) + 1;
      const weight = tf * idf;
      vectorScores.set(token, (vectorScores.get(token) ?? 0) + weight);
    });
  });

  const sortedScores = Array.from(vectorScores.entries()).sort((a, b) => {
    if (b[1] !== a[1]) {
      return b[1] - a[1];
    }
    return a[0].localeCompare(b[0]);
  });

  const limitedScores = sortedScores.slice(0, maxTerms);
  const vector = limitedScores.reduce((acc, [token, score]) => {
    acc[token] = Number.parseFloat(score.toFixed(6));
    return acc;
  }, {});

  return {
    vector,
    tokenCount: totalTokenCount,
    documentCount,
    distinctTerms: vectorScores.size,
  };
};

export const computeTagFrequencies = (notes = []) => {
  if (!Array.isArray(notes) || notes.length === 0) {
    return {
      tagFrequencies: {},
      distinctTagCount: 0,
      totalTagApplications: 0,
    };
  }

  const counts = new Map();
  let total = 0;

  notes.forEach((note) => {
    if (!Array.isArray(note?.tags)) {
      return;
    }
    note.tags.forEach((tag) => {
      if (typeof tag !== "string" || !tag.trim()) {
        return;
      }
      const normalized = tag.trim().toLowerCase();
      if (!normalized) {
        return;
      }
      counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
      total += 1;
    });
  });

  const sorted = Array.from(counts.entries()).sort((a, b) => {
    if (b[1] !== a[1]) {
      return b[1] - a[1];
    }
    return a[0].localeCompare(b[0]);
  });

  // #14 — Cap output to MAX_TAG_FREQUENCIES to bound the NotebookIndex
  // tagFrequencies Mixed field size and prevent Mongoose validation errors.
  const capped = sorted.slice(0, MAX_TAG_FREQUENCIES);

  const frequencies = capped.reduce((acc, [tag, count]) => {
    acc[tag] = count;
    return acc;
  }, {});

  return {
    tagFrequencies: frequencies,
    distinctTagCount: counts.size,
    totalTagApplications: total,
  };
};

export default {
  tokenizeText,
  buildNotebookVector,
  computeTagFrequencies,
};
