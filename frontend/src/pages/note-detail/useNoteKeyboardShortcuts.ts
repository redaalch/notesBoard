import { useEffect, type Dispatch, type SetStateAction } from "react";
import { toast } from "sonner";

interface UseNoteKeyboardShortcutsArgs {
  canEditNote: boolean;
  hasChanges: boolean;
  saving: boolean;
  focusMode: boolean;
  onSave: () => void;
  setFocusMode: Dispatch<SetStateAction<boolean>>;
}

export function useNoteKeyboardShortcuts({
  canEditNote,
  hasChanges,
  saving,
  focusMode,
  onSave,
  setFocusMode,
}: UseNoteKeyboardShortcutsArgs): void {
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (!canEditNote) {
          toast.error("You have view-only access to this note.");
          return;
        }
        if (!saving && hasChanges) {
          onSave();
        }
        return;
      }
      if (
        (event.metaKey || event.ctrlKey) &&
        !event.shiftKey &&
        !event.altKey &&
        event.key === "."
      ) {
        event.preventDefault();
        setFocusMode((prev) => !prev);
        return;
      }
      if (event.key === "Escape" && focusMode) {
        setFocusMode(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canEditNote, hasChanges, saving, focusMode, onSave, setFocusMode]);
}
