/**
 * Distributed rate-limit store abstraction.
 *
 * Two implementations are provided:
 *   - MemoryRateLimitStore  — single-process, suitable for local dev/tests only.
 *   - RedisRateLimitStore   — distributed, backed by Azure Cache for Redis.
 *
 * Callers should obtain a singleton via `getActiveStore()`.
 */

import Redis from 'ioredis';

/** Result returned by a single `hit()` call. */
export interface RateLimitHitResult {
  /** Whether the request is allowed (i.e., within the limit). */
  allowed: boolean;
  /** Requests remaining in the current window. */
  remaining: number;
  /** Unix epoch (ms) when the window resets. */
  resetAt: number;
}

/** Common interface for all rate-limit store implementations. */
export interface RateLimitStore {
  /** Which backend is active — used to set `x-rate-limit-store` response header. */
  readonly type: 'memory' | 'redis';
  /**
   * Record one request hit.
   * @param key      Unique key identifying the caller + endpoint.
   * @param windowMs Length of the sliding window in milliseconds.
   * @param max      Maximum number of requests allowed per window.
   */
  hit(key: string, windowMs: number, max: number): Promise<RateLimitHitResult>;
  /** Reset the counter for a key (used in tests or administrative resets). */
  reset(key: string): Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// In-memory implementation (local dev / tests)
// ─────────────────────────────────────────────────────────────────────────────

interface MemoryRecord {
  count: number;
  resetAt: number;
}

export class MemoryRateLimitStore implements RateLimitStore {
  readonly type = 'memory' as const;
  private readonly store = new Map<string, MemoryRecord>();

  constructor() {
    // Periodically clean up expired entries to avoid memory leaks.
    setInterval(() => {
      const now = Date.now();
      for (const [k, rec] of this.store.entries()) {
        if (rec.resetAt < now) this.store.delete(k);
      }
    }, 5 * 60 * 1000).unref();
  }

  async hit(key: string, windowMs: number, max: number): Promise<RateLimitHitResult> {
    const now = Date.now();
    let rec = this.store.get(key);
    if (!rec || rec.resetAt < now) {
      rec = { count: 0, resetAt: now + windowMs };
      this.store.set(key, rec);
    }
    if (rec.count >= max) {
      return { allowed: false, remaining: 0, resetAt: rec.resetAt };
    }
    rec.count++;
    return { allowed: true, remaining: max - rec.count, resetAt: rec.resetAt };
  }

  async reset(key: string): Promise<void> {
    this.store.delete(key);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Redis implementation (production / distributed)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lua script for atomic increment + TTL-on-first-hit.
 *
 * KEYS[1] = rate-limit key
 * ARGV[1] = window length in milliseconds
 *
 * Returns: [count, pttl]
 *   count — new counter value after this hit
 *   pttl  — remaining window TTL in milliseconds (≥ 1)
 */
const INCR_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
local pttl = redis.call('PTTL', KEYS[1])
return {count, pttl}
`;

/** ioredis `eval` signature with the return type we expect from INCR_SCRIPT. */
type RedisClientWithEval = Redis & {
  eval(script: string, numkeys: number, key: string, arg: string): Promise<[number, number]>;
};

export class RedisRateLimitStore implements RateLimitStore {
  readonly type = 'redis' as const;
  private readonly client: RedisClientWithEval;

  constructor(redisUrl: string) {
    this.client = new Redis(redisUrl, {
      // Fail fast on connect errors so the app falls back gracefully.
      enableOfflineQueue: false,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    }) as unknown as RedisClientWithEval;
    // Log connection errors without crashing the process.
    this.client.on('error', (err: Error) => {
      console.error('[RedisRateLimitStore] Redis error:', err.message);
    });
  }

  async hit(key: string, windowMs: number, max: number): Promise<RateLimitHitResult> {
    const result = await this.client.eval(INCR_SCRIPT, 1, key, String(windowMs)) as [number, number];

    const count = result[0];
    const pttl = result[1];
    // pttl is -1 if the key has no TTL (should not happen) or -2 if missing; treat as full window.
    const resetAt = Date.now() + (pttl > 0 ? pttl : windowMs);
    const remaining = Math.max(0, max - count);
    return { allowed: count <= max, remaining, resetAt };
  }

  async reset(key: string): Promise<void> {
    await this.client.del(key);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Singleton factory
// ─────────────────────────────────────────────────────────────────────────────

let _store: RateLimitStore | null = null;

/**
 * Returns the active rate-limit store.
 * - Uses Redis when `RATE_LIMIT_REDIS_URL` is set.
 * - Falls back to in-memory, but emits a strong warning in production.
 */
export function getActiveStore(): RateLimitStore {
  if (_store) return _store;

  const redisUrl = process.env.RATE_LIMIT_REDIS_URL;
  if (redisUrl) {
    _store = new RedisRateLimitStore(redisUrl);
    console.log('[rateLimitStore] Using Redis rate-limit store.');
  } else {
    if (process.env.NODE_ENV === 'production') {
      console.warn(
        '[rateLimitStore] WARNING: RATE_LIMIT_REDIS_URL is not set. ' +
        'Using in-memory rate-limit store in production. ' +
        'Requests can bypass limits when load-balanced across multiple instances. ' +
        'Set RATE_LIMIT_REDIS_URL to an Azure Cache for Redis connection string to fix BUG-001.'
      );
    }
    _store = new MemoryRateLimitStore();
  }
  return _store;
}

/** Reset the singleton (used in tests). */
export function _resetActiveStore(): void {
  _store = null;
}
