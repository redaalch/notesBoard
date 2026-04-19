import express from "express";
import auth from "../middleware/auth.js";
import { getActivityHeatmap } from "../controllers/activityController.js";

const router = express.Router();

router.use(auth);

router.get("/heatmap", getActivityHeatmap);

export default router;
