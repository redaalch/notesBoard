// ── Notebook color types ─────────────────────────────────────

export interface NotebookColor {
  id: string;
  label: string;
  value: string;
  textColor: string;
}

export interface NotebookIcon {
  id: string;
  label: string;
  name: string;
}

// ── Colors ───────────────────────────────────────────────────

export const NOTEBOOK_COLORS: readonly NotebookColor[] = [
  { id: "sunset", label: "Sunset", value: "#f97316", textColor: "#0f172a" },
  { id: "coral", label: "Coral", value: "#fb7185", textColor: "#0f172a" },
  { id: "canary", label: "Canary", value: "#facc15", textColor: "#0f172a" },
  { id: "fern", label: "Fern", value: "#22c55e", textColor: "#052e16" },
  { id: "teal", label: "Teal", value: "#14b8a6", textColor: "#022c22" },
  { id: "sky", label: "Sky", value: "#0ea5e9", textColor: "#082f49" },
  { id: "indigo", label: "Indigo", value: "#6366f1", textColor: "#111827" },
  { id: "violet", label: "Violet", value: "#a855f7", textColor: "#2e1065" },
  { id: "magenta", label: "Magenta", value: "#f472b6", textColor: "#3f0b37" },
  { id: "ruby", label: "Ruby", value: "#ef4444", textColor: "#450a0a" },
  { id: "charcoal", label: "Charcoal", value: "#0f172a", textColor: "#f8fafc" },
  { id: "slate", label: "Slate", value: "#334155", textColor: "#f8fafc" },
] as const;

// ── Icons ────────────────────────────────────────────────────

export const NOTEBOOK_ICONS: readonly NotebookIcon[] = [
  { id: "notebook", label: "Notebook", name: "Notebook" },
  { id: "notebookPen", label: "Notebook + pen", name: "NotebookPen" },
  { id: "sparkles", label: "Sparkles", name: "Sparkles" },
  { id: "lightbulb", label: "Lightbulb", name: "Lightbulb" },
  { id: "star", label: "Star", name: "Star" },
  { id: "rocket", label: "Rocket", name: "Rocket" },
  { id: "target", label: "Target", name: "Target" },
  { id: "palette", label: "Palette", name: "Palette" },
  { id: "layers", label: "Layers", name: "Layers" },
  { id: "bookOpen", label: "Open book", name: "BookOpen" },
  { id: "workflow", label: "Workflow", name: "Workflow" },
  { id: "calendar", label: "Calendar", name: "Calendar" },
  { id: "listTodo", label: "Checklist", name: "ListTodo" },
  { id: "bookmark", label: "Bookmark", name: "Bookmark" },
  { id: "briefcase", label: "Briefcase", name: "BriefcaseBusiness" },
  { id: "brain", label: "Brainstorm", name: "Brain" },
] as const;

// ── Derived helpers ──────────────────────────────────────────

export const NOTEBOOK_COLOR_VALUES: string[] = NOTEBOOK_COLORS.map(
  (color) => color.value,
);

export const NOTEBOOK_ICON_NAMES: string[] = NOTEBOOK_ICONS.map(
  (icon) => icon.name,
);

const colorSet = new Set(NOTEBOOK_COLOR_VALUES);
const iconSet = new Set(NOTEBOOK_ICON_NAMES);

export const isAllowedNotebookColor = (value: unknown): boolean => {
  if (value === null || value === undefined) return true;
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return true;
  return colorSet.has(trimmed);
};

export const isAllowedNotebookIcon = (value: unknown): boolean => {
  if (value === null || value === undefined) return true;
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return true;
  return iconSet.has(trimmed);
};

export const normalizeNotebookColor = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return colorSet.has(trimmed) ? trimmed : null;
};

export const normalizeNotebookIcon = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return iconSet.has(trimmed) ? trimmed : null;
};
