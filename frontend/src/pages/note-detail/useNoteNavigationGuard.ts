import { useEffect, type MutableRefObject } from "react";

interface UseNoteNavigationGuardArgs {
  hasChanges: boolean;
  allowNavigationRef: MutableRefObject<boolean>;
  handleSaveRef: MutableRefObject<(silent?: boolean) => Promise<void>>;
}

export function useNoteNavigationGuard({
  hasChanges,
  allowNavigationRef,
  handleSaveRef,
}: UseNoteNavigationGuardArgs): void {
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (hasChanges && !allowNavigationRef.current) {
        void handleSaveRef.current(true);
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [allowNavigationRef, handleSaveRef, hasChanges]);

  useEffect(() => {
    if (!hasChanges) return undefined;

    const handleClick = (e: MouseEvent) => {
      const link = (e.target as HTMLElement).closest("a");
      if (link && link.href && !link.href.includes(window.location.pathname)) {
        e.preventDefault();
        const dest = link.href;
        allowNavigationRef.current = true;
        handleSaveRef
          .current(true)
          .catch(() => {
            /* best-effort */
          })
          .finally(() => {
            window.location.href = dest;
          });
      }
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [allowNavigationRef, handleSaveRef, hasChanges]);
}
