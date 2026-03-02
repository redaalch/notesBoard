import { Router } from "express";
import { getPublishedNotebookBySlug } from "../controllers/publishedNotebooksController.js";
import { getPublishedNoteBySlug } from "../controllers/publishedNotesController.js";

const router = Router();

router.get("/notebooks/:slug", getPublishedNotebookBySlug);
router.get("/notes/:slug", getPublishedNoteBySlug);

export default router;
