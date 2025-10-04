import express from "express";
import {
  createNote,
  deleteNote,
  getAllNotes,
  updateNote,
  getNodeById,
} from "../controllers/notesController.js";

const router = express.Router();

router.get("/", getAllNotes);

router.get("/:id", getNodeById);

router.post("/", createNote);

router.put("/:id", updateNote);

router.delete("/:id", deleteNote);

export default router;
