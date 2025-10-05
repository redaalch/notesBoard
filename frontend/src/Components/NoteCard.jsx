import { useState } from "react";
import { PenSquareIcon, Trash2Icon } from "lucide-react";
import { Link } from "react-router-dom";
import { formatDate } from "../lib/Utils.js";
import api from "../lib/axios.js";
import toast from "react-hot-toast";
import ConfirmDialog from "./ConfirmDialog.jsx";

function NoteCard({ note, setNotes }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const openConfirm = (event) => {
    event.preventDefault();
    setConfirmOpen(true);
  };

  const closeConfirm = () => {
    if (!deleting) {
      setConfirmOpen(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/notes/${note._id}`);
      setNotes((prev) => prev.filter((item) => item._id !== note._id));
      toast.success("Your note has been deleted successfully");
      setConfirmOpen(false);
    } catch (error) {
      console.log("Error in deleting the note ", error);
      toast.error("Failed to delete the note");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Link
        to={`/note/${note._id}`}
        className="card bg-base-100 hover:shadow-lg transition-all duration-200 border-t-4 border-solid border-[#00FF9d]"
      >
        <div className="card-body">
          <h3 className="card-title text-base-content">{note.title}</h3>
          <p className="text-base-content/70 line-clamp-3">{note.content}</p>
          <div className="card-actions justify-between items-center mt-4">
            <span className="text-sm text-base-content/60">
              {formatDate(new Date(note.createdAt))}
            </span>
            <div className="flex items-center gap-1">
              <PenSquareIcon className="size-4" />
              <button
                className="btn btn-ghost btn-xs text-error"
                onClick={openConfirm}
              >
                <Trash2Icon className="size-4" />
              </button>
            </div>
          </div>
        </div>
      </Link>

      <ConfirmDialog
        open={confirmOpen}
        title="Delete this note?"
        description="Deleting will remove this note permanently. You can't undo this action."
        confirmLabel="Delete"
        cancelLabel="Keep note"
        tone="error"
        confirmLoading={deleting}
        onCancel={closeConfirm}
        onConfirm={handleDelete}
      />
    </>
  );
}

export default NoteCard;
