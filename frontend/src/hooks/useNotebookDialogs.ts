import { useCallback, useState } from "react";

import type { NotebookRef } from "../types/api";

export interface NotebookDialogControls {
  value: NotebookRef | null;
  open: (notebook: NotebookRef | null | undefined) => void;
  close: () => void;
}

export interface NotebookDialogsApi {
  publish: NotebookDialogControls;
  history: NotebookDialogControls;
  analytics: NotebookDialogControls;
  share: NotebookDialogControls;
}

export default function useNotebookDialogs(): NotebookDialogsApi {
  const [publish, setPublish] = useState<NotebookRef | null>(null);
  const [history, setHistory] = useState<NotebookRef | null>(null);
  const [analytics, setAnalytics] = useState<NotebookRef | null>(null);
  const [share, setShare] = useState<NotebookRef | null>(null);

  const openPublish = useCallback((nb: NotebookRef | null | undefined) => {
    if (nb) setPublish(nb);
  }, []);
  const closePublish = useCallback(() => setPublish(null), []);

  const openHistory = useCallback((nb: NotebookRef | null | undefined) => {
    if (nb) setHistory(nb);
  }, []);
  const closeHistory = useCallback(() => setHistory(null), []);

  const openAnalytics = useCallback((nb: NotebookRef | null | undefined) => {
    if (nb) setAnalytics(nb);
  }, []);
  const closeAnalytics = useCallback(() => setAnalytics(null), []);

  const openShare = useCallback((nb: NotebookRef | null | undefined) => {
    if (nb) setShare(nb);
  }, []);
  const closeShare = useCallback(() => setShare(null), []);

  return {
    publish: { value: publish, open: openPublish, close: closePublish },
    history: { value: history, open: openHistory, close: closeHistory },
    analytics: {
      value: analytics,
      open: openAnalytics,
      close: closeAnalytics,
    },
    share: { value: share, open: openShare, close: closeShare },
  };
}
