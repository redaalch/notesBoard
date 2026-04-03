import mongoose from "mongoose";

const notebookPublicationSchema = new mongoose.Schema(
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
    publicSlug: {
      type: String,
      required: true,
      maxlength: 64,
      index: true,
    },
    publishedAt: {
      type: Date,
      required: true,
      default: () => new Date(),
    },
    snapshot: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
      validate: {
        validator: (v) => {
          if (v == null) return true;
          try { return JSON.stringify(v).length <= 2_097_152; } catch { return false; }
        },
        message: "snapshot exceeds the 2 MB size limit",
      },
    },
    snapshotHash: {
      type: String,
      default: null,
      maxlength: 128,
    },
    html: {
      type: String,
      default: null,
      maxlength: 2_097_152,
    },
    metadata: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: () => new Map(),
      validate: {
        validator: (v) => {
          if (!v || v.size === 0) return true;
          if (v.size > 50) return false;
          try { return JSON.stringify(Object.fromEntries(v)).length <= 32_000; } catch { return false; }
        },
        message: "metadata must have at most 50 entries and not exceed 32 KB",
      },
    },
  },
  { timestamps: true }
);

notebookPublicationSchema.index({ publicSlug: 1 }, { unique: true });
notebookPublicationSchema.index({ ownerId: 1, updatedAt: -1 });

const NotebookPublication = mongoose.model(
  "NotebookPublication",
  notebookPublicationSchema
);

export default NotebookPublication;
