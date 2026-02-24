/**
 * Simple in-memory rate limiter for API endpoints
 * For production, use Redis or similar distributed cache
 */

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
