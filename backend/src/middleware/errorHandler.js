import logger from "../utils/logger.js";

/**
 * Centralized error handler middleware
 * Provides consistent error responses and logging
 */
const errorHandler = (err, req, res, next) => {
  // Log the error with context
  const errorContext = {
    message: err.message,
    stack: process.env.NODE_ENV !== "production" ? err.stack : undefined,
    method: req.method,
    path: req.path,
    userId: req.user?.id,
  };

  logger.error("Error occurred", errorContext);

  // Handle specific error types
  if (err.type === "entity.too.large") {
    return res.status(413).json({
      message: "Request body too large",
    });
  }

  if (err.name === "ValidationError") {
    return res.status(400).json({
      message: "Validation error",
      // Strip the "Path `fieldname` (`value`) " prefix that Mongoose prepends
      // to generated messages — it leaks internal schema field names to clients.
      errors: Object.values(err.errors).map((e) => {
        const msg = e.message || "Validation error";
        return msg.replace(/^Path `[^`]+` (\([^)]+\) )?/, "");
      }),
    });
  }

  if (err.name === "CastError") {
    return res.status(400).json({
      message: "Invalid ID format",
    });
  }

  if (err.code === 11000) {
    return res.status(409).json({
      message: "Duplicate entry",
    });
  }

  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({
      message: "Invalid token",
    });
  }

  if (err.name === "TokenExpiredError") {
    return res.status(401).json({
      message: "Token expired",
    });
  }

  // Default error response
  const statusCode = err.statusCode || err.status || 500;
  // Never expose raw error messages for server errors in production — they can
  // leak DB query details, internal paths, or library internals to clients.
  const isServerError = statusCode >= 500;
  const message =
    isServerError && process.env.NODE_ENV === "production"
      ? "Internal server error"
      : err.message || "Internal server error";

  res.status(statusCode).json({
    message,
    ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
  });
};

export default errorHandler;
