/**
 * Not Found (404) middleware
 * Handles requests to undefined routes
 */
const notFound = (req, res) => {
  res.status(404).json({
    message: "Route not found",
    path: req.originalUrl,
    method: req.method,
  });
};

export default notFound;
