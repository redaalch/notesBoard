import mongoose from "mongoose";

const notebookSyncStateSchema = new mongoose.Schema(
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
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    clientId: {
      type: String,
      default: undefined,
      maxlength: 64,
      index: true,
    },
    baseRevision: {
      type: Number,
      min: 0,
      default: 0,
    },
    currentRevision: {
      type: Number,
      min: 0,
      default: 0,
    },
    lastSyncedAt: {
      type: Date,
      default: null,
    },
    snapshot: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    pendingOperations: {
      type: [
        new mongoose.Schema(
          {
            opId: {
              type: String,
              required: true,
              maxlength: 64,
            },
            opType: {
              type: String,
              required: true,
              maxlength: 64,
            },
            payload: {
              type: mongoose.Schema.Types.Mixed,
              default: null,
            },
            createdAt: {
              type: Date,
              default: () => new Date(),
            },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
    metadata: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: () => new Map(),
    },
  },
  { timestamps: true }
);

notebookSyncStateSchema.index(
  { notebookId: 1, userId: 1, clientId: 1 },
  {
    unique: true,
    partialFilterExpression: { clientId: { $exists: true, $type: "string" } },
  }
);
notebookSyncStateSchema.index(
  { notebookId: 1, userId: 1 },
  { unique: true, partialFilterExpression: { clientId: { $exists: false } } }
);
notebookSyncStateSchema.index({ ownerId: 1, updatedAt: -1 });

const NotebookSyncState = mongoose.model(
  "NotebookSyncState",
  notebookSyncStateSchema
);

export default NotebookSyncState;
