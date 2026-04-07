/**
 * Shared API response and domain types used across the frontend.
 *
 * These replace `any` annotations with concrete shapes so that
 * TypeScript can catch real bugs and IDE autocompletion works.
 */

// ── API error shape (mirrors Axios error structure) ─────────────────────────

export interface ApiErrorResponse {
  message?: string;
  errors?: { msg: string; param?: string }[];
}

/**
 * Minimal shape of an Axios-like error used throughout the frontend.
 * We intentionally avoid importing AxiosError here so the type file
 * stays dependency-free — any library error that has a `response`
 * property with `status` and `data` will match.
 */
export interface ApiError {
  response?: {
    status?: number;
    data?: ApiErrorResponse;
  };
  message?: string;
}

// ── Notebook ────────────────────────────────────────────────────────────────

export interface Notebook {
  id: string;
  _id?: string;
  name: string;
  color?: string | null;
  icon?: string | null;
  description?: string;
  noteCount?: number;
  isPublic?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/** Lightweight reference used in dialogs that only need id + name. */
export interface NotebookRef {
  id?: string;
  _id?: string;
  name?: string;
}

// ── Note (matches NoteObject in NoteCard.tsx) ───────────────────────────────

export interface Note {
  _id: string;
  id?: string;
  title?: string;
  content?: string;
  tags?: string[];
  pinned?: boolean;
  createdAt: string;
  updatedAt?: string;
  notebookId?: string;
  notebookRole?: string | null;
  effectiveRole?: string | null;
  wordCount?: number;
  [key: string]: unknown;
}

// ── Tag stats ───────────────────────────────────────────────────────────────

export interface TagStat {
  tag: string;
  count: number;
}

// ── History event ───────────────────────────────────────────────────────────

export interface HistoryEntry {
  id: string;
  eventType?: string;
  summary?: string;
  createdAt?: string;
  metadata?: HistoryMetadata;
}

export interface HistoryMetadata {
  summary?: string;
  description?: string;
  noteCount?: number;
  notes?: { id: string; title?: string }[];
  [key: string]: unknown;
}

// ── Notebook members / share responses ──────────────────────────────────────

export interface MembersResponse {
  members?: unknown[];
  canManage?: boolean;
  [key: string]: unknown;
}

export interface ShareLinksResponse {
  shareLinks?: unknown[];
  canManage?: boolean;
  [key: string]: unknown;
}

export interface ShareLinkCreated {
  shareLink?: {
    id: string;
    url: string;
  };
  [key: string]: unknown;
}

// ── Publish state ───────────────────────────────────────────────────────────

export interface PublishState {
  isPublic?: boolean;
  slug?: string | null;
  publishedAt?: string | null;
  [key: string]: unknown;
}

// ── Published note preview (used in insights, published-notebook-page) ──────

export interface NotePreview {
  id: string;
  title?: string;
  content?: string;
  pinned?: boolean;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
}

// ── Saved notebook query ────────────────────────────────────────────────────

export interface SavedNotebookQuery {
  id: string;
  name?: string;
  query?: string;
  filters?: {
    tags?: string[];
    minWords?: number;
  };
  sort?: Record<string, string | number> | null;
  [key: string]: unknown;
}

export interface SavedQueryPayload {
  name: string;
  query: string;
  filters: { tags?: string[]; minWords?: number } | null;
  sort: Record<string, string> | null;
  scope: string;
}

// ── Filter chips ────────────────────────────────────────────────────────────

export interface FilterChip {
  key: string;
  label: string;
  onClear: () => void;
}

// ── Selection meta ──────────────────────────────────────────────────────────

export interface SelectionMeta {
  event?: unknown;
  shiftKey?: boolean;
}

// ── Notebook delete state ───────────────────────────────────────────────────

export interface NotebookDeleteState {
  notebook: Notebook;
  mode: string;
  targetNotebookId: string;
  deleteCollaborative: boolean;
}

// ── Notebook form state ─────────────────────────────────────────────────────

export interface NotebookFormState {
  mode: string;
  notebook?: Notebook;
}

// ── Smart view params ───────────────────────────────────────────────────────

export interface SmartViewParams {
  search?: string;
  matchedTag?: string | null;
  tags?: string[];
  noteCount?: number | null;
}

// ── Layout mutation ─────────────────────────────────────────────────────────

export interface LayoutMutationPayload {
  noteIds: string[];
  notebookId?: string;
}

// ── Stored filters ──────────────────────────────────────────────────────────

export interface StoredFilters {
  activeNotebookId?: string;
  searchQuery?: string;
  minWords?: number;
  activeTab?: string;
  sortOrder?: string;
  selectedTags?: string[];
}

// ── Delete notebook payload ─────────────────────────────────────────────────

export interface DeleteNotebookPayload {
  mode: string;
  deleteCollaborative: boolean;
  targetNotebookId?: string;
}

// ── DnD style (CSS + pointer-events + z-index) ─────────────────────────────

export interface DndStyle {
  transform?: string;
  transition?: string;
  zIndex?: number;
  pointerEvents?: "none" | "auto";
  touchAction?: string;
  willChange?: string;
  opacity?: number;
}
