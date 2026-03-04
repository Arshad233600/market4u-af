/**
 * Rate limiter for API endpoints.
 *
 * Selects the backing store at startup:
 *   - If RATE_LIMIT_REDIS_URL is set: uses the distributed Redis store (BUG-001 fix).
 *   - Otherwise: falls back to the in-memory store (local dev / tests only).
 *
 * The active store type is exposed via `RateLimitResult.storeType` so callers
 * can set the `x-rate-limit-store` response header.
 */

import { getActiveStore } from './rateLimitStore';

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
  /** Which backing store was used — set as `x-rate-limit-store` response header. */
  storeType: 'memory' | 'redis';
}

/**
 * Check if a request is allowed under rate limiting rules.
 * Uses the distributed Redis store when RATE_LIMIT_REDIS_URL is configured,
 * otherwise falls back to the in-memory store.
 */
export async function checkRateLimit(config: RateLimitConfig): Promise<RateLimitResult> {
  const { identifier, maxRequests, windowMs } = config;
  const store = getActiveStore();
  const result = await store.hit(identifier, windowMs, maxRequests);
  return { ...result, storeType: store.type };
}

/**
 * Reset rate limit for a specific identifier (useful for testing).
 */
export async function resetRateLimit(identifier: string): Promise<void> {
  await getActiveStore().reset(identifier);
}
