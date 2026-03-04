import { describe, it, expect, beforeEach } from 'vitest';
import { checkRateLimit, resetRateLimit } from '../rateLimit';

describe('Rate Limiter', () => {
  const identifier = 'test-user-rate-limit';

  beforeEach(async () => {
    await resetRateLimit(identifier);
  });

  describe('checkRateLimit()', () => {
    it('allows requests within the limit', async () => {
      const result = await checkRateLimit({
        identifier,
        maxRequests: 5,
        windowMs: 60_000,
      });
      expect(result.allowed).toBe(true);
    });

    it('tracks remaining count correctly', async () => {
      const config = { identifier, maxRequests: 3, windowMs: 60_000 };
      const first = await checkRateLimit(config);
      expect(first.remaining).toBe(2);
      const second = await checkRateLimit(config);
      expect(second.remaining).toBe(1);
      const third = await checkRateLimit(config);
      expect(third.remaining).toBe(0);
    });

    it('blocks requests when limit is exceeded', async () => {
      const config = { identifier, maxRequests: 2, windowMs: 60_000 };
      await checkRateLimit(config);
      await checkRateLimit(config);
      const blocked = await checkRateLimit(config);
      expect(blocked.allowed).toBe(false);
      expect(blocked.remaining).toBe(0);
    });

    it('sets a resetAt timestamp in the future', async () => {
      const before = Date.now();
      const result = await checkRateLimit({
        identifier,
        maxRequests: 5,
        windowMs: 60_000,
      });
      expect(result.resetAt).toBeGreaterThan(before);
    });

    it('resets window after expiry', async () => {
      const config = { identifier, maxRequests: 1, windowMs: 10 };
      await checkRateLimit(config);
      const blocked = await checkRateLimit(config);
      expect(blocked.allowed).toBe(false);

      // Wait for window to expire
      await new Promise((resolve) => setTimeout(resolve, 20));

      const fresh = await checkRateLimit(config);
      expect(fresh.allowed).toBe(true);
    });

    it('isolates counts between different identifiers', async () => {
      const otherId = 'other-user-rate-limit';
      await resetRateLimit(otherId);

      const config = { identifier, maxRequests: 1, windowMs: 60_000 };
      await checkRateLimit(config);
      await checkRateLimit(config); // blocked

      const otherResult = await checkRateLimit({ ...config, identifier: otherId });
      expect(otherResult.allowed).toBe(true);

      await resetRateLimit(otherId);
    });

    it('returns storeType in the result', async () => {
      const result = await checkRateLimit({ identifier, maxRequests: 5, windowMs: 60_000 });
      expect(['memory', 'redis']).toContain(result.storeType);
    });
  });

  describe('resetRateLimit()', () => {
    it('clears an existing rate limit record', async () => {
      const config = { identifier, maxRequests: 1, windowMs: 60_000 };
      await checkRateLimit(config);
      await checkRateLimit(config); // would be blocked

      await resetRateLimit(identifier);
      const result = await checkRateLimit(config);
      expect(result.allowed).toBe(true);
    });

    it('is a no-op when the identifier does not exist', async () => {
      await expect(resetRateLimit('nonexistent-id')).resolves.not.toThrow();
    });
  });
});
