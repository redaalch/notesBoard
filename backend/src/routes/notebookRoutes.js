import express from "express";
import auth from "../middleware/auth.js";
import rateLimiter from "../middleware/rateLimiter.js";
import {
  listNotebooks,
  createNotebook,
  updateNotebook,
  deleteNotebook,
  moveNotesToNotebook,
} from "../controllers/notebooksController.js";

const router = express.Router();

router.use(auth);
router.use(rateLimiter);

router.get("/", listNotebooks);
router.post("/", createNotebook);
router.patch("/:id", updateNotebook);
router.delete("/:id", deleteNotebook);
router.post("/:id/move", moveNotesToNotebook);

export default router;
