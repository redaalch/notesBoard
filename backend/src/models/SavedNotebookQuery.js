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
