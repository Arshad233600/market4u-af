import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getAuthSecretStrict, getSecretFingerprint, getSecretDiagnostics } from '../authSecret';

const VALID_SECRET = 'a'.repeat(32); // exactly 32 chars — minimum length

describe('authSecret utilities', () => {
  const original = process.env.AUTH_SECRET;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.AUTH_SECRET;
    } else {
      process.env.AUTH_SECRET = original;
    }
  });

  describe('getAuthSecretStrict()', () => {
    it('returns the secret when AUTH_SECRET is set and >= 32 chars', () => {
      process.env.AUTH_SECRET = VALID_SECRET;
      expect(getAuthSecretStrict()).toBe(VALID_SECRET);
    });

    it('trims whitespace from AUTH_SECRET', () => {
      process.env.AUTH_SECRET = `  ${VALID_SECRET}  `;
      expect(getAuthSecretStrict()).toBe(VALID_SECRET);
    });

    it('throws when AUTH_SECRET is not set', () => {
      delete process.env.AUTH_SECRET;
      expect(() => getAuthSecretStrict()).toThrow(/not set/i);
    });

    it('throws when AUTH_SECRET is shorter than 32 chars', () => {
      process.env.AUTH_SECRET = 'short-secret';
      expect(() => getAuthSecretStrict()).toThrow(/too short/i);
    });

    it('throws when AUTH_SECRET is empty string', () => {
      process.env.AUTH_SECRET = '';
      expect(() => getAuthSecretStrict()).toThrow();
    });

    it('accepts a secret of exactly 32 chars', () => {
      process.env.AUTH_SECRET = VALID_SECRET;
      expect(() => getAuthSecretStrict()).not.toThrow();
    });

    it('accepts a secret longer than 32 chars', () => {
      process.env.AUTH_SECRET = 'x'.repeat(64);
      expect(() => getAuthSecretStrict()).not.toThrow();
    });
  });

  describe('getSecretFingerprint()', () => {
    it('returns a 12-character hex string', () => {
      const fp = getSecretFingerprint(VALID_SECRET);
      expect(fp).toHaveLength(12);
      expect(fp).toMatch(/^[0-9a-f]{12}$/);
    });

    it('is deterministic for the same input', () => {
      expect(getSecretFingerprint(VALID_SECRET)).toBe(
        getSecretFingerprint(VALID_SECRET)
      );
    });

    it('produces different fingerprints for different secrets', () => {
      const fp1 = getSecretFingerprint('a'.repeat(32));
      const fp2 = getSecretFingerprint('b'.repeat(32));
      expect(fp1).not.toBe(fp2);
    });
  });

  describe('getSecretDiagnostics()', () => {
    it('returns secretLength and secretFingerprint', () => {
      process.env.AUTH_SECRET = VALID_SECRET;
      const diag = getSecretDiagnostics();
      expect(diag.secretLength).toBe(VALID_SECRET.length);
      expect(diag.secretFingerprint).toMatch(/^[0-9a-f]{12}$/);
    });

    it('throws when AUTH_SECRET is not set', () => {
      delete process.env.AUTH_SECRET;
      expect(() => getSecretDiagnostics()).toThrow();
    });
  });
});
