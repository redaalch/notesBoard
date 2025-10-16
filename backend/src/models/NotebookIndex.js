import mongoose from "mongoose";

const jobStatusValues = ["idle", "queued", "processing", "error"];

const notebookIndexSchema = new mongoose.Schema(
  {
    notebookId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Notebook",
      required: true,
      unique: true,
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
    vector: {
      type: Map,
      of: Number,
      default: () => new Map(),
    },
    tagFrequencies: {
      type: Map,
      of: Number,
      default: () => new Map(),
    },
    noteCount: {
      type: Number,
      default: 0,
    },
    tokenCount: {
      type: Number,
      default: 0,
    },
    distinctTagCount: {
      type: Number,
      default: 0,
    },
    lastIndexedAt: {
      type: Date,
      default: null,
      index: true,
    },
    lastJobQueuedAt: {
      type: Date,
      default: null,
    },
    lastJobStartedAt: {
      type: Date,
      default: null,
    },
    lastJobFinishedAt: {
      type: Date,
      default: null,
    },
    lastJobError: {
      type: String,
      default: null,
      maxlength: 2000,
    },
    lastJobReason: {
      type: String,
      default: null,
      maxlength: 120,
    },
    jobStatus: {
      type: String,
      enum: jobStatusValues,
      default: "idle",
      index: true,
    },
    metadata: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: () => new Map(),
    },
  },
  { timestamps: true }
);

notebookIndexSchema.index({ ownerId: 1, updatedAt: -1 });
notebookIndexSchema.index({ jobStatus: 1, lastJobQueuedAt: -1 });

const NotebookIndex = mongoose.model("NotebookIndex", notebookIndexSchema);

export default NotebookIndex;
