import { describe, expect, it } from "vitest";

import Note from "../src/models/Note.js";

describe("Note model validation", () => {
  const buildNote = (overrides = {}) =>
    new Note({
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

  it("rejects content with script tags", () => {
    const note = buildNote({
      content: "<script>alert('XSS');</script>",
    });

    const error = note.validateSync();

    expect(error?.errors?.content?.message).toBe(
      "Content contains disallowed content."
    );
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
});
