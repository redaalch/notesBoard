import express from "express";
import { listBoards } from "../controllers/boardsController.js";
import auth from "../middleware/auth.js";

const router = express.Router();

router.use(auth);

router.get("/", listBoards);

export default router;
