import mongoose from "mongoose";

const tagBucketSchema = new mongoose.Schema(
  {
    tag: {
      type: String,
      required: true,
      trim: true,
      maxlength: 64,
    },
    count: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false }
);

const snapshotSchema = new mongoose.Schema(
  {
    notebookId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Notebook",
      required: true,
      index: true,
    },
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      default: null,
      index: true,
    },
    date: {
      type: Date,
      required: true,
    },
    notesCreated: {
      type: Number,
      required: true,
      min: 0,
    },
    editsCount: {
      type: Number,
      required: true,
      min: 0,
    },
    uniqueEditors: {
      type: Number,
      required: true,
      min: 0,
    },
    topTags: {
      type: [tagBucketSchema],
      default: [],
    },
    collaboratorTotals: {
      type: Map,
      of: {
        type: Number,
        min: 0,
        default: 0,
      },
      default: () => new Map(),
    },
    generatedAt: {
      type: Date,
      required: true,
      default: () => new Date(),
    },
  },
  {
    timestamps: true,
  }
);

snapshotSchema.index(
  { notebookId: 1, date: 1 },
  { unique: true, name: "notebook_date_unique" }
);

snapshotSchema.index(
  { notebookId: 1, generatedAt: -1 },
  { name: "notebook_generated_desc" }
);

snapshotSchema.index(
  { generatedAt: -1 },
  {
    name: "recent_snapshots_generated_desc",
    partialFilterExpression: {
      generatedAt: {
        $gte: new Date(Date.now() - 1000 * 60 * 60 * 24 * 180),
      },
    },
  }
);

const NotebookAnalyticsSnapshot = mongoose.model(
  "NotebookAnalyticsSnapshot",
  snapshotSchema
);

export default NotebookAnalyticsSnapshot;
