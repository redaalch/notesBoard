import mongoose from "mongoose";

const notePublicationSchema = new mongoose.Schema(
  {
    noteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Note",
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
  },
  { timestamps: true },
);

notePublicationSchema.index({ publicSlug: 1 }, { unique: true });
notePublicationSchema.index({ ownerId: 1, updatedAt: -1 });

const NotePublication = mongoose.model(
  "NotePublication",
  notePublicationSchema,
);

export default NotePublication;
