import { describe, it, expect } from "vitest";
import mongoose from "mongoose";

import {
  normalizeEmail,
  isValidObjectId,
} from "../src/utils/validators.js";

// ── normalizeEmail ──────────────────────────────────────────────────────────

describe("normalizeEmail", () => {
  it("returns null for non-string values", () => {
    expect(normalizeEmail(null)).toBeNull();
    expect(normalizeEmail(undefined)).toBeNull();
    expect(normalizeEmail(42)).toBeNull();
    expect(normalizeEmail({})).toBeNull();
    expect(normalizeEmail([])).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(normalizeEmail("")).toBeNull();
  });

  it("returns null for a whitespace-only string", () => {
    expect(normalizeEmail("   ")).toBeNull();
    expect(normalizeEmail("\t\n")).toBeNull();
  });

  it("lowercases the entire address", () => {
    expect(normalizeEmail("Ada@LOVELACE.IO")).toBe("ada@lovelace.io");
  });

  it("trims leading and trailing whitespace", () => {
    expect(normalizeEmail("  user@example.com  ")).toBe("user@example.com");
  });

  it("trims and lowercases simultaneously", () => {
    expect(normalizeEmail("  User@Example.COM  ")).toBe("user@example.com");
  });

  it("returns a valid lowercase email unchanged", () => {
    expect(normalizeEmail("hello@world.dev")).toBe("hello@world.dev");
  });
});

// ── isValidObjectId ─────────────────────────────────────────────────────────

describe("isValidObjectId", () => {
  it("returns false for null", () => {
    expect(isValidObjectId(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isValidObjectId(undefined)).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isValidObjectId("")).toBe(false);
  });

  it("rejects 12-character strings (shorter than the canonical 24-char hex form)", () => {
    // Historically, mongoose.Types.ObjectId.isValid() accepted 12-char ASCII
    // strings as binary ObjectId bytes. Our stricter regex always rejects them
    // regardless of mongoose version, preventing potential access-control bypasses.
    expect(isValidObjectId("aaaaaaaaaaaa")).toBe(false);
  });

  it("returns false for a 23-character hex string (one char short)", () => {
    expect(isValidObjectId("6507f1f77bcf86cd799439")).toBe(false);
  });

  it("returns false for a 25-character hex string (one char over)", () => {
    expect(isValidObjectId("6507f1f77bcf86cd7994398abc")).toBe(false);
  });

  it("returns false when the string contains non-hex characters", () => {
    expect(isValidObjectId("6507f1f77bcf86cd7994398z")).toBe(false);
    expect(isValidObjectId("6507f1f7-bcf8-6cd7-9943-98")).toBe(false);
  });

  it("accepts a valid lowercase 24-character hex string", () => {
    expect(isValidObjectId("6507f1f77bcf86cd79943982")).toBe(true);
  });

  it("accepts a valid uppercase 24-character hex string", () => {
    expect(isValidObjectId("6507F1F77BCF86CD79943982")).toBe(true);
  });

  it("accepts a mongoose ObjectId instance (coerced via toString)", () => {
    const id = new mongoose.Types.ObjectId();
    expect(isValidObjectId(id)).toBe(true);
  });
});
