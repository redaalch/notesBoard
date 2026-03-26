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
      validate: {
        validator: (v) => {
          if (v == null || (typeof v === "object" && !Object.keys(v).length)) return true;
          try { return JSON.stringify(v).length <= 64_000; } catch { return false; }
        },
        message: "awareness exceeds the 64 KB size limit",
      },
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
