import express from "express";
import auth from "../middleware/auth.js";
import { validate, validationRules } from "../middleware/validation.js";
import {
  listUserWorkspaces,
  addWorkspaceMember,
  listWorkspaceMembers,
} from "../controllers/workspacesController.js";
import { getWorkspacePredictions } from "../controllers/workspacePredictionsController.js";

const router = express.Router();

router.use(auth);

router.get("/", listUserWorkspaces);

router.get(
  "/:workspaceId/members",
  validate([validationRules.objectId("workspaceId")]),
  listWorkspaceMembers,
);

router.get(
  "/:workspaceId/predictions",
  validate([validationRules.objectId("workspaceId")]),
  getWorkspacePredictions,
);

router.post(
  "/:workspaceId/members",
  validate([
    validationRules.objectId("workspaceId"),
    validationRules.email(),
    validationRules.memberRole(),
  ]),
  addWorkspaceMember,
);

export default router;
