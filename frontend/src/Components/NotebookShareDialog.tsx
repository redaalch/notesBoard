import { useCallback, useEffect, useState } from "react";
import { XIcon } from "lucide-react";
import MembersPanel from "./notebook-share/MembersPanel";
import ShareLinksPanel from "./notebook-share/ShareLinksPanel";
import { formatRoleLabel } from "./notebook-share/shareHelpers";

export interface ShareNotebook {
  id?: string;
  _id?: string;
  name?: string;
}

export interface NotebookShareDialogProps {
  notebook: ShareNotebook | null;
  open: boolean;
  onClose: () => void;
}

function NotebookShareDialog({
  notebook,
  open,
  onClose,
}: NotebookShareDialogProps) {
  const notebookId = notebook?.id ?? null;
  const notebookName = notebook?.name ?? "Notebook";
  const [actorRole, setActorRole] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setActorRole(null);
    }
  }, [open]);

  const handleActorRoleChange = useCallback((role: string | null) => {
    setActorRole(role);
  }, []);

  if (!open || !notebookId) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[96] flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-10 sm:px-6"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl rounded-[32px] border border-base-300/50 bg-base-100/95 px-5 py-6 shadow-2xl backdrop-blur-sm sm:px-8"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold text-base-content">
              Share &quot;{notebookName}&quot;
            </h2>
            <p className="text-sm text-base-content/70">
              Invite teammates or generate share links. Your role:
              <span className="ml-1 font-medium text-base-content">
                {formatRoleLabel(actorRole) ?? "Viewer"}
              </span>
            </p>
          </div>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={onClose}
          >
            <XIcon className="size-4" />
            Close
          </button>
        </header>

        <section className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          <MembersPanel
            notebookId={notebookId}
            open={open}
            onActorRoleChange={handleActorRoleChange}
          />
          <ShareLinksPanel notebookId={notebookId} open={open} />
        </section>
      </div>
    </div>
  );
}

export default NotebookShareDialog;
