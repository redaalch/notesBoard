import {
  useCallback,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import type {
  DragCancelEvent,
  DragEndEvent,
  DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { mergeOrder } from "./homePageUtils";

interface MoveNotesToNotebookArgs {
  noteIds: string[];
  targetNotebookId: string;
  skipLoader?: boolean;
}

interface LayoutMutationLike {
  mutate: (args: { noteIds: string[]; contextId: string }) => void;
}

interface UseHomeDndArgs {
  selectionMode: boolean;
  customizeMode: boolean;
  selectedNoteIds: string[];
  activeDragNoteIds: string[];
  allNoteIds: string[];
  layoutOrder: string[];
  activeNotebookId: string | null;
  lastLayoutMutationRef: MutableRefObject<number>;
  layoutMutationTimeoutRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
  updateLayoutMutation: LayoutMutationLike;
  moveNotesToNotebook: (args: MoveNotesToNotebookArgs) => void;
  setActiveDragId: Dispatch<SetStateAction<string | null>>;
  setActiveDragNoteIds: Dispatch<SetStateAction<string[]>>;
  setCustomOrderOverride: Dispatch<SetStateAction<string[]>>;
}

interface UseHomeDndResult {
  handleDragStart: (event: DragStartEvent) => void;
  handleDragCancel: (event: DragCancelEvent) => void;
  handleDragEnd: (event: DragEndEvent) => void;
}

const toId = (value: unknown): string | null => {
  if (typeof value === "string") return value;
  if (value == null) return null;
  const stringified = (value as { toString?: () => string })?.toString?.();
  return typeof stringified === "string" ? stringified : null;
};

export function useHomeDnd({
  selectionMode,
  customizeMode,
  selectedNoteIds,
  activeDragNoteIds,
  allNoteIds,
  layoutOrder,
  activeNotebookId,
  lastLayoutMutationRef,
  layoutMutationTimeoutRef,
  updateLayoutMutation,
  moveNotesToNotebook,
  setActiveDragId,
  setActiveDragNoteIds,
  setCustomOrderOverride,
}: UseHomeDndArgs): UseHomeDndResult {
  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const activeId = toId(event.active?.id);
      if (!activeId) return;

      requestAnimationFrame(() => {
        setActiveDragId(activeId);
        if (
          selectionMode &&
          selectedNoteIds.includes(activeId) &&
          selectedNoteIds.length > 0
        ) {
          setActiveDragNoteIds(selectedNoteIds);
        } else {
          setActiveDragNoteIds([activeId]);
        }
      });
    },
    [selectionMode, selectedNoteIds, setActiveDragId, setActiveDragNoteIds],
  );

  const handleDragCancel = useCallback(() => {
    setActiveDragId(null);
    setActiveDragNoteIds([]);
  }, [setActiveDragId, setActiveDragNoteIds]);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      const activeId = toId(active?.id);

      setActiveDragId(null);
      setActiveDragNoteIds([]);

      if (!activeId) return;

      const overId = toId(over?.id);

      if (overId && overId.startsWith("notebook:")) {
        const data = over?.data?.current as { notebookId?: string } | undefined;
        const targetNotebookId =
          data?.notebookId ?? overId.replace("notebook:", "");
        const normalizedTarget =
          targetNotebookId === "uncategorized" || targetNotebookId === "all"
            ? "uncategorized"
            : targetNotebookId;

        const idsToMove =
          selectionMode && selectedNoteIds.includes(activeId)
            ? activeDragNoteIds
            : [activeId];

        moveNotesToNotebook({
          noteIds: Array.from(new Set(idsToMove.filter(Boolean))),
          targetNotebookId: normalizedTarget,
          skipLoader: true,
        });
        return;
      }

      if (!customizeMode || !overId || activeId === overId) return;

      requestAnimationFrame(() => {
        setCustomOrderOverride((prev) => {
          const baseline = prev.length
            ? mergeOrder(prev, allNoteIds)
            : mergeOrder(layoutOrder, allNoteIds);
          const oldIndex = baseline.indexOf(activeId);
          const newIndex = baseline.indexOf(overId);

          if (oldIndex === -1 || newIndex === -1) {
            return baseline;
          }

          const reordered = arrayMove(baseline, oldIndex, newIndex);
          const now = Date.now();

          if (now - lastLayoutMutationRef.current < 500) {
            if (layoutMutationTimeoutRef.current) {
              clearTimeout(layoutMutationTimeoutRef.current);
            }
            layoutMutationTimeoutRef.current = setTimeout(() => {
              lastLayoutMutationRef.current = Date.now();
              updateLayoutMutation.mutate({
                noteIds: reordered,
                contextId: activeNotebookId ?? "all",
              });
            }, 500);
          } else {
            lastLayoutMutationRef.current = now;
            updateLayoutMutation.mutate({
              noteIds: reordered,
              contextId: activeNotebookId ?? "all",
            });
          }

          return reordered;
        });
      });
    },
    [
      activeDragNoteIds,
      activeNotebookId,
      allNoteIds,
      customizeMode,
      layoutMutationTimeoutRef,
      layoutOrder,
      lastLayoutMutationRef,
      moveNotesToNotebook,
      selectedNoteIds,
      selectionMode,
      setActiveDragId,
      setActiveDragNoteIds,
      setCustomOrderOverride,
      updateLayoutMutation,
    ],
  );

  return { handleDragStart, handleDragCancel, handleDragEnd };
}
