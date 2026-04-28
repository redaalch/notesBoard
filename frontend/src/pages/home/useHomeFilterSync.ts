import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import type { SetURLSearchParams } from "react-router-dom";
import type { SavedQuery } from "../../Components/NotebookInsightsDrawer";
import type { StoredFilters } from "../../types/api";
import { normalizeTag } from "../../lib/Utils";
import { FILTER_STORAGE_KEY, savedSortToSortOrder } from "./homePageUtils";

interface UseHomeFilterSyncArgs {
  searchParams: URLSearchParams;
  setSearchParams: SetURLSearchParams;
  hasInitializedFiltersRef: MutableRefObject<boolean>;
  applyingSavedQueryRef: MutableRefObject<boolean>;

  activeNotebookId: string;
  setActiveNotebookId: Dispatch<SetStateAction<string>>;
  searchQuery: string;
  setSearchQuery: Dispatch<SetStateAction<string>>;
  minWords: number;
  setMinWords: Dispatch<SetStateAction<number>>;
  activeTab: string;
  setActiveTab: Dispatch<SetStateAction<string>>;
  sortOrder: string;
  setSortOrder: Dispatch<SetStateAction<string>>;
  selectedTags: string[];
  setSelectedTags: Dispatch<SetStateAction<string[]>>;

  appliedSavedQuery: SavedQuery | null;
  setAppliedSavedQuery: Dispatch<SetStateAction<SavedQuery | null>>;
}

const ALLOWED_TABS = new Set(["all", "recent", "long", "short"]);
const ALLOWED_SORTS = new Set([
  "newest",
  "oldest",
  "alphabetical",
  "updated",
  "custom",
]);

const toNormalizedTagList = (source: unknown): string[] => {
  const list = Array.isArray(source)
    ? source
    : typeof source === "string"
      ? source.split(",")
      : [];
  return Array.from(
    new Set(list.map((tag) => normalizeTag(String(tag))).filter(Boolean)),
  );
};

export function useHomeFilterSync({
  searchParams,
  setSearchParams,
  hasInitializedFiltersRef,
  applyingSavedQueryRef,
  activeNotebookId,
  setActiveNotebookId,
  searchQuery,
  setSearchQuery,
  minWords,
  setMinWords,
  activeTab,
  setActiveTab,
  sortOrder,
  setSortOrder,
  selectedTags,
  setSelectedTags,
  appliedSavedQuery,
  setAppliedSavedQuery,
}: UseHomeFilterSyncArgs): void {
  // Initialize from URL + localStorage on first mount.
  useEffect(() => {
    if (hasInitializedFiltersRef.current) return;
    if (typeof window === "undefined") return;

    const params = Object.fromEntries(searchParams.entries());
    let storedFilters: StoredFilters = {};
    try {
      const raw = localStorage.getItem(FILTER_STORAGE_KEY);
      if (raw) {
        storedFilters = JSON.parse(raw);
      }
    } catch (error: unknown) {
      console.warn("Unable to read stored filters", error);
    }

    const initialNotebookRaw =
      params.notebook ?? storedFilters.activeNotebookId ?? "all";
    const normalizedNotebook =
      typeof initialNotebookRaw === "string" && initialNotebookRaw.trim()
        ? initialNotebookRaw
        : "all";
    setActiveNotebookId(normalizedNotebook);

    setSearchQuery(params.q ?? storedFilters.searchQuery ?? "");

    const initialMin = Number(params.minWords ?? storedFilters.minWords ?? 0);
    setMinWords(Number.isFinite(initialMin) ? initialMin : 0);

    const initialTab = params.tab ?? storedFilters.activeTab ?? "all";
    setActiveTab(ALLOWED_TABS.has(initialTab) ? initialTab : "all");

    const initialSort = params.sort ?? storedFilters.sortOrder ?? "newest";
    setSortOrder(ALLOWED_SORTS.has(initialSort) ? initialSort : "newest");

    setSelectedTags(
      toNormalizedTagList(params.tags ?? storedFilters.selectedTags ?? []),
    );

    hasInitializedFiltersRef.current = true;
  }, [
    searchParams,
    hasInitializedFiltersRef,
    setActiveNotebookId,
    setActiveTab,
    setMinWords,
    setSearchQuery,
    setSelectedTags,
    setSortOrder,
  ]);

  // Persist filters to URL + localStorage on any change.
  useEffect(() => {
    if (!hasInitializedFiltersRef.current) return;
    if (typeof window === "undefined") return;

    const params: Record<string, string> = {};
    const trimmedQuery = searchQuery.trim();
    if (trimmedQuery) params.q = trimmedQuery;
    if (Number(minWords) > 0) params.minWords = String(minWords);
    if (activeTab !== "all") params.tab = activeTab;
    if (sortOrder !== "newest") params.sort = sortOrder;
    if (selectedTags.length) params.tags = selectedTags.join(",");
    if (activeNotebookId && activeNotebookId !== "all") {
      params.notebook = activeNotebookId;
    }
    setSearchParams(params, { replace: true });

    try {
      localStorage.setItem(
        FILTER_STORAGE_KEY,
        JSON.stringify({
          searchQuery,
          minWords: Number(minWords) || 0,
          activeTab,
          sortOrder,
          selectedTags,
          activeNotebookId,
        }),
      );
    } catch (error: unknown) {
      console.warn("Unable to persist filters", error);
    }
  }, [
    activeNotebookId,
    activeTab,
    hasInitializedFiltersRef,
    minWords,
    searchQuery,
    selectedTags,
    setSearchParams,
    sortOrder,
  ]);

  // Drop the applied-saved-query banner when any filter drifts from it.
  useEffect(() => {
    if (!appliedSavedQuery) return;
    if (applyingSavedQueryRef.current) return;

    const savedSearch = (appliedSavedQuery?.query ?? "").trim();
    if (savedSearch !== searchQuery.trim()) {
      setAppliedSavedQuery(null);
      return;
    }

    const savedTags = Array.isArray(appliedSavedQuery?.filters?.tags)
      ? Array.from(
          new Set(
            appliedSavedQuery.filters.tags
              .map((tag: string) => normalizeTag(tag))
              .filter(Boolean),
          ),
        )
      : [];
    const currentTags = Array.from(
      new Set(selectedTags.map((tag) => normalizeTag(tag)).filter(Boolean)),
    );
    const tagsMatch =
      savedTags.length === currentTags.length &&
      savedTags.every((tag) => currentTags.includes(tag));
    if (!tagsMatch) {
      setAppliedSavedQuery(null);
      return;
    }

    const normalizedSortOrder = sortOrder === "updated" ? "newest" : sortOrder;
    const savedOrder = savedSortToSortOrder(appliedSavedQuery?.sort);
    if (normalizedSortOrder !== savedOrder) {
      setAppliedSavedQuery(null);
      return;
    }

    const savedMinWords = Number(appliedSavedQuery?.filters?.minWords) || 0;
    if (savedMinWords !== (Number(minWords) || 0)) {
      setAppliedSavedQuery(null);
    }
  }, [
    appliedSavedQuery,
    applyingSavedQueryRef,
    minWords,
    searchQuery,
    selectedTags,
    setAppliedSavedQuery,
    sortOrder,
  ]);
}
