import { useCallback, useState, type Dispatch, type SetStateAction } from "react";
import { toast } from "sonner";
import type { QueryClient } from "@tanstack/react-query";
import api from "../../lib/axios";
import { extractApiError } from "../../lib/extractApiError";
import type {
  DeleteNotebookPayload,
  NotebookFormState,
  NotebookRef,
} from "../../types/api";
import type { DeleteState } from "./NotebookDeleteDialog";

interface NotebookLike {
  id?: string;
  _id?: string;
  name?: string;
  noteCount?: number;
  [key: string]: unknown;
}

interface UseNotebookCrudArgs {
  notebooks: NotebookLike[];
  activeNotebookId: string;
  handleSelectNotebook: (id: string) => void;
  invalidateNotesCaches: () => Promise<unknown>;
  queryClient: QueryClient;
}

interface NotebookFormSubmitArgs {
  name: string;
  color: string | null;
  icon: string | null;
}

interface UseNotebookCrudResult {
  notebookFormState: NotebookFormState | null;
  notebookFormLoading: boolean;
  notebookDeleteState: DeleteState | null;
  notebookDeleteLoading: boolean;
  setNotebookDeleteState: Dispatch<SetStateAction<DeleteState | null>>;
  openCreateNotebook: () => void;
  openRenameNotebook: (notebook: NotebookRef | null | undefined) => void;
  closeNotebookForm: () => void;
  submitNotebookForm: (args: NotebookFormSubmitArgs) => Promise<void>;
  openDeleteNotebook: (notebook: NotebookLike | null | undefined) => void;
  closeNotebookDelete: () => void;
  confirmNotebookDelete: () => Promise<void>;
}

export function useNotebookCrud({
  notebooks,
  activeNotebookId,
  handleSelectNotebook,
  invalidateNotesCaches,
  queryClient,
}: UseNotebookCrudArgs): UseNotebookCrudResult {
  const [notebookFormState, setNotebookFormState] =
    useState<NotebookFormState | null>(null);
  const [notebookDeleteState, setNotebookDeleteState] =
    useState<DeleteState | null>(null);
  const [notebookFormLoading, setNotebookFormLoading] = useState(false);
  const [notebookDeleteLoading, setNotebookDeleteLoading] = useState(false);

  const openCreateNotebook = useCallback(() => {
    setNotebookFormState({ mode: "create" });
  }, []);

  const openRenameNotebook = useCallback(
    (notebook: NotebookRef | null | undefined) => {
      if (!notebook) return;
      setNotebookFormState({ mode: "edit", notebook: notebook as never });
    },
    [],
  );

  const closeNotebookForm = useCallback(() => {
    setNotebookFormState(null);
    setNotebookFormLoading(false);
  }, []);

  const submitNotebookForm = useCallback(
    async ({ name, color, icon }: NotebookFormSubmitArgs) => {
      if (!name) {
        toast.error("Notebook name is required");
        return;
      }
      setNotebookFormLoading(true);
      try {
        const payload = { name, color, icon };
        let response;
        if (notebookFormState?.mode === "edit" && notebookFormState?.notebook) {
          const editTarget = notebookFormState.notebook as { id?: string };
          response = await api.patch(
            `/notebooks/${editTarget.id}`,
            payload,
          );
          toast.success("Notebook renamed");
        } else {
          response = await api.post("/notebooks", payload);
          toast.success("Notebook created");
        }
        await queryClient.invalidateQueries({ queryKey: ["notebooks"] });
        await queryClient.invalidateQueries({ queryKey: ["notes"] });
        if (notebookFormState?.mode !== "edit") {
          const createdId = response?.data?.id;
          if (createdId) handleSelectNotebook(createdId);
        }
        closeNotebookForm();
      } catch (error: unknown) {
        toast.error(extractApiError(error, "Unable to save notebook"));
      } finally {
        setNotebookFormLoading(false);
      }
    },
    [
      closeNotebookForm,
      handleSelectNotebook,
      notebookFormState,
      queryClient,
    ],
  );

  const openDeleteNotebook = useCallback(
    (notebook: NotebookLike | null | undefined) => {
      if (!notebook) return;
      const fallbackTarget =
        notebooks.find((entry) => entry.id !== notebook.id)?.id ??
        "uncategorized";
      setNotebookDeleteState({
        notebook,
        mode: notebook.noteCount ? "move" : "delete",
        targetNotebookId: fallbackTarget,
        deleteCollaborative: false,
      } as DeleteState);
    },
    [notebooks],
  );

  const closeNotebookDelete = useCallback(() => {
    setNotebookDeleteState(null);
    setNotebookDeleteLoading(false);
  }, []);

  const confirmNotebookDelete = useCallback(async () => {
    if (!notebookDeleteState?.notebook) return;
    const { notebook, mode, targetNotebookId, deleteCollaborative } =
      notebookDeleteState;

    const payload: DeleteNotebookPayload = { mode, deleteCollaborative };
    if (mode === "move") {
      if (targetNotebookId && targetNotebookId !== "uncategorized") {
        payload.targetNotebookId = targetNotebookId;
      }
    }

    setNotebookDeleteLoading(true);
    try {
      await api.delete(`/notebooks/${notebook.id}`, { data: payload });
      toast.success(`Deleted ${notebook.name}`);
      if (activeNotebookId === notebook.id) {
        if (mode === "move" && targetNotebookId) {
          handleSelectNotebook(targetNotebookId);
        } else {
          handleSelectNotebook("all");
        }
      }

      await invalidateNotesCaches();

      closeNotebookDelete();
    } catch (error: unknown) {
      toast.error(extractApiError(error, "Failed to delete notebook"));
    } finally {
      setNotebookDeleteLoading(false);
    }
  }, [
    activeNotebookId,
    closeNotebookDelete,
    handleSelectNotebook,
    invalidateNotesCaches,
    notebookDeleteState,
  ]);

  return {
    notebookFormState,
    notebookFormLoading,
    notebookDeleteState,
    notebookDeleteLoading,
    setNotebookDeleteState,
    openCreateNotebook,
    openRenameNotebook,
    closeNotebookForm,
    submitNotebookForm,
    openDeleteNotebook,
    closeNotebookDelete,
    confirmNotebookDelete,
  };
}
