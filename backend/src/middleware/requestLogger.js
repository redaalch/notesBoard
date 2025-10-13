import logger from "../utils/logger.js";

/**
 * Request logging middleware
 * Logs incoming requests with timing information
 */
const requestLogger = (req, res, next) => {
  const startTime = Date.now();

  // Capture original end function
  const originalEnd = res.end;

  // Override end function to log response
  res.end = function (...args) {
    const duration = Date.now() - startTime;
    const logData = {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
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

    // Call original end function
    originalEnd.apply(res, args);
  };

  next();
};

export default requestLogger;
