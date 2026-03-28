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
      default: null,
      index: true,
    },
    boardId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Board",
      default: null,
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
      validate: {
        validator: (v) => {
          if (v == null) return true;
          try { return JSON.stringify(v).length <= 256_000; } catch { return false; }
        },
        message: "diff exceeds the 256 KB size limit",
      },
    },
    awarenessState: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
      validate: {
        validator: (v) => {
          if (v == null) return true;
          try { return JSON.stringify(v).length <= 32_000; } catch { return false; }
        },
        message: "awarenessState exceeds the 32 KB size limit",
      },
    },
    expiresAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

const AUDIT_CRITICAL_EVENTS = new Set(["create", "delete"]);

noteHistorySchema.pre("save", function setExpiry(next) {
  if (!this.expiresAt && !AUDIT_CRITICAL_EVENTS.has(this.eventType)) {
    this.expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
  }
  next();
});

noteHistorySchema.index({ noteId: 1, createdAt: -1 });
noteHistorySchema.index({ boardId: 1, createdAt: -1 });
noteHistorySchema.index(
  { expiresAt: 1 },
  {
    expireAfterSeconds: 0,
    partialFilterExpression: { expiresAt: { $type: "date" } },
  },
);

const NoteHistory = mongoose.model("NoteHistory", noteHistorySchema);

export default NoteHistory;
