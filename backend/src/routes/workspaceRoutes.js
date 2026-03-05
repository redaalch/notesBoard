import express from "express";
import auth from "../middleware/auth.js";
import {
  listUserWorkspaces,
  addWorkspaceMember,
  listWorkspaceMembers,
} from "../controllers/workspacesController.js";
import { getWorkspacePredictions } from "../controllers/workspacePredictionsController.js";

const router = express.Router();

router.use(auth);

router.get("/", listUserWorkspaces);
router.get("/:workspaceId/members", listWorkspaceMembers);
router.get("/:workspaceId/predictions", getWorkspacePredictions);
router.post("/:workspaceId/members", addWorkspaceMember);

export default router;
