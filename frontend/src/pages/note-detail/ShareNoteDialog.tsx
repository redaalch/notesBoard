import { lazy, Suspense } from "react";

const NoteCollaboratorsCard = lazy(
  () => import("../../Components/NoteCollaboratorsCard"),
);

interface ShareNoteDialogProps {
  open: boolean;
  noteId: string | null | undefined;
  canManage: boolean;
  ownerName?: string;
  ownerEmail?: string;
  onClose: () => void;
}

function ShareNoteDialog({
  open,
  noteId,
  canManage,
  ownerName,
  ownerEmail,
  onClose,
}: ShareNoteDialogProps) {
  return (
    <dialog
      className={`modal ${open ? "modal-open" : ""}`}
      role="dialog"
      aria-labelledby="share-modal-title"
    >
      <div className="modal-box max-w-lg w-[32rem] rounded-2xl p-0 overflow-hidden">
        <div className="flex items-center justify-between border-b border-base-300/40 px-6 py-4">
          <h3
            id="share-modal-title"
            className="text-lg font-semibold text-base-content"
          >
            Share Note
          </h3>
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-circle"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="px-6 py-5">
          {noteId ? (
            <Suspense fallback={null}>
              <NoteCollaboratorsCard
                noteId={noteId}
                canManage={canManage}
                owner={
                  ownerName || ownerEmail
                    ? { name: ownerName, email: ownerEmail }
                    : undefined
                }
              />
            </Suspense>
          ) : null}
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="button" onClick={onClose}>
          close
        </button>
      </form>
    </dialog>
  );
}

export default ShareNoteDialog;
