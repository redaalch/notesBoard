import NotebookEvent from "../models/NotebookEvent.js";
import logger from "../utils/logger.js";

const MAX_SUMMARY_LENGTH = 240;
const MAX_ERROR_LENGTH = 2000;

const truncateString = (value, limit) => {
  if (typeof value !== "string") {
    return value;
  }
  if (value.length <= limit) {
    return value;
  }
  return `${value.slice(0, limit - 1)}…`;
};

export const appendNotebookEvent = async (eventPayload, options = {}) => {
  if (!eventPayload?.notebookId) {
    throw new Error("appendNotebookEvent requires notebookId");
  }
  if (!eventPayload?.ownerId) {
    throw new Error("appendNotebookEvent requires ownerId");
  }
  if (!eventPayload?.actorId) {
    throw new Error("appendNotebookEvent requires actorId");
  }
  if (!eventPayload?.eventType) {
    throw new Error("appendNotebookEvent requires eventType");
  }

  const { session = null, inferPrevEvent = true } = options;

  const payload = {
    ...eventPayload,
  };

  if (payload.summary) {
    payload.summary = truncateString(payload.summary, MAX_SUMMARY_LENGTH);
  }

  if (payload.lastJobError) {
    payload.lastJobError = truncateString(
      payload.lastJobError,
      MAX_ERROR_LENGTH
    );
  }

  if (!payload.version || payload.version < 1) {
    payload.version = 1;
  }

  if (inferPrevEvent && !payload.prevEventId) {
    try {
      const previousQuery = NotebookEvent.findOne({
        notebookId: payload.notebookId,
      })
        .sort({ createdAt: -1 })
        .select({ _id: 1 });

      if (session) {
        previousQuery.session(session);
      }

      const previous = await previousQuery;
      if (previous) {
        payload.prevEventId = previous._id;
      }
    } catch (error) {
      logger.warn("Failed to resolve previous notebook event", {
        message: error?.message,
        notebookId: payload.notebookId?.toString?.() ?? null,
      });
    }
  }

  const createOptions = {};
  if (session) {
    createOptions.session = session;
  }

  const [event] = await NotebookEvent.create([payload], createOptions);
  return event;
};

export default {
  appendNotebookEvent,
};
