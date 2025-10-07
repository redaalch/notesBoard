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
 * Determine whether a value can be treated as a valid Mongo ObjectId.
 */
export const isValidObjectId = (value) => {
  if (!value) return false;
  return mongoose.Types.ObjectId.isValid(String(value));
};
