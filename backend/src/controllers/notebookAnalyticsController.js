import { getNotebookAnalyticsOverview } from "../services/notebookAnalyticsService.js";
import { resolveNotebookMembership } from "../utils/access.js";

export const getNotebookAnalytics = async (req, res, next) => {
  try {
    const { id: notebookId } = req.params;
    const { range } = req.query;

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

    const analytics = await getNotebookAnalyticsOverview({
      notebookId,
      range,
      ownerId: membership.notebook?.owner,
      viewerContext: membership.viewerContext,
      memo: req.analyticsMemo,
    });

    return res.json(analytics);
  } catch (error) {
    return next(error);
  }
};

export default {
  getNotebookAnalytics,
};
