import { Filter } from "bad-words";
import mongoose from "mongoose";

const profanityFilter = new Filter();
const SCRIPT_LIKE_PATTERN =
  /<\/?\s*(script|iframe|object|embed|link|style|meta|form)\b/i;
const EVENT_HANDLER_PATTERN = /on\w+\s*=/i;
const JAVASCRIPT_PROTOCOL_PATTERN = /javascript\s*:/i;
const SQL_INJECTION_PATTERNS = [
  /select\s+.+\s+from/i,
  /insert\s+into/i,
  /update\s+\w+\s+set/i,
  /delete\s+from/i,
  /drop\s+(table|database)/i,
  /union\s+select/i,
];
const MONGO_OPERATOR_PATTERN =
  /\$(where|gt|gte|lt|lte|ne|eq|in|nin|regex|and|or|nor|exists|expr|jsonschema|function)/i;
const DOLLAR_WITH_WORD_PATTERN = /\$(?=[a-z_])/i;
const MAX_TAGS_PER_NOTE = 8;

const isSafeText = (value) => {
  if (typeof value !== "string") return false;

  const trimmed = value.trim();
  if (!trimmed.length) return false;

  if (profanityFilter.isProfane(trimmed)) {
    return false;
  }

  const lowerCased = trimmed.toLowerCase();

  if (SCRIPT_LIKE_PATTERN.test(lowerCased)) return false;
  if (EVENT_HANDLER_PATTERN.test(lowerCased)) return false;
  if (JAVASCRIPT_PROTOCOL_PATTERN.test(lowerCased)) return false;
  if (SQL_INJECTION_PATTERNS.some((pattern) => pattern.test(lowerCased))) {
    return false;
  }
  if (MONGO_OPERATOR_PATTERN.test(lowerCased)) {
    return false;
  }
  if (DOLLAR_WITH_WORD_PATTERN.test(lowerCased)) {
    return false;
  }

  return true;
};

const trimSetter = (value) =>
  typeof value === "string" ? value.trim() : value;

const normalizeTagList = (value) => {
  if (value === undefined || value === null) return [];

  const rawValues = Array.isArray(value)
    ? value
    : String(value)
        .split(",")
        .map((item) => item.trim());

  const cleaned = rawValues
    .map((tag) => (typeof tag === "string" ? tag.trim().toLowerCase() : ""))
    .filter(Boolean)
    .map((tag) => tag.replace(/\s+/g, " "));

  const unique = Array.from(new Set(cleaned));
  return unique.slice(0, MAX_TAGS_PER_NOTE);
};

const validateTagList = (tags) => {
  if (!Array.isArray(tags)) return false;
  if (tags.length > MAX_TAGS_PER_NOTE) return false;

  return tags.every((tag) => tag.length <= 32 && isSafeText(tag));
};

const noteSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      set: trimSetter,
      validate: {
        validator: isSafeText,
        message: "Title contains disallowed content.",
      },
    },
    content: {
      type: String,
      required: true,
      set: trimSetter,
      validate: {
        validator: isSafeText,
        message: "Content contains disallowed content.",
      },
    },
    tags: {
      type: [String],
      default: [],
      set: normalizeTagList,
      validate: {
        validator: validateTagList,
        message: "Tags contain disallowed content.",
      },
    },
    pinned: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true }
);

noteSchema.index({ title: "text", content: "text" });
noteSchema.index({ owner: 1, pinned: -1, updatedAt: -1 });
noteSchema.index({ owner: 1, createdAt: -1 });
noteSchema.index({ owner: 1, tags: 1 });
const Note = mongoose.model("Note", noteSchema);
export default Note;
