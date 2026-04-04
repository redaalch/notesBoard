import { describe, expect, it } from "vitest";

import mongoose from "mongoose";
import Note from "../src/models/Note.js";

describe("Note model validation", () => {
  const buildNote = (overrides = {}) =>
    new Note({
      owner: new mongoose.Types.ObjectId(),
      title: "Valid title",
      content: "This is a perfectly fine note.",
      ...overrides,
    });

  it("allows clean title and content", () => {
    const note = buildNote({
      title: "Budget $50",
      content: "Monthly plan with allocated amounts.",
    });

    expect(note.validateSync()).toBeUndefined();
  });

  it("allows content with script tags (free-form notes)", () => {
    const note = buildNote({
      content: "<script>alert('XSS');</script>",
    });

    // Content is free-form — sanitization happens at the rendering layer, not storage.
    expect(note.validateSync()).toBeUndefined();
  });

  it("rejects content exceeding maxlength", () => {
    const note = buildNote({
      content: "a".repeat(50001),
    });

    const error = note.validateSync();
    expect(error?.errors?.content).toBeDefined();
  });

  it("rejects Mongo-style operators", () => {
    const note = buildNote({
      title: "$where",
    });

    const error = note.validateSync();

    expect(error?.errors?.title?.message).toBe(
      "Title contains disallowed content."
    );
  });

  it("rejects profane language", () => {
    const note = buildNote({
      title: "This is shit",
    });

    const error = note.validateSync();

    expect(error?.errors?.title?.message).toBe(
      "Title contains disallowed content."
    );
  });

  it("normalizes and de-duplicates tags", () => {
    const note = buildNote({
      tags: ["Work", "work", " Focus ", "Deep"],
    });

    expect(note.tags).toEqual(["work", "focus", "deep"]);
    expect(note.validateSync()).toBeUndefined();
  });

  it("rejects tags with disallowed patterns", () => {
    const note = buildNote({
      tags: ["$where"],
    });

    const error = note.validateSync();

    expect(error?.errors?.tags?.message).toBe(
      "Tags contain disallowed content."
    );
  });

  it("rejects a tag exceeding 32 characters", () => {
    const note = buildNote({
      tags: ["a".repeat(33)],
    });

    const error = note.validateSync();
    expect(error?.errors?.tags?.message).toBe(
      "Tags contain disallowed content."
    );
  });
});
