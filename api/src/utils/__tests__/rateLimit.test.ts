import { describe, it, expect, beforeEach } from 'vitest';
import { checkRateLimit, resetRateLimit } from '../rateLimit';

describe('Rate Limiter', () => {
  const identifier = 'test-user-rate-limit';

  beforeEach(() => {
    resetRateLimit(identifier);
  });

  describe('checkRateLimit()', () => {
    it('allows requests within the limit', () => {
      const result = checkRateLimit({
        identifier,
        maxRequests: 5,
        windowMs: 60_000,
      });
      expect(result.allowed).toBe(true);
    });

    it('tracks remaining count correctly', () => {
      const config = { identifier, maxRequests: 3, windowMs: 60_000 };
      const first = checkRateLimit(config);
      expect(first.remaining).toBe(2);
      const second = checkRateLimit(config);
      expect(second.remaining).toBe(1);
      const third = checkRateLimit(config);
      expect(third.remaining).toBe(0);
    });

    it('blocks requests when limit is exceeded', () => {
      const config = { identifier, maxRequests: 2, windowMs: 60_000 };
      checkRateLimit(config);
      checkRateLimit(config);
      const blocked = checkRateLimit(config);
      expect(blocked.allowed).toBe(false);
      expect(blocked.remaining).toBe(0);
    });

    it('sets a resetAt timestamp in the future', () => {
      const before = Date.now();
      const result = checkRateLimit({
        identifier,
        maxRequests: 5,
        windowMs: 60_000,
      });
      expect(result.resetAt).toBeGreaterThan(before);
    });

    it('resets window after expiry', async () => {
      const config = { identifier, maxRequests: 1, windowMs: 10 };
      checkRateLimit(config);
      const blocked = checkRateLimit(config);
      expect(blocked.allowed).toBe(false);

      // Wait for window to expire
      await new Promise((resolve) => setTimeout(resolve, 20));

      const fresh = checkRateLimit(config);
      expect(fresh.allowed).toBe(true);
    });

    it('isolates counts between different identifiers', () => {
      const otherId = 'other-user-rate-limit';
      resetRateLimit(otherId);

      const config = { identifier, maxRequests: 1, windowMs: 60_000 };
      checkRateLimit(config);
      checkRateLimit(config); // blocked

      const otherResult = checkRateLimit({ ...config, identifier: otherId });
      expect(otherResult.allowed).toBe(true);

      resetRateLimit(otherId);
    });
  });

  describe('resetRateLimit()', () => {
    it('clears an existing rate limit record', () => {
      const config = { identifier, maxRequests: 1, windowMs: 60_000 };
      checkRateLimit(config);
      checkRateLimit(config); // would be blocked

      resetRateLimit(identifier);
      const result = checkRateLimit(config);
      expect(result.allowed).toBe(true);
    });

    it('is a no-op when the identifier does not exist', () => {
      expect(() => resetRateLimit('nonexistent-id')).not.toThrow();
    });
  });
});
