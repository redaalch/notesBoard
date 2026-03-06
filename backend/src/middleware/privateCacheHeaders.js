import crypto from "crypto";

/**
 * Middleware that sets strict private cache headers on GET responses.
 *
 * - Cache-Control: private — prevents CDNs/proxies from caching authenticated data.
 * - ETag based on response body hash — enables conditional requests (If-None-Match)
 *   so the browser can skip re-downloading an unchanged payload.
 * - Responds with 304 Not Modified when the client already has the current version.
 */
export default function privateCacheHeaders(_req, res, next) {
  // Only intercept GET responses
  if (_req.method !== "GET") return next();

  const originalJson = res.json.bind(res);

  res.json = (body) => {
    // Only add ETag / 304 logic for successful (2xx) responses.
    // Error responses must never be cached or return 304.
    if (res.statusCode >= 200 && res.statusCode < 300) {
      const serialised = typeof body === "string" ? body : JSON.stringify(body);
      const etag = `"${crypto.createHash("md5").update(serialised).digest("hex")}"`;

      res.set("Cache-Control", "private, no-cache, must-revalidate");
      res.set("ETag", etag);

      const ifNoneMatch = _req.headers["if-none-match"];
      if (ifNoneMatch && ifNoneMatch === etag) {
        return res.status(304).end();
      }
    } else {
      // Prevent browsers from caching error responses
      res.set("Cache-Control", "no-store");
    }

    return originalJson(body);
  };

  next();
}
