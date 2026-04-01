// #9 — Require the canonical 24-char hex representation.
// mongoose.Types.ObjectId.isValid() also accepts 12-byte binary strings (e.g.
// "aaaaaaaaaaaa") which cause confusing query failures instead of clean 400s.
const OBJECT_ID_HEX = /^[0-9a-f]{24}$/i;

import mongoose from "mongoose";

/**
 * Normalize an email address by trimming whitespace and lowercasing it.
 * Returns null when the value cannot be normalized into a non-empty string.
 */
export const normalizeEmail = (value) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed ? trimmed : null;
};

/**
 * Determine whether a value is a valid 24-character hex MongoDB ObjectId.
 * Stricter than mongoose.Types.ObjectId.isValid() which accepts 12-byte strings.
 */
export const isValidObjectId = (value) => {
  if (!value) return false;
  return OBJECT_ID_HEX.test(String(value));
};
