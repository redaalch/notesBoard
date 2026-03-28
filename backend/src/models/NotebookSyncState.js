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
      validate: {
        validator: (v) => {
          if (v == null) return true;
          try { return JSON.stringify(v).length <= 1_048_576; } catch { return false; }
        },
        message: "snapshot exceeds the 1 MB size limit",
      },
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
              validate: {
                validator: (v) => {
                  if (v == null) return true;
                  try { return JSON.stringify(v).length <= 32_000; } catch { return false; }
                },
                message: "Operation payload exceeds the 32 KB size limit",
              },
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
      validate: {
        validator: (v) => !v || v.length <= 500,
        message: "pendingOperations cannot exceed 500 entries",
      },
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
