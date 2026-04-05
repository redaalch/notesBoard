import mongoose from "mongoose";

const savedNotebookQuerySchema = new mongoose.Schema(
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
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    query: {
      type: String,
      default: "",
      maxlength: 512,
    },
    filters: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
      validate: {
        validator: (v) => {
          if (v == null) return true;
          if (typeof v !== "object" || Array.isArray(v)) return false;
          if (Object.keys(v).length > 30) return false;
          try { return JSON.stringify(v).length <= 16_000; } catch { return false; }
        },
        message: "filters must be a plain object (max 30 keys) and not exceed 16 KB",
      },
    },
    sort: {
      type: Map,
      of: String,
      default: () => new Map(),
    },
    scope: {
      type: String,
      default: "notebook",
      maxlength: 32,
    },
    metadata: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: () => new Map(),
      validate: {
        validator: (v) => {
          if (!v || v.size === 0) return true;
          if (v.size > 50) return false;
          try { return JSON.stringify(Object.fromEntries(v)).length <= 16_000; } catch { return false; }
        },
        message: "metadata must have at most 50 entries and not exceed 16 KB",
      },
    },
    lastUsedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

savedNotebookQuerySchema.index(
  { notebookId: 1, userId: 1, name: 1 },
  { unique: true }
);
savedNotebookQuerySchema.index({ ownerId: 1, updatedAt: -1 });

const SavedNotebookQuery = mongoose.model(
  "SavedNotebookQuery",
  savedNotebookQuerySchema
);

export default SavedNotebookQuery;
