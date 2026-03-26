import { resolveNotebookMembership } from "../utils/access.js";
import { isValidObjectId } from "../utils/validators.js";

const ensureNotebookAnalyticsContext = async (req, res, next) => {
  try {
    const { id: notebookId } = req.params;

    if (!isValidObjectId(notebookId)) {
      return res.status(400).json({ message: "Invalid notebook ID" });
    }

    const membership = await resolveNotebookMembership(
      notebookId,
      req.user?.id
    );
    if (!membership) {
      const error = new Error("Notebook access denied");
      error.status = 403;
      throw error;
    }

    if (!req.analyticsMemo) {
      req.analyticsMemo = new Map();
    }

    req.analyticsContext = {
      notebookId,
      membership,
      memo: req.analyticsMemo,
    };

    return next();
  } catch (error) {
    return next(error);
  }
};

export default ensureNotebookAnalyticsContext;
