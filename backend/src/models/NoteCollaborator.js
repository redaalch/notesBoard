import mongoose from "mongoose";

const NOTE_COLLAB_ROLES = ["viewer", "commenter", "editor"];

const noteCollaboratorSchema = new mongoose.Schema(
  {
    noteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Note",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: NOTE_COLLAB_ROLES,
      default: "editor",
    },
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    invitedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

noteCollaboratorSchema.index({ noteId: 1, userId: 1 }, { unique: true });

const NoteCollaborator = mongoose.model(
  "NoteCollaborator",
  noteCollaboratorSchema
);

export default NoteCollaborator;
export { NOTE_COLLAB_ROLES };
