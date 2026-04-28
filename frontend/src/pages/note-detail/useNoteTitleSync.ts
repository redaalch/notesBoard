import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import * as Y from "yjs";

interface UseNoteTitleSyncArgs {
  doc: Y.Doc | null | undefined;
  noteTitle: string | null | undefined;
  setTitle: Dispatch<SetStateAction<string>>;
}

interface UseNoteTitleSyncResult {
  applySharedTitle: (value: string) => void;
}

export function useNoteTitleSync({
  doc,
  noteTitle,
  setTitle,
}: UseNoteTitleSyncArgs): UseNoteTitleSyncResult {
  const titleSharedRef = useRef<Y.Text | null>(null);

  const applySharedTitle = useCallback((value: string) => {
    const shared = titleSharedRef.current;
    const nextValue = typeof value === "string" ? value : "";
    if (!shared) {
      return;
    }
    const currentValue = shared.toString();
    if (currentValue === nextValue) {
      return;
    }

    const docInstance = shared.doc;
    if (!docInstance) {
      return;
    }

    docInstance.transact(() => {
      let start = 0;
      const currentLength = currentValue.length;
      const nextLength = nextValue.length;

      while (
        start < currentLength &&
        start < nextLength &&
        currentValue[start] === nextValue[start]
      ) {
        start += 1;
      }

      let currentEnd = currentLength;
      let nextEnd = nextLength;

      while (
        currentEnd > start &&
        nextEnd > start &&
        currentValue[currentEnd - 1] === nextValue[nextEnd - 1]
      ) {
        currentEnd -= 1;
        nextEnd -= 1;
      }

      const deleteCount = currentEnd - start;
      if (deleteCount > 0) {
        shared.delete(start, deleteCount);
      }

      if (nextEnd > start) {
        shared.insert(start, nextValue.slice(start, nextEnd));
      }
    });
  }, []);

  useEffect(() => {
    if (!doc) return undefined;

    const sharedTitle = doc.getText("title");
    titleSharedRef.current = sharedTitle;

    if (sharedTitle.length === 0 && (noteTitle ?? "")) {
      sharedTitle.doc?.transact(() => {
        if (sharedTitle.length > 0) {
          sharedTitle.delete(0, sharedTitle.length);
        }
        sharedTitle.insert(0, noteTitle ?? "");
      });
    }

    const syncFromShared = () => {
      setTitle(sharedTitle.toString());
    };

    syncFromShared();
    sharedTitle.observe(syncFromShared);

    return () => {
      sharedTitle.unobserve(syncFromShared);
      if (titleSharedRef.current === sharedTitle) {
        titleSharedRef.current = null;
      }
    };
  }, [doc, noteTitle, setTitle]);

  return { applySharedTitle };
}
