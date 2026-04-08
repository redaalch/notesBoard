/**
 * Shared application-level constants.
 * Import from here instead of scattering magic numbers across files.
 * Models and middleware should reference these values to prevent drift.
 */

// Auth / token
export const MAX_TOKEN_BYTES = 2048;
export const USER_CACHE_TTL_SECONDS = 10;
export const USER_CACHE_MAX_KEYS = 10_000;

// Notes
export const MAX_NOTE_TITLE_LENGTH = 200;
export const MAX_NOTE_CONTENT_LENGTH = 50_000;
export const MAX_TAGS_PER_NOTE = 20;
export const MAX_TAG_LENGTH = 50;

// Notebooks
// #15 — Align with Note.js schema (was 100, model enforces 120).
export const MAX_NOTEBOOK_NAME_LENGTH = 120;
export const MAX_NOTEBOOK_DESCRIPTION_LENGTH = 500;

// Search / analytics
// #14/#15 — Cap for NotebookIndex.tagFrequencies to stay under the 16 KB
// Mixed field limit set on the model.
export const MAX_TAG_FREQUENCIES = 500;

// Membership / collaboration — caps the size of $in arrays passed to MongoDB
export const MAX_MEMBERSHIP_IN_QUERY = 500;

// Pagination
export const MAX_PAGE_LIMIT = 200;

// Bulk operations
export const MAX_BULK_NOTE_IDS = 100;
export const BULK_NOTE_ACTIONS = /** @type {const} */ ([
  "pin",
  "unpin",
  "delete",
  "addTags",
  "move",
  "moveNotebook",
]);
