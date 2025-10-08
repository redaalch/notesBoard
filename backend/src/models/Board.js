import mongoose from "mongoose";

const boardSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    slug: {
      type: String,
      trim: true,
      maxlength: 160,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

boardSchema.index(
  { workspaceId: 1, name: 1 },
  { unique: true, collation: { locale: "en", strength: 2 } }
);

const Board = mongoose.model("Board", boardSchema);

export default Board;
