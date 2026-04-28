import { useEffect, type Dispatch, type SetStateAction } from "react";
import type { NavigateFunction } from "react-router-dom";
import { getNoteId } from "./homePageUtils";

interface NoteLike {
  [key: string]: unknown;
}

interface UseHomeKeyboardShortcutsArgs {
  filteredNotes: NoteLike[];
  selectionMode: boolean;
  selectedNoteIds: string[];
  mobileSidebarOpen: boolean;
  navigate: NavigateFunction;
  searchInputRef: { current: HTMLInputElement | null };
  setSelectionMode: Dispatch<SetStateAction<boolean>>;
  setSelectedNoteIds: Dispatch<SetStateAction<string[]>>;
  setLastSelectedIndex: Dispatch<SetStateAction<number | null>>;
  setMobileSidebarOpen: Dispatch<SetStateAction<boolean>>;
}

const isInteractiveElement = (element: EventTarget | null): boolean => {
  if (!element || !(element instanceof HTMLElement)) return false;
  const tagName = element.tagName?.toLowerCase();
  if (!tagName) return false;
  if (tagName === "input" || tagName === "textarea" || tagName === "select") {
    return true;
  }
  return element.isContentEditable;
};

export function useHomeKeyboardShortcuts({
  filteredNotes,
  selectionMode,
  selectedNoteIds,
  mobileSidebarOpen,
  navigate,
  searchInputRef,
  setSelectionMode,
  setSelectedNoteIds,
  setLastSelectedIndex,
  setMobileSidebarOpen,
}: UseHomeKeyboardShortcutsArgs): void {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isInteractiveElement(event.target)) return;

      if (event.key === "/" && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      if (
        event.key === "n" &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey
      ) {
        event.preventDefault();
        navigate("/create");
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "a") {
        if (!filteredNotes.length) return;
        event.preventDefault();
        const allIds = filteredNotes
          .map((note) => getNoteId(note))
          .filter((id): id is string => Boolean(id));
        setSelectionMode(true);
        setSelectedNoteIds(allIds);
        setLastSelectedIndex(allIds.length ? allIds.length - 1 : null);
        return;
      }

      if (event.key === "Escape") {
        if (mobileSidebarOpen) {
          event.preventDefault();
          setMobileSidebarOpen(false);
          return;
        }
        if (selectionMode || selectedNoteIds.length) {
          event.preventDefault();
          setSelectedNoteIds([]);
          setSelectionMode(false);
          setLastSelectedIndex(null);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    filteredNotes,
    mobileSidebarOpen,
    navigate,
    searchInputRef,
    selectedNoteIds.length,
    selectionMode,
    setLastSelectedIndex,
    setMobileSidebarOpen,
    setSelectedNoteIds,
    setSelectionMode,
  ]);
}
