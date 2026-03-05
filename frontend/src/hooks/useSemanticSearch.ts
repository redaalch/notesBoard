/**
 * useSemanticSearch – Calls GET /notes/search with debouncing.
 *
 * Returns server-side search results (semantic vector search with keyword
 * fallback) along with which search mode was used ("semantic" | "keyword").
 */
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import api from "../lib/axios";

export interface SearchResult {
  _id: string;
  title: string;
  content?: string;
  contentText?: string;
  tags?: string[];
  pinned?: boolean;
  notebookId?: string | null;
  updatedAt?: string;
  createdAt?: string;
  owner?: string;
  score?: number;
}

export interface SemanticSearchResponse {
  results: SearchResult[];
  searchMode: "semantic" | "keyword" | null;
  query: string;
}

const DEBOUNCE_MS = 350;
const MIN_QUERY_LENGTH = 2;

function useSemanticSearch(rawQuery: string, enabled = true) {
  const [debouncedQuery, setDebouncedQuery] = useState("");

  // Debounce the raw query
  useEffect(() => {
    const trimmed = rawQuery.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setDebouncedQuery("");
      return;
    }
    const timer = setTimeout(() => setDebouncedQuery(trimmed), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [rawQuery]);

  const query = useQuery<SemanticSearchResponse>({
    queryKey: ["semantic-search", debouncedQuery],
    queryFn: async () => {
      const { data } = await api.get<SemanticSearchResponse>("/notes/search", {
        params: { q: debouncedQuery, limit: 40 },
      });
      return data;
    },
    enabled: enabled && debouncedQuery.length >= MIN_QUERY_LENGTH,
    staleTime: 60_000,
    placeholderData: (prev) => prev,
    retry: false,
  });

  return {
    /** Server search results, or empty array when inactive */
    results: query.data?.results ?? [],
    /** "semantic" when vector search was used, "keyword" for $text fallback */
    searchMode: query.data?.searchMode ?? null,
    /** The query that was actually sent to the server */
    serverQuery: query.data?.query ?? "",
    /** True while the search request is in flight */
    isSearching: query.isFetching,
    /** Whether the hook is active (query long enough + enabled) */
    isActive: debouncedQuery.length >= MIN_QUERY_LENGTH && enabled,
  };
}

export default useSemanticSearch;
