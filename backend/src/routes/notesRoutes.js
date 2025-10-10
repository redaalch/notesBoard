import express from "express";
import {
  createNote,
  deleteNote,
  getAllNotes,
  updateNote,
  getNoteById,
  getTagStats,
  bulkUpdateNotes,
  getNoteHistory,
  getNotePresence,
  getNoteLayout,
  updateNoteLayout,
} from "../controllers/notesController.js";
import {
  addNoteCollaborator,
  listNoteCollaborators,
  removeNoteCollaborator,
} from "../controllers/noteCollaboratorsController.js";
import auth from "../middleware/auth.js";

const router = express.Router();

router.use(auth);

router.get("/", getAllNotes);

router.get("/layout", getNoteLayout);
router.put("/layout", updateNoteLayout);

router.get("/tags/stats", getTagStats);

router.post("/bulk", bulkUpdateNotes);

router.get("/:id/history", getNoteHistory);
router.get("/:id/presence", getNotePresence);
router.get("/:id/collaborators", listNoteCollaborators);
router.post("/:id/collaborators", addNoteCollaborator);
router.delete("/:id/collaborators/:collaboratorId", removeNoteCollaborator);
router.get("/:id", getNoteById);

router.post("/", createNote);

router.put("/:id", updateNote);

router.delete("/:id", deleteNote);

export default router;
