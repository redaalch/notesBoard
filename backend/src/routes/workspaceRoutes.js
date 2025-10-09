import express from "express";
import auth from "../middleware/auth.js";
import {
  addWorkspaceMember,
  listWorkspaceMembers,
} from "../controllers/workspacesController.js";

const router = express.Router();

router.use(auth);

router.get("/:workspaceId/members", listWorkspaceMembers);
router.post("/:workspaceId/members", addWorkspaceMember);

export default router;
