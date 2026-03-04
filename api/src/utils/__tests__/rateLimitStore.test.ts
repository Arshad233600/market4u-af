/**
 * Unit tests for rateLimitStore.ts
 *
 * Redis operations are tested without a real Redis instance by mocking the
 * ioredis module with a lightweight in-memory fake that honours INCR, PEXPIRE,
 * PTTL, and DEL commands — and exposes an `eval` method that executes the Lua
 * script logic in JavaScript.
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// ─────────────────────────────────────────────────────────────────────────────
// Lightweight ioredis fake (avoids a real Redis connection)
// ─────────────────────────────────────────────────────────────────────────────

interface FakeEntry { count: number; expireAt: number | null }

class FakeRedis {
  private store = new Map<string, FakeEntry>();

  on(_event: string, _handler: unknown) { return this; }

  async eval(_script: string, _numkeys: number, key: string, windowMsStr: string): Promise<[number, number]> {
    const now = Date.now();
    const windowMs = Number(windowMsStr);

    let entry = this.store.get(key);
    // INCR
    if (!entry || (entry.expireAt !== null && entry.expireAt <= now)) {
      entry = { count: 1, expireAt: now + windowMs };
      this.store.set(key, entry);
    } else {
      entry.count += 1;
    }
    // PEXPIRE only on first hit
    if (entry.count === 1) {
      entry.expireAt = now + windowMs;
    }
    // PTTL
    const pttl = entry.expireAt !== null ? Math.max(1, entry.expireAt - Date.now()) : -1;
    return [entry.count, pttl];
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  /** Helper: peek at the internal store (for assertions). */
  _peek(key: string): FakeEntry | undefined {
    return this.store.get(key);
  }

  /** Helper: expire a key immediately (simulate TTL expiry). */
  _expireNow(key: string): void {
    const entry = this.store.get(key);
    if (entry) entry.expireAt = Date.now() - 1;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Mock ioredis — must be hoisted before any import of rateLimitStore
// ─────────────────────────────────────────────────────────────────────────────

// `fakeRedisInstance` is set each time `new Redis(...)` is called (i.e. once per
// RedisRateLimitStore construction in beforeEach). Vitest runs tests in a single
// thread sequentially within a file, so there is no concurrent-access risk here.
let fakeRedisInstance: FakeRedis;

vi.mock('ioredis', () => {
  return {
    default: vi.fn().mockImplementation(function () {
      fakeRedisInstance = new FakeRedis();
      return fakeRedisInstance;
    }),
  };
});

// Import after mocking
import { RedisRateLimitStore, MemoryRateLimitStore, getActiveStore, _resetActiveStore } from '../rateLimitStore';

// ─────────────────────────────────────────────────────────────────────────────
// MemoryRateLimitStore tests
// ─────────────────────────────────────────────────────────────────────────────

describe('MemoryRateLimitStore', () => {
  let store: MemoryRateLimitStore;
  const KEY = 'mem-test-key';

  beforeEach(() => { store = new MemoryRateLimitStore(); });

  it('has type "memory"', () => {
    expect(store.type).toBe('memory');
  });

  it('allows first request', async () => {
    const r = await store.hit(KEY, 60_000, 5);
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(4);
  });

  it('decrements remaining on each hit', async () => {
    const r1 = await store.hit(KEY, 60_000, 3);
    const r2 = await store.hit(KEY, 60_000, 3);
    const r3 = await store.hit(KEY, 60_000, 3);
    expect(r1.remaining).toBe(2);
    expect(r2.remaining).toBe(1);
    expect(r3.remaining).toBe(0);
  });

  it('blocks after max requests', async () => {
    await store.hit(KEY, 60_000, 2);
    await store.hit(KEY, 60_000, 2);
    const blocked = await store.hit(KEY, 60_000, 2);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it('provides a resetAt in the future', async () => {
    const before = Date.now();
    const r = await store.hit(KEY, 60_000, 5);
    expect(r.resetAt).toBeGreaterThan(before);
  });

  it('resets the counter after the window expires', async () => {
    await store.hit(KEY, 10, 1);
    const blocked = await store.hit(KEY, 10, 1);
    expect(blocked.allowed).toBe(false);

    await new Promise((r) => setTimeout(r, 20));

    const fresh = await store.hit(KEY, 10, 1);
    expect(fresh.allowed).toBe(true);
  });

  it('isolates keys from each other', async () => {
    await store.hit(KEY, 60_000, 1);
    await store.hit(KEY, 60_000, 1); // KEY is now blocked

    const other = await store.hit('other-key', 60_000, 1);
    expect(other.allowed).toBe(true);
  });

  it('reset() clears the counter', async () => {
    await store.hit(KEY, 60_000, 1);
    await store.hit(KEY, 60_000, 1); // blocked
    await store.reset(KEY);
    const fresh = await store.hit(KEY, 60_000, 1);
    expect(fresh.allowed).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// RedisRateLimitStore tests (backed by FakeRedis)
// ─────────────────────────────────────────────────────────────────────────────

describe('RedisRateLimitStore', () => {
  let store: RedisRateLimitStore;
  const KEY = 'redis-test-key';

  beforeEach(() => {
    // Constructing RedisRateLimitStore triggers the mocked `new Redis(...)` call,
    // which sets `fakeRedisInstance` to a fresh FakeRedis.
    store = new RedisRateLimitStore('redis://localhost:6379');
  });

  it('has type "redis"', () => {
    expect(store.type).toBe('redis');
  });

  it('allows first request and returns correct remaining', async () => {
    const r = await store.hit(KEY, 60_000, 5);
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(4);
  });

  it('tracks remaining across multiple hits (atomic INCR)', async () => {
    const r1 = await store.hit(KEY, 60_000, 3);
    const r2 = await store.hit(KEY, 60_000, 3);
    const r3 = await store.hit(KEY, 60_000, 3);
    expect(r1.remaining).toBe(2);
    expect(r2.remaining).toBe(1);
    expect(r3.remaining).toBe(0);
  });

  it('blocks when count exceeds max', async () => {
    await store.hit(KEY, 60_000, 2);
    await store.hit(KEY, 60_000, 2);
    const blocked = await store.hit(KEY, 60_000, 2);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it('sets TTL only on the first hit (atomic via Lua)', async () => {
    // First hit should store an expiry
    await store.hit(KEY, 60_000, 5);
    const entry = fakeRedisInstance._peek(KEY);
    expect(entry?.expireAt).not.toBeNull();
    const firstExpiry = entry!.expireAt!;

    // Second hit must NOT change the expiry (TTL already set)
    await store.hit(KEY, 60_000, 5);
    const entry2 = fakeRedisInstance._peek(KEY);
    expect(entry2?.expireAt).toBe(firstExpiry);
  });

  it('returns resetAt in the future', async () => {
    const before = Date.now();
    const r = await store.hit(KEY, 60_000, 5);
    expect(r.resetAt).toBeGreaterThan(before);
  });

  it('resets the counter after window expiry', async () => {
    await store.hit(KEY, 60_000, 1);
    const blocked = await store.hit(KEY, 60_000, 1);
    expect(blocked.allowed).toBe(false);

    // Simulate TTL expiry in the fake store
    fakeRedisInstance._expireNow(KEY);

    const fresh = await store.hit(KEY, 60_000, 1);
    expect(fresh.allowed).toBe(true);
  });

  it('reset() deletes the key', async () => {
    await store.hit(KEY, 60_000, 5);
    await store.reset(KEY);
    const entry = fakeRedisInstance._peek(KEY);
    expect(entry).toBeUndefined();
  });

  it('isolates different keys', async () => {
    await store.hit(KEY, 60_000, 1);
    await store.hit(KEY, 60_000, 1); // KEY is now blocked
    const other = await store.hit('other-redis-key', 60_000, 1);
    expect(other.allowed).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getActiveStore() factory tests
// ─────────────────────────────────────────────────────────────────────────────

describe('getActiveStore()', () => {
  const originalEnv = process.env.RATE_LIMIT_REDIS_URL;

  afterEach(() => {
    // Restore env and reset singleton after each test
    if (originalEnv === undefined) {
      delete process.env.RATE_LIMIT_REDIS_URL;
    } else {
      process.env.RATE_LIMIT_REDIS_URL = originalEnv;
    }
    _resetActiveStore();
  });

  it('returns MemoryRateLimitStore when RATE_LIMIT_REDIS_URL is not set', () => {
    delete process.env.RATE_LIMIT_REDIS_URL;
    const store = getActiveStore();
    expect(store.type).toBe('memory');
  });

  it('returns RedisRateLimitStore when RATE_LIMIT_REDIS_URL is set', () => {
    process.env.RATE_LIMIT_REDIS_URL = 'redis://localhost:6379';
    const store = getActiveStore();
    expect(store.type).toBe('redis');
  });

  it('returns the same singleton on repeated calls', () => {
    delete process.env.RATE_LIMIT_REDIS_URL;
    const s1 = getActiveStore();
    const s2 = getActiveStore();
    expect(s1).toBe(s2);
  });
});
