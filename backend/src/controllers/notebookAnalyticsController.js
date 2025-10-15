import {
  getNotebookAnalyticsOverview,
  getNotebookActivityAnalytics,
  getNotebookTagAnalytics,
  getNotebookCollaboratorAnalytics,
  getNotebookSnapshotAnalytics,
} from "../services/notebookAnalyticsService.js";
import { resolveNotebookMembership } from "../utils/access.js";

const ensureAnalyticsContext = async (req) => {
  if (req.analyticsContext?.notebookId) {
    if (!req.analyticsContext.memo) {
      req.analyticsContext.memo = req.analyticsMemo ?? new Map();
    }
    if (!req.analyticsMemo) {
      req.analyticsMemo = req.analyticsContext.memo;
    }
    return req.analyticsContext;
  }

  const { id: notebookId } = req.params;

  const membership = await resolveNotebookMembership(notebookId, req.user?.id);
  if (!membership) {
    const error = new Error("Notebook access denied");
    error.status = 403;
    throw error;
  }

  if (!req.analyticsMemo) {
    req.analyticsMemo = new Map();
  }

  const context = { notebookId, membership, memo: req.analyticsMemo };
  req.analyticsContext = context;
  return context;
};

export const getNotebookAnalytics = async (req, res, next) => {
  try {
    const { notebookId, membership, memo } = await ensureAnalyticsContext(req);
    const { range } = req.query;
    const analytics = await getNotebookAnalyticsOverview({
      notebookId,
      range,
      ownerId: membership.notebook?.owner,
      viewerContext: membership.viewerContext,
      memo,
    });

    return res.json(analytics);
  } catch (error) {
    return next(error);
  }
};

export const getNotebookAnalyticsActivity = async (req, res, next) => {
  try {
    const { notebookId, membership, memo } = await ensureAnalyticsContext(req);
    const { range } = req.query;
    const payload = await getNotebookActivityAnalytics({
      notebookId,
      range,
      viewerContext: membership.viewerContext,
      memo,
    });

    return res.json(payload);
  } catch (error) {
    return next(error);
  }
};

export const getNotebookAnalyticsTags = async (req, res, next) => {
  try {
    const { notebookId, membership, memo } = await ensureAnalyticsContext(req);
    const { range } = req.query;
    const payload = await getNotebookTagAnalytics({
      notebookId,
      range,
      viewerContext: membership.viewerContext,
      memo,
    });

    return res.json(payload);
  } catch (error) {
    return next(error);
  }
};

export const getNotebookAnalyticsCollaborators = async (req, res, next) => {
  try {
    const { notebookId, membership } = await ensureAnalyticsContext(req);
    const { range } = req.query;
    const payload = await getNotebookCollaboratorAnalytics({
      notebookId,
      ownerId: membership.notebook?.owner,
      viewerContext: membership.viewerContext,
      range,
    });

    return res.json(payload);
  } catch (error) {
    return next(error);
  }
};

export const getNotebookAnalyticsSnapshots = async (req, res, next) => {
  try {
    const { notebookId, memo } = await ensureAnalyticsContext(req);
    const { range } = req.query;
    const payload = await getNotebookSnapshotAnalytics({
      notebookId,
      range,
      memo,
    });

    return res.json(payload);
  } catch (error) {
    return next(error);
  }
};

export default {
  getNotebookAnalytics,
  getNotebookAnalyticsActivity,
  getNotebookAnalyticsTags,
  getNotebookAnalyticsCollaborators,
  getNotebookAnalyticsSnapshots,
};
