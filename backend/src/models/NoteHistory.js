import mongoose from "mongoose";

const noteHistorySchema = new mongoose.Schema(
  {
    noteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Note",
      required: true,
      index: true,
    },
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
      index: true,
    },
    boardId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Board",
      required: true,
      index: true,
    },
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    eventType: {
      type: String,
      enum: [
        "edit",
        "pin",
        "unpin",
        "tag",
        "move",
        "create",
        "delete",
        "title",
        "comment",
      ],
      default: "edit",
      index: true,
    },
    summary: {
      type: String,
      trim: true,
      maxlength: 280,
    },
    diff: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    awarenessState: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  { timestamps: true }
);

noteHistorySchema.index({ noteId: 1, createdAt: -1 });
noteHistorySchema.index({ boardId: 1, createdAt: -1 });

const NoteHistory = mongoose.model("NoteHistory", noteHistorySchema);

export default NoteHistory;
