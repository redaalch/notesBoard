/**
 * Async handler wrapper to eliminate try-catch blocks in controllers
 * Automatically catches and forwards errors to error handling middleware
 *
 * @param {Function} fn - Async controller function
 * @returns {Function} - Express middleware function
 *
 * @example
 * router.get('/notes', asyncHandler(async (req, res) => {
 *   const notes = await Note.find();
 *   res.json(notes);
 * }));
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export default asyncHandler;
