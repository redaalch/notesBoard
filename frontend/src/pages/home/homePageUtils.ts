import type React from "react";
import {
  AlertTriangleIcon,
  BookmarkIcon,
  BrainIcon,
  BriefcaseBusinessIcon,
  CalendarIcon,
  LightbulbIcon,
  ListTodoIcon,
  NotebookIcon,
  NotebookPenIcon,
  PaletteIcon,
  RocketIcon,
  SparklesIcon,
  StarIcon,
  TargetIcon,
  WorkflowIcon,
  BookOpenIcon,
  LayersIcon,
} from "lucide-react";

export const FILTER_STORAGE_KEY = "notesboard-filters-v1";
export const NOTES_PER_PAGE = 6;
export const NOTEBOOK_ANALYTICS_ENABLED =
  (import.meta.env.VITE_ENABLE_NOTEBOOK_ANALYTICS ?? "false") === "true";

export const mergeOrder = (primary: any[] = [], fallback: any[] = []) => {
  const fallbackStrings = new Set(
    fallback
      .map((id: any) =>
        typeof id === "string" ? id : (id?.toString?.() ?? null),
      )
      .filter(Boolean),
  );

  const result: string[] = [];
  const seen = new Set<string>();

  primary.forEach((id) => {
    const strId = typeof id === "string" ? id : id?.toString?.();
    if (strId && !seen.has(strId) && fallbackStrings.has(strId)) {
      result.push(strId);
      seen.add(strId);
    }
  });

  fallback.forEach((id) => {
    const strId = typeof id === "string" ? id : id?.toString?.();
    if (strId && !seen.has(strId)) {
      result.push(strId);
      seen.add(strId);
    }
  });

  return result;
};

export const noop = () => {};

export const getNoteId = (note: any) => {
  if (!note) return null;
  const rawId = note._id ?? note.id;
  return typeof rawId === "string" ? rawId : (rawId?.toString?.() ?? null);
};

export const sortLabelMap: Record<string, string> = {
  newest: "Newest first",
  oldest: "Oldest first",
  alphabetical: "A → Z",
  updated: "Recently updated",
  custom: "Custom order",
};

export const normalizeSortDirection = (value: any) => {
  if (typeof value === "number") {
    return value >= 0 ? "asc" : "desc";
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["asc", "ascending", "1", "true"].includes(normalized)) {
      return "asc";
    }
    if (["desc", "descending", "-1", "false"].includes(normalized)) {
      return "desc";
    }
  }
  return null;
};

export const sortOrderToSavedSort = (order: string) => {
  switch (order) {
    case "oldest":
      return { updatedAt: "asc" };
    case "alphabetical":
      return { title: "asc" };
    case "newest":
    case "updated":
      return { updatedAt: "desc" };
    default:
      return null;
  }
};

export const savedSortToSortOrder = (sortSpec: any) => {
  if (!sortSpec || typeof sortSpec !== "object") {
    return "newest";
  }

  if (Object.prototype.hasOwnProperty.call(sortSpec, "title")) {
    return "alphabetical";
  }

  if (Object.prototype.hasOwnProperty.call(sortSpec, "updatedAt")) {
    const direction = normalizeSortDirection(sortSpec.updatedAt);
    if (direction === "asc") {
      return "oldest";
    }
    return "newest";
  }

  return "newest";
};

export const BULK_SUCCESS_MESSAGES: Record<string, string> = {
  pin: "Pinned selected notes",
  unpin: "Unpinned selected notes",
  delete: "Deleted selected notes",
  addTags: "Tags added to selected notes",
  move: "Moved notes to the chosen board",
  moveNotebook: "Updated notebooks for selected notes",
};

export const notebookIconComponents: Record<string, React.ComponentType<{ className?: string }>> = {
  Notebook: NotebookIcon,
  NotebookPen: NotebookPenIcon,
  Sparkles: SparklesIcon,
  Lightbulb: LightbulbIcon,
  Star: StarIcon,
  Rocket: RocketIcon,
  Target: TargetIcon,
  Palette: PaletteIcon,
  Layers: LayersIcon,
  BookOpen: BookOpenIcon,
  Workflow: WorkflowIcon,
  Calendar: CalendarIcon,
  ListTodo: ListTodoIcon,
  Bookmark: BookmarkIcon,
  BriefcaseBusiness: BriefcaseBusinessIcon,
  Brain: BrainIcon,
};

export const getNotebookDroppableId = (notebookId: any) =>
  `notebook:${notebookId ?? "uncategorized"}`;
