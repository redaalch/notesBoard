import express from "express";
import {
  createNote,
  deleteNote,
  getAllNotes,
  updateNote,
  getNoteById,
  getTagStats,
  bulkUpdateNotes,
} from "../controllers/notesController.js";
import auth from "../middleware/auth.js";

const router = express.Router();

router.use(auth);

router.get("/", getAllNotes);

router.get("/tags/stats", getTagStats);

router.post("/bulk", bulkUpdateNotes);

router.get("/:id", getNoteById);

router.post("/", createNote);

router.put("/:id", updateNote);

router.delete("/:id", deleteNote);

export default router;
