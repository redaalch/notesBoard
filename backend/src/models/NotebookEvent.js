import mongoose from "mongoose";

const notebookEventSchema = new mongoose.Schema(
  {
    notebookId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Notebook",
      required: true,
      index: true,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
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
      required: true,
      enum: [
        "edit", "create", "delete", "move", "tag",
        "notebook.create", "notebook.update", "notebook.delete",
        "notebook.move-notes", "notebook.undo", "notebook.sync",
        "notebook.publish", "notebook.unpublish",
      ],
      index: true,
    },
    commandName: {
      type: String,
      default: null,
      maxlength: 64,
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
      validate: {
        validator: (v) => {
          if (v == null) return true;
          try { return JSON.stringify(v).length <= 256_000; } catch { return false; }
        },
        message: "payload exceeds the 256 KB size limit",
      },
    },
    inversePayload: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
      validate: {
        validator: (v) => {
          if (v == null) return true;
          try { return JSON.stringify(v).length <= 256_000; } catch { return false; }
        },
        message: "inversePayload exceeds the 256 KB size limit",
      },
    },
    summary: {
      type: String,
      default: null,
      maxlength: 240,
    },
    noteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Note",
      default: null,
      index: true,
    },
    prevEventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "NotebookEvent",
      default: null,
      index: true,
    },
    parentEventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "NotebookEvent",
      default: null,
      index: true,
    },
    version: {
      type: Number,
      default: 1,
      min: 1,
    },
    metadata: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: () => new Map(),
      validate: {
        validator: (v) => {
          if (!v || v.size === 0) return true;
          try { return JSON.stringify(Object.fromEntries(v)).length <= 16_000; } catch { return false; }
        },
        message: "metadata exceeds the 16 KB size limit",
      },
    },
    expiresAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

const AUDIT_CRITICAL_NOTEBOOK_EVENTS = new Set([
  "notebook.create",
  "notebook.delete",
  "create",
  "delete",
]);

notebookEventSchema.pre("save", function setExpiry(next) {
  if (!this.expiresAt && !AUDIT_CRITICAL_NOTEBOOK_EVENTS.has(this.eventType)) {
    this.expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
  }
  next();
});

notebookEventSchema.index({ notebookId: 1, createdAt: -1 });
notebookEventSchema.index({ actorId: 1, createdAt: -1 });
notebookEventSchema.index({ notebookId: 1, eventType: 1, createdAt: -1 });
notebookEventSchema.index(
  { expiresAt: 1 },
  {
    expireAfterSeconds: 0,
    partialFilterExpression: { expiresAt: { $type: "date" } },
  },
);

const NotebookEvent = mongoose.model("NotebookEvent", notebookEventSchema);

export default NotebookEvent;
