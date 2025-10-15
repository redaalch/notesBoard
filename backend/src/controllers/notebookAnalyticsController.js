import { getNotebookAnalyticsOverview } from "../services/notebookAnalyticsService.js";
import { ensureNotebookAccess } from "../utils/access.js";

export const getNotebookAnalytics = async (req, res, next) => {
  try {
    const { id: notebookId } = req.params;
    const { range } = req.query;

    const context = await ensureNotebookAccess(notebookId, req.user?.id);

    const analytics = await getNotebookAnalyticsOverview({
      notebookId,
      range,
      ownerId: context.notebook?.owner,
    });

    return res.json(analytics);
  } catch (error) {
    return next(error);
  }
};

export default {
  getNotebookAnalytics,
};
