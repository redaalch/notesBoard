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
    },
    snapshotHash: {
      type: String,
      default: null,
      maxlength: 128,
    },
    html: {
      type: String,
      default: null,
    },
    metadata: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: () => new Map(),
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
