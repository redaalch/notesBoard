import NodeCache from "node-cache";
import logger from "../utils/logger.js";

/**
 * Simple in-memory cache implementation
 * Can be replaced with Redis in production
 */
class CacheService {
  constructor() {
    this.cache = new NodeCache({
      stdTTL: 300, // 5 minutes default TTL
      checkperiod: 60, // Check for expired keys every 60 seconds
      useClones: false, // Don't clone data for better performance
    });

    this.cache.on("expired", (key) => {
      logger.debug("Cache key expired", { key });
    });
  }

  /**
   * Get value from cache
   * @param {string} key - Cache key
   * @returns {*} - Cached value or undefined
   */
  get(key) {
    try {
      const value = this.cache.get(key);
      if (value !== undefined) {
        logger.debug("Cache hit", { key });
      } else {
        logger.debug("Cache miss", { key });
      }
      return value;
    } catch (error) {
      logger.error("Cache get error", { key, error: error.message });
      return undefined;
    }
  }

  /**
   * Set value in cache
   * @param {string} key - Cache key
   * @param {*} value - Value to cache
   * @param {number} ttl - Time to live in seconds (optional)
   * @returns {boolean} - Success status
   */
  set(key, value, ttl) {
    try {
      const success = this.cache.set(key, value, ttl);
      logger.debug("Cache set", { key, ttl, success });
      return success;
    } catch (error) {
      logger.error("Cache set error", { key, error: error.message });
      return false;
    }
  }

  /**
   * Delete value from cache
   * @param {string} key - Cache key
   * @returns {number} - Number of deleted entries
   */
  del(key) {
    try {
      const count = this.cache.del(key);
      logger.debug("Cache delete", { key, count });
      return count;
    } catch (error) {
      logger.error("Cache delete error", { key, error: error.message });
      return 0;
    }
  }

  /**
   * Delete multiple keys
   * @param {string[]} keys - Array of cache keys
   * @returns {number} - Number of deleted entries
   */
  delMultiple(keys) {
    try {
      const count = this.cache.del(keys);
      logger.debug("Cache delete multiple", { count, keys: keys.length });
      return count;
    } catch (error) {
      logger.error("Cache delete multiple error", { error: error.message });
      return 0;
    }
  }

  /**
   * Clear all cache
   */
  flush() {
    try {
      this.cache.flushAll();
      logger.info("Cache flushed");
    } catch (error) {
      logger.error("Cache flush error", { error: error.message });
    }
  }

  /**
   * Get cache statistics
   * @returns {object} - Cache stats
   */
  getStats() {
    return this.cache.getStats();
  }

  /**
   * Check if key exists
   * @param {string} key - Cache key
   * @returns {boolean}
   */
  has(key) {
    return this.cache.has(key);
  }

  /**
   * Get all keys
   * @returns {string[]}
   */
  keys() {
    return this.cache.keys();
  }

  /**
   * Delete all cache keys matching a prefix.
   * Useful for invalidating route caches for a specific user after mutations.
   * @param {string} prefix - Key prefix to match (e.g. "route:/api/notes")
   * @returns {number} - Number of deleted entries
   */
  delByPrefix(prefix) {
    try {
      const matching = this.cache.keys().filter((k) => k.startsWith(prefix));
      if (matching.length === 0) return 0;
      const count = this.cache.del(matching);
      logger.debug("Cache delByPrefix", { prefix, count });
      return count;
    } catch (error) {
      logger.error("Cache delByPrefix error", {
        prefix,
        error: error.message,
      });
      return 0;
    }
  }

  /**
   * Invalidate all cached route responses for a given user.
   * Call after any mutation so subsequent GETs return fresh data.
   * @param {string} userId
   */
  invalidateUserRoutes(userId) {
    if (!userId) return;
    // Route cache keys follow the pattern  route:<url>:u:<userId>
    // Also clear any user-scoped data caches (e.g. notebook-counts).
    const segment = `:u:${userId}`;
    const dataSuffix = `:${userId}`;
    try {
      const matching = this.cache
        .keys()
        .filter((k) => k.includes(segment) || k.endsWith(dataSuffix));
      if (matching.length) this.cache.del(matching);
    } catch {
      /* best-effort */
    }
  }

  /**
   * Cache middleware for Express routes
   * @param {number} ttl - Time to live in seconds
   * @returns {Function} - Express middleware
   */
  middleware(ttl = 300) {
    return (req, res, next) => {
      // Only cache GET requests
      if (req.method !== "GET") {
        return next();
      }

      // Include user identity in key to prevent cross-user cache leaks
      const userSegment = req.user?.id ? `:u:${req.user.id}` : ":anon";
      const key = `route:${req.originalUrl}${userSegment}`;

      // Try to get cached response
      const cachedResponse = this.get(key);
      if (cachedResponse) {
        return res.json(cachedResponse);
      }

      // Store original res.json
      const originalJson = res.json.bind(res);

      // Override res.json – only cache successful (2xx) responses
      res.json = (body) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          this.set(key, body, ttl);
        }
        return originalJson(body);
      };

      next();
    };
  }
}

// Export singleton instance
export const cacheService = new CacheService();

export default cacheService;
