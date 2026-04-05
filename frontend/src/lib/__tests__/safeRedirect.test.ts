import { describe, it, expect } from "vitest";
import { isSafeRedirect, safeRedirectPath } from "../safeRedirect";

// ── isSafeRedirect ─────────────────────────────────────────────────────────

describe("isSafeRedirect", () => {
  // ── Valid paths ──
  it("accepts a simple relative path", () => {
    expect(isSafeRedirect("/app")).toBe(true);
  });

  it("accepts a path with query parameters", () => {
    expect(isSafeRedirect("/app?q=search&page=2")).toBe(true);
  });

  it("accepts a path with a hash fragment", () => {
    expect(isSafeRedirect("/notes#section")).toBe(true);
  });

  it("accepts a nested path", () => {
    expect(isSafeRedirect("/workspace/123/notes")).toBe(true);
  });

  // ── Protocol-relative attacks ──
  it("rejects protocol-relative URL //evil.com", () => {
    expect(isSafeRedirect("//evil.com")).toBe(false);
  });

  it("rejects //evil.com/path", () => {
    expect(isSafeRedirect("//evil.com/callback")).toBe(false);
  });

  // ── Backslash attack ──
  it("rejects /\\evil.com", () => {
    expect(isSafeRedirect("/\\evil.com")).toBe(false);
  });

  // ── Absolute URL attacks ──
  it("rejects absolute http URL", () => {
    expect(isSafeRedirect("https://evil.com/steal")).toBe(false);
  });

  it("rejects absolute URL without protocol", () => {
    expect(isSafeRedirect("evil.com/steal")).toBe(false);
  });

  // ── Non-string / empty ──
  it("rejects empty string", () => {
    expect(isSafeRedirect("")).toBe(false);
  });

  it("rejects null", () => {
    expect(isSafeRedirect(null)).toBe(false);
  });

  it("rejects undefined", () => {
    expect(isSafeRedirect(undefined)).toBe(false);
  });

  it("rejects a number", () => {
    expect(isSafeRedirect(42)).toBe(false);
  });

  it("rejects an object", () => {
    expect(isSafeRedirect({ path: "/app" })).toBe(false);
  });
});

// ── safeRedirectPath ───────────────────────────────────────────────────────

describe("safeRedirectPath", () => {
  it("returns the path when it is safe", () => {
    expect(safeRedirectPath("/dashboard")).toBe("/dashboard");
  });

  it("returns default fallback /app for unsafe path", () => {
    expect(safeRedirectPath("//evil.com")).toBe("/app");
  });

  it("returns custom fallback when provided", () => {
    expect(safeRedirectPath("//evil.com", "/home")).toBe("/home");
  });

  it("returns fallback for null input", () => {
    expect(safeRedirectPath(null)).toBe("/app");
  });

  it("returns fallback for empty string", () => {
    expect(safeRedirectPath("")).toBe("/app");
  });
});
