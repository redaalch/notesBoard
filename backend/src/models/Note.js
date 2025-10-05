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

const noteSchema = new mongoose.Schema(
  {
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
  },
  { timestamps: true }
);
const Note = mongoose.model("Note", noteSchema);
export default Note;
