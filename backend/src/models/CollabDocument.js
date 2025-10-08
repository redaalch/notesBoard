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
    },
    updatedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true }
);

const CollabDocument = mongoose.model("CollabDocument", collabDocumentSchema);

export default CollabDocument;
