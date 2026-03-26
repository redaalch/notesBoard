import crypto from "crypto";
import logger from "../utils/logger.js";

/**
 * Request logging middleware
 * Logs incoming requests with timing information
 */
const requestLogger = (req, res, next) => {
  const startTime = Date.now();

  // Attach a unique request ID for correlation across log lines.
  // Prefer a client-supplied ID (e.g. from a load balancer) when present.
  req.requestId = req.get("x-request-id") || crypto.randomUUID();
  res.set("X-Request-Id", req.requestId);

  // Use the 'finish' event instead of overriding res.end — it fires reliably
  // after the response is fully sent regardless of how it was sent (res.json,
  // res.send, res.end, piped streams, etc.).
  res.on("finish", () => {
    const duration = Date.now() - startTime;
    const logData = {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.get("user-agent"),
    };

    // Add user ID if authenticated
    if (req.user?.id) {
      logData.userId = req.user.id;
    }

    // Log based on status code
    if (res.statusCode >= 500) {
      logger.error("Request failed", logData);
    } else if (res.statusCode >= 400) {
      logger.warn("Request rejected", logData);
    } else {
      logger.info("Request completed", logData);
    }
  });

  next();
};

export default requestLogger;
