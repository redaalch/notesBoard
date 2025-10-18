import { Router } from "express";
import { getPublishedNotebookBySlug } from "../controllers/publishedNotebooksController.js";

const router = Router();

router.get("/notebooks/:slug", getPublishedNotebookBySlug);

export default router;
