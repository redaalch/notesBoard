import { describe, it, expect } from "vitest";
import { sanitizeHtml } from "../sanitize";
import { extractApiError } from "../extractApiError";

// ── sanitizeHtml ───────────────────────────────────────────────────────────

describe("sanitizeHtml", () => {
  it("strips <script> tags entirely", () => {
    expect(sanitizeHtml('<script>alert("xss")</script>')).toBe("");
  });

  it("strips inline event handlers", () => {
    const input = '<img src="x" onerror="alert(1)">';
    const result = sanitizeHtml(input);
    expect(result).not.toContain("onerror");
  });

  it("blocks javascript: URIs in href", () => {
    const input = '<a href="javascript:alert(1)">click</a>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain("javascript:");
  });

  it("blocks data: URIs in img src", () => {
    const input =
      '<img src="data:text/html,<script>alert(1)</script>" alt="x">';
    const result = sanitizeHtml(input);
    expect(result).not.toContain("data:");
  });

  it("strips iframe tags", () => {
    const input = '<iframe src="https://evil.com"></iframe>';
    expect(sanitizeHtml(input)).toBe("");
  });

  it("strips form elements (except input for task lists)", () => {
    const input = '<form action="/steal"><button>Submit</button></form>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain("<form");
    expect(result).not.toContain("<button");
  });

  it("strips arbitrary data-* attributes", () => {
    const input = '<div data-secret="token123">text</div>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain("data-secret");
    expect(result).toContain("text");
  });

  it("allows safe prose HTML through", () => {
    const input =
      '<h1>Title</h1><p>Hello <strong>world</strong> and <em>italic</em></p>';
    expect(sanitizeHtml(input)).toBe(input);
  });

  it("allows safe links with https href", () => {
    const input = '<a href="https://example.com" target="_blank">link</a>';
    expect(sanitizeHtml(input)).toBe(input);
  });

  it("allows TipTap task-list attributes", () => {
    const input =
      '<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked disabled></label></li></ul>';
    const result = sanitizeHtml(input);
    expect(result).toContain('data-type="taskList"');
    expect(result).toContain('data-checked="true"');
    expect(result).toContain('type="checkbox"');
  });

  it("allows table elements", () => {
    const input =
      "<table><thead><tr><th>Col</th></tr></thead><tbody><tr><td>Val</td></tr></tbody></table>";
    expect(sanitizeHtml(input)).toBe(input);
  });

  it("allows img with safe attributes", () => {
    const input =
      '<img src="https://example.com/img.png" alt="photo" width="100" height="100" loading="lazy">';
    expect(sanitizeHtml(input)).toBe(input);
  });

  it("strips style attributes", () => {
    const input = '<p style="color:red">text</p>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain("style");
    expect(result).toContain("<p>text</p>");
  });
});

// ── extractApiError ────────────────────────────────────────────────────────

describe("extractApiError", () => {
  const FALLBACK = "Something went wrong.";

  it("returns backend message for 400 status", () => {
    const err = { response: { status: 400, data: { message: "Invalid email" } } };
    expect(extractApiError(err, FALLBACK)).toBe("Invalid email");
  });

  it("returns backend message for 409 status", () => {
    const err = {
      response: { status: 409, data: { message: "Email already exists" } },
    };
    expect(extractApiError(err, FALLBACK)).toBe("Email already exists");
  });

  it("returns backend message when status is undefined (e.g. test mock)", () => {
    const err = { response: { data: { message: "Custom error" } } };
    expect(extractApiError(err, FALLBACK)).toBe("Custom error");
  });

  it("returns fallback for 500 status", () => {
    const err = {
      response: { status: 500, data: { message: "MongoServerError: ..." } },
    };
    expect(extractApiError(err, FALLBACK)).toBe(FALLBACK);
  });

  it("returns fallback for 502 status", () => {
    const err = {
      response: { status: 502, data: { message: "Bad Gateway" } },
    };
    expect(extractApiError(err, FALLBACK)).toBe(FALLBACK);
  });

  it("returns fallback when message contains HTML", () => {
    const err = {
      response: { status: 400, data: { message: "<html><body>Error</body></html>" } },
    };
    expect(extractApiError(err, FALLBACK)).toBe(FALLBACK);
  });

  it("returns fallback when message contains stack trace", () => {
    const err = {
      response: {
        status: 400,
        data: { message: "  at Object.<anonymous> (/app/src/index.js:10:5)" },
      },
    };
    expect(extractApiError(err, FALLBACK)).toBe(FALLBACK);
  });

  it("returns fallback when message contains Error:", () => {
    const err = {
      response: { status: 400, data: { message: "TypeError: Cannot read properties" } },
    };
    expect(extractApiError(err, FALLBACK)).toBe(FALLBACK);
  });

  it("returns fallback when message contains Traceback", () => {
    const err = {
      response: { status: 400, data: { message: "Traceback (most recent call last):" } },
    };
    expect(extractApiError(err, FALLBACK)).toBe(FALLBACK);
  });

  it("returns fallback when message exceeds 200 characters", () => {
    const longMsg = "x".repeat(201);
    const err = { response: { status: 400, data: { message: longMsg } } };
    expect(extractApiError(err, FALLBACK)).toBe(FALLBACK);
  });

  it("returns message at exactly 200 characters", () => {
    const msg = "x".repeat(200);
    const err = { response: { status: 400, data: { message: msg } } };
    expect(extractApiError(err, FALLBACK)).toBe(msg);
  });

  it("returns fallback when message is empty string", () => {
    const err = { response: { status: 400, data: { message: "" } } };
    expect(extractApiError(err, FALLBACK)).toBe(FALLBACK);
  });

  it("returns fallback for null error", () => {
    expect(extractApiError(null, FALLBACK)).toBe(FALLBACK);
  });

  it("returns fallback for undefined error", () => {
    expect(extractApiError(undefined, FALLBACK)).toBe(FALLBACK);
  });

  it("returns fallback when message is not a string", () => {
    const err = { response: { status: 400, data: { message: 42 } } };
    expect(extractApiError(err, FALLBACK)).toBe(FALLBACK);
  });

  it("returns fallback for network error (no response)", () => {
    const err = { message: "Network Error" };
    expect(extractApiError(err, FALLBACK)).toBe(FALLBACK);
  });

  it("does not false-positive on normal messages containing 'at'", () => {
    const err = {
      response: {
        status: 409,
        data: { message: "An account with that email already exists." },
      },
    };
    expect(extractApiError(err, FALLBACK)).toBe(
      "An account with that email already exists.",
    );
  });
});
