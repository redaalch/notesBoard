import rateLimit from "../config/upstash.js";
import logger from "../utils/logger.js";

/**
 * Resolve a per-request client identifier.  Uses the authenticated user id
 * when available, otherwise falls back to IP.  In the test environment an
 * additional hint (email, authorization header, custom header) is appended
 * so each test client gets its own bucket.
 */
const resolveClientId = (req) => {
  const base = req.user?.id ?? req.ip ?? "anon";
  const testHint =
    process.env.NODE_ENV === "test"
      ? req.get("x-test-client-id") ||
        req.body?.email ||
        req.headers?.authorization
      : null;
  return testHint ? `${base}:${testHint}` : base;
};

/**
 * Derive a stable route key from the request so that parameterised paths
 * (e.g. `/api/notes/:id`) share a single bucket instead of creating one
 * per resource.
 */
const resolveRouteKey = (req) => {
  const routePath = req.route?.path
    ? `${req.baseUrl || ""}${req.route.path}`
    : req.originalUrl?.split("?")[0] || req.baseUrl || "unknown";
  return `${req.method}:${routePath}`;
};

/**
 * Core rate-limit check.  Accepts an optional `maxRequests` override that
 * is used by the per-endpoint `strictRateLimiter` factory.  The default
 * (null) delegates to the global limiter configured in `config/upstash.js`.
 */
const checkRateLimit = async (req, res, next, maxRequests = null) => {
  const clientId = resolveClientId(req);
  const routeKey = resolveRouteKey(req);
  const identifier = `rate:${clientId}:${routeKey}`;

  try {
    const result = await rateLimit.limit(identifier);
    let { success, limit, remaining, reset } = result;

    // Per-endpoint override — apply a tighter ceiling on top of the global
    // limiter.  The Upstash / fallback bucket still tracks the request, but
    // we synthetically reject it if the caller-specified max is exceeded.
    if (maxRequests !== null && success) {
      const used = (limit ?? maxRequests) - (remaining ?? 0);
      if (used > maxRequests) {
        success = false;
        remaining = 0;
        limit = maxRequests;
      }
    }

    if (typeof limit !== "undefined") {
      res.setHeader(
        "X-RateLimit-Limit",
        String(maxRequests ?? limit),
      );
    }

    if (typeof remaining !== "undefined") {
      res.setHeader(
        "X-RateLimit-Remaining",
        String(Math.max(remaining ?? 0, 0)),
      );
    }

    if (reset) {
      res.setHeader("X-RateLimit-Reset", String(reset));
    }

    if (!success) {
      logger.warn("Rate limit exceeded", {
        clientId,
        route: routeKey,
        limit: maxRequests ?? limit,
        remaining,
        reset,
      });

      return res.status(429).json({
        message: "Too many requests. Please slow down and try again shortly.",
      });
    }
    next();
  } catch (error) {
    // Fail-closed: if the rate-limiter backend (Upstash/Redis) is unreachable,
    // reject the request to prevent brute-force attacks during outages.
    logger.error("Rate limiter failure — failing closed", {
      error: error?.message,
      stack: error?.stack,
      clientId,
      route: routeKey,
      identifier,
    });
    return res.status(503).json({
      message: "Service temporarily unavailable. Please try again shortly.",
    });
  }
};

/** Global rate limiter middleware (uses default limits from config/upstash). */
const rateLimiter = (req, res, next) => checkRateLimit(req, res, next);

/**
 * Factory for per-endpoint rate limiters with a tighter request ceiling.
 * Usage:  `router.post("/login", strictRateLimiter(5), login);`
 */
export const strictRateLimiter = (maxRequests) => (req, res, next) =>
  checkRateLimit(req, res, next, maxRequests);

export default rateLimiter;
