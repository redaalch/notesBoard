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
    statusCode: err.statusCode || err.status || 500,
  };

  logger.error("Error occurred", errorContext);

  // Handle specific error types
  if (err.name === "ValidationError") {
    return res.status(400).json({
      message: "Validation error",
      errors: Object.values(err.errors).map((e) => e.message),
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
      field: Object.keys(err.keyPattern || {})[0],
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
  const message = err.message || "Internal server error";

  res.status(statusCode).json({
    message,
    ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
  });
};

export default errorHandler;
