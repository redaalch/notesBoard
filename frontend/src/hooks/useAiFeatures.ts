/**
 * useAiFeatures – Hook that provides AI feature state and actions for notes.
 *
 * Handles:
 *   - AI status check (are features configured?)
 *   - Note summarisation with structured action items
 *   - Predictive tag suggestions
 */
import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "../lib/axios";

export interface ActionItem {
  _id: string;
  text: string;
  completed: boolean;
}

export interface AiSummary {
  summary: string;
  actionItems: ActionItem[];
  generatedAt: string;
}

export interface AiTagSuggestion {
  suggestedTags: string[];
  currentTags: string[];
  generatedAt: string;
}

export interface AiStatus {
  configured: boolean;
  features: {
    semanticSearch: boolean;
    summarization: boolean;
    predictiveTags: boolean;
  };
}

export function useAiStatus() {
  return useQuery<AiStatus>({
    queryKey: ["ai-status"],
    queryFn: async () => {
      const res = await api.get("/ai/status");
      return res.data;
    },
    staleTime: 5 * 60 * 1000, // 5 min
    retry: 1,
  });
}

export function useAiFeatures(noteId: string | null | undefined) {
  const [summary, setSummary] = useState<AiSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [suggestedTags, setSuggestedTags] = useState<string[]>([]);
  const [tagsLoading, setTagsLoading] = useState(false);

  const { data: aiStatus } = useAiStatus();
  const isConfigured = aiStatus?.configured ?? false;

  // Reset when note changes
  useEffect(() => {
    setSummary(null);
    setSuggestedTags([]);
  }, [noteId]);

  const generateSummary = useCallback(async () => {
    if (!noteId || !isConfigured) return;
    setSummaryLoading(true);
    try {
      const res = await api.post(`/ai/notes/${noteId}/summary`);
      if (res.data?.summary) {
        setSummary(res.data);
      }
    } catch {
      // silently fail – AI is optional
    } finally {
      setSummaryLoading(false);
    }
  }, [noteId, isConfigured]);

  const toggleActionItem = useCallback(
    async (itemId: string) => {
      if (!noteId || !summary) return;
      // Optimistic update
      setSummary((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          actionItems: prev.actionItems.map((item) =>
            item._id === itemId
              ? { ...item, completed: !item.completed }
              : item,
          ),
        };
      });
      try {
        await api.patch(`/ai/notes/${noteId}/action-items/${itemId}`);
      } catch {
        // Revert on failure
        setSummary((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            actionItems: prev.actionItems.map((item) =>
              item._id === itemId
                ? { ...item, completed: !item.completed }
                : item,
            ),
          };
        });
      }
    },
    [noteId, summary],
  );

  const requestTagSuggestions = useCallback(async () => {
    if (!noteId || !isConfigured) return;
    setTagsLoading(true);
    try {
      const res = await api.post(`/ai/notes/${noteId}/suggest-tags`);
      if (res.data?.suggestedTags?.length) {
        setSuggestedTags(res.data.suggestedTags);
      }
    } catch {
      // silently fail
    } finally {
      setTagsLoading(false);
    }
  }, [noteId, isConfigured]);

  const clearSuggestedTags = useCallback(() => {
    setSuggestedTags([]);
  }, []);

  return {
    isConfigured,
    // Summary
    summary,
    summaryLoading,
    generateSummary,
    toggleActionItem,
    // Tags
    suggestedTags,
    tagsLoading,
    requestTagSuggestions,
    clearSuggestedTags,
  };
}

export default useAiFeatures;
