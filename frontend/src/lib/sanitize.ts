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
