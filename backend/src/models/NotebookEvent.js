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
      maxlength: 64,
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
    },
    inversePayload: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
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
    },
  },
  { timestamps: true }
);

notebookEventSchema.index({ notebookId: 1, createdAt: -1 });
notebookEventSchema.index({ actorId: 1, createdAt: -1 });
notebookEventSchema.index({ notebookId: 1, eventType: 1, createdAt: -1 });

const NotebookEvent = mongoose.model("NotebookEvent", notebookEventSchema);

export default NotebookEvent;
