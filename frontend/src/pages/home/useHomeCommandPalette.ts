import { useEffect, type RefObject } from "react";
import { useCommandPalette } from "../../contexts/CommandPaletteContext";

interface UseHomeCommandPaletteArgs {
  selectionMode: boolean;
  drawerOpen: boolean;
  searchInputRef: RefObject<HTMLInputElement | null>;
  onToggleSelectionMode: () => void;
  onOpenTemplates: () => void;
  onOpenNotebookTemplates: () => void;
  onToggleDrawer: () => void;
}

export function useHomeCommandPalette({
  selectionMode,
  drawerOpen,
  searchInputRef,
  onToggleSelectionMode,
  onOpenTemplates,
  onOpenNotebookTemplates,
  onToggleDrawer,
}: UseHomeCommandPaletteArgs): void {
  const { registerCommands } = useCommandPalette();

  useEffect(() => {
    const cleanup = registerCommands([
      {
        id: "home:toggle-selection",
        label: selectionMode
          ? "Exit multi-select mode"
          : "Enter multi-select mode",
        section: "Notes",
        keywords: ["bulk", "multi-select", "select"],
        action: onToggleSelectionMode,
      },
      {
        id: "home:focus-search",
        label: "Focus notes search",
        section: "Notes",
        shortcut: "/",
        action: () => searchInputRef.current?.focus(),
      },
      {
        id: "home:open-templates",
        label: "Browse note templates",
        section: "Notes",
        action: onOpenTemplates,
      },
      {
        id: "home:open-notebook-templates",
        label: "Browse notebook templates",
        section: "Notebooks",
        action: onOpenNotebookTemplates,
      },
      {
        id: "home:toggle-filters",
        label: drawerOpen ? "Close filters drawer" : "Open filters drawer",
        section: "Notes",
        action: onToggleDrawer,
      },
    ]);
    return cleanup;
  }, [
    drawerOpen,
    onOpenNotebookTemplates,
    onOpenTemplates,
    onToggleDrawer,
    onToggleSelectionMode,
    registerCommands,
    searchInputRef,
    selectionMode,
  ]);
}
