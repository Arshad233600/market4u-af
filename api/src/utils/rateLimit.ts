/**
 * In-memory rate limiter for API endpoints.
 *
 * WARNING: This store is per-process. In a horizontally-scaled deployment
 * (e.g. Azure Functions with multiple instances) each instance keeps its own
 * independent counter, so a client can exceed the configured limit by having
 * requests routed to different instances.
 *
 * TODO (BUG-001): Replace with a distributed backend such as:
 *   - Azure Cache for Redis (set RATE_LIMIT_REDIS_URL env var)
 *   - Azure API Management built-in rate-limit policy
 * Until then, this in-memory fallback is acceptable for local/dev only.
 */

// Warn loudly when the in-memory store is active in a production environment
// so operators know the distributed back-end is not yet wired up.
if (process.env.NODE_ENV === 'production') {
  console.warn(
    '[rateLimit] WARNING: using in-memory rate-limit store in production. ' +
    'Requests can bypass limits when load-balanced across multiple instances. ' +
    'Configure RATE_LIMIT_REDIS_URL to enable the distributed store (BUG-001).'
  );
}

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitRecord>();

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (record.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

export interface RateLimitConfig {
  /** Unique identifier (e.g., user ID, IP address) */
  identifier: string;
  /** Maximum number of requests allowed */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Check if a request is allowed under rate limiting rules
 */
export function checkRateLimit(config: RateLimitConfig): RateLimitResult {
  const { identifier, maxRequests, windowMs } = config;
  const now = Date.now();
  
  let record = rateLimitStore.get(identifier);
  
  // Initialize or reset if window has expired
  if (!record || record.resetAt < now) {
    record = {
      count: 0,
      resetAt: now + windowMs
    };
    rateLimitStore.set(identifier, record);
  }
  
  // Check if limit exceeded
  if (record.count >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: record.resetAt
    };
  }
  
  // Increment count
  record.count++;
  
  return {
    allowed: true,
    remaining: maxRequests - record.count,
    resetAt: record.resetAt
  };
}

/**
 * Reset rate limit for a specific identifier (useful for testing)
 */
export function resetRateLimit(identifier: string): void {
  rateLimitStore.delete(identifier);
}
