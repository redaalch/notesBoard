import mongoose from "mongoose";

const collabDocumentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    state: {
      type: Buffer,
      required: true,
      validate: {
        validator: (v) => !v || v.length <= 5 * 1024 * 1024,
        message: "state cannot exceed 5 MB",
      },
    },
    awareness: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    updatedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true }
);

collabDocumentSchema.index(
  { updatedAt: 1 },
  { expireAfterSeconds: 90 * 24 * 60 * 60, name: "collab_doc_stale_ttl" },
);

const CollabDocument = mongoose.model("CollabDocument", collabDocumentSchema);

export default CollabDocument;
