import DOMPurify from "dompurify";

/**
 * Hardened DOMPurify configuration for rendering user-generated rich content.
 *
 * - Restricts tags to a safe prose subset (no forms, scripts, embeds, iframes)
 * - Blocks `data:` and `javascript:` URIs via ALLOWED_URI_REGEXP
 * - Strips all `on*` event handler attributes automatically (DOMPurify default)
 * - Allows only layout/linking attributes, not arbitrary data-* attrs
 */
const PURIFY_CONFIG = {
  ALLOWED_TAGS: [
    // Headings
    "h1", "h2", "h3", "h4", "h5", "h6",
    // Block elements
    "p", "br", "hr", "blockquote", "pre", "div", "span",
    // Lists
    "ul", "ol", "li",
    // Inline formatting
    "strong", "em", "b", "i", "u", "s", "del", "sub", "sup", "mark", "small",
    // Code
    "code",
    // Links & images
    "a", "img",
    // Tables
    "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption", "colgroup", "col",
    // Task list (TipTap)
    "label", "input",
  ],
  ALLOWED_ATTR: [
    "href", "src", "alt", "title", "target", "rel",
    "class", "id",
    "colspan", "rowspan", "scope",
    // TipTap task-list attributes
    "data-type", "data-checked", "type", "checked", "disabled",
    // Image sizing
    "width", "height", "loading",
  ],
  // Only allow http(s) and mailto — blocks javascript: and data: URIs
  ALLOWED_URI_REGEXP:
    /^(?:(?:https?|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
  ALLOW_DATA_ATTR: false,
};

/**
 * Sanitize HTML content with a hardened allowlist.
 */
export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, PURIFY_CONFIG) as string;
}

/**
 * Extract a safe, user-facing error message from an Axios error response.
 *
 * - Only surfaces the backend `message` for validation/client errors (4xx).
 * - Returns the generic `fallback` for 5xx, network errors, or any response
 *   that looks like it might leak internal details (stack traces, long
 *   messages, HTML).
 * - Truncates to 200 chars to prevent UI overflow.
 */
const MAX_MESSAGE_LENGTH = 200;
const UNSAFE_PATTERN = /(<\/?[a-z][\s\S]*>|^\s*at\s+\S+\s*\(|Error:|Traceback)/m;

export function extractApiError(
  error: unknown,
  fallback: string,
): string {
  const axiosError = error as {
    response?: { status?: number; data?: { message?: string } };
  } | null;

  const status = axiosError?.response?.status;
  const raw = axiosError?.response?.data?.message;

  // Surface backend messages for client errors (4xx) or when status is
  // unavailable (e.g. test mocks).  Block 5xx messages — they often leak
  // internal details like stack traces or DB error strings.
  const isServerError = typeof status === "number" && status >= 500;

  if (
    typeof raw === "string" &&
    raw.length > 0 &&
    raw.length <= MAX_MESSAGE_LENGTH &&
    !isServerError &&
    !UNSAFE_PATTERN.test(raw)
  ) {
    return raw;
  }

  return fallback;
}
