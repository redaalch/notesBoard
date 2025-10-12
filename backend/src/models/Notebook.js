import mongoose from "mongoose";
import {
  NOTEBOOK_COLOR_VALUES,
  NOTEBOOK_ICON_NAMES,
} from "../../../shared/notebookOptions.js";

const notebookSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      default: null,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },
    color: {
      type: String,
      default: null,
      maxlength: 32,
      enum: [null, ...NOTEBOOK_COLOR_VALUES],
    },
    icon: {
      type: String,
      default: null,
      maxlength: 32,
      enum: [null, ...NOTEBOOK_ICON_NAMES],
    },
    noteOrder: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Note",
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

notebookSchema.index({ owner: 1, name: 1 }, { unique: true });

const Notebook = mongoose.model("Notebook", notebookSchema);

export default Notebook;
