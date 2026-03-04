/**
 * Tests for api/src/utils/authUtils.ts
 *
 * Tests cover validateToken, authResponse, and the MISCONFIGURED_REASONS set.
 * AUTH_SECRET is set via process.env before the module is loaded so that
 * isAuthSecretInsecure is false during the "happy path" tests.
 */
import { vi, describe, it, expect, beforeAll, afterAll } from 'vitest';
import jwt from 'jsonwebtoken';
import type { HttpRequest } from '@azure/functions';

const TEST_SECRET = 'test-auth-secret-value-at-least-32-chars-long';

// Set AUTH_SECRET BEFORE importing authUtils so the module-level startup
// code sees a valid secret and sets isAuthSecretInsecure = false.
const originalSecret = process.env.AUTH_SECRET;
process.env.AUTH_SECRET = TEST_SECRET;

// Now import after env is set
const {
  validateToken,
  authResponse,
  MISCONFIGURED_REASONS,
  isAuthSecretInsecure,
} = await import('../authUtils');

// ─── helpers ─────────────────────────────────────────────────────────────

function makeRequest(opts: {
  headers?: Record<string, string>;
  url?: string;
  method?: string;
}): HttpRequest {
  return {
    headers: { get: (name: string) => opts.headers?.[name.toLowerCase()] ?? null },
    url: opts.url ?? 'http://localhost/api/test',
    method: opts.method ?? 'GET',
    params: {},
    query: new URLSearchParams(),
    json: vi.fn().mockResolvedValue({}),
  } as unknown as HttpRequest;
}

function makeValidToken(uid: string): string {
  return jwt.sign({ uid }, TEST_SECRET, { algorithm: 'HS256', expiresIn: '7d' });
}

function makeExpiredToken(uid: string): string {
  return jwt.sign({ uid }, TEST_SECRET, { algorithm: 'HS256', expiresIn: '-1s' });
}

afterAll(() => {
  if (originalSecret === undefined) {
    delete process.env.AUTH_SECRET;
  } else {
    process.env.AUTH_SECRET = originalSecret;
  }
});

// ─── isAuthSecretInsecure ─────────────────────────────────────────────────

describe('isAuthSecretInsecure', () => {
  it('is false when AUTH_SECRET is a long valid secret', () => {
    expect(isAuthSecretInsecure).toBe(false);
  });
});

// ─── validateToken ────────────────────────────────────────────────────────

describe('validateToken()', () => {
  it('returns isAuthenticated:false with reason missing_token when no auth header', () => {
    const req = makeRequest({});
    const result = validateToken(req);
    expect(result.isAuthenticated).toBe(false);
    expect(result.reason).toBe('missing_token');
  });

  it('returns isAuthenticated:false with reason missing_token for empty Bearer', () => {
    const req = makeRequest({ headers: { authorization: 'Bearer ' } });
    const result = validateToken(req);
    expect(result.isAuthenticated).toBe(false);
    expect(result.reason).toBe('missing_token');
  });

  it('returns isAuthenticated:false with reason invalid_token for a garbage token', () => {
    const req = makeRequest({ headers: { authorization: 'Bearer notavalidtoken' } });
    const result = validateToken(req);
    expect(result.isAuthenticated).toBe(false);
    expect(result.reason).toBe('invalid_token');
  });

  it('returns isAuthenticated:false with reason token_expired for an expired token', () => {
    const token = makeExpiredToken('u_test');
    const req = makeRequest({ headers: { authorization: `Bearer ${token}` } });
    const result = validateToken(req);
    expect(result.isAuthenticated).toBe(false);
    expect(result.reason).toBe('token_expired');
  });

  it('returns isAuthenticated:false with reason invalid_auth_secret for wrong-secret token', () => {
    const wrongToken = jwt.sign({ uid: 'u_test' }, 'completely-different-secret-that-is-long-enough', {
      algorithm: 'HS256',
      expiresIn: '1h',
    });
    const req = makeRequest({ headers: { authorization: `Bearer ${wrongToken}` } });
    const result = validateToken(req);
    expect(result.isAuthenticated).toBe(false);
    expect(result.reason).toBe('invalid_auth_secret');
  });

  it('returns isAuthenticated:true and userId for a valid token', () => {
    const token = makeValidToken('u_12345');
    const req = makeRequest({ headers: { authorization: `Bearer ${token}` } });
    const result = validateToken(req);
    expect(result.isAuthenticated).toBe(true);
    expect(result.userId).toBe('u_12345');
  });

  it('returns isAuthenticated:false for token missing uid claim', () => {
    const noUidToken = jwt.sign({ email: 'test@test.com' }, TEST_SECRET, { algorithm: 'HS256', expiresIn: '1h' });
    const req = makeRequest({ headers: { authorization: `Bearer ${noUidToken}` } });
    const result = validateToken(req);
    expect(result.isAuthenticated).toBe(false);
    expect(result.reason).toBe('invalid_token');
  });

  it('accepts the SWA x-ms-client-principal header', () => {
    const principal = Buffer.from(JSON.stringify({ userId: 'swa_user_1' })).toString('base64');
    const req = makeRequest({ headers: { 'x-ms-client-principal': principal } });
    const result = validateToken(req);
    expect(result.isAuthenticated).toBe(true);
    expect(result.userId).toBe('swa_user_1');
  });

  it('includes a requestId in the result', () => {
    const req = makeRequest({});
    const result = validateToken(req);
    expect(typeof result.requestId).toBe('string');
  });

  it('uses the x-client-request-id header as requestId when valid UUID v4', () => {
    const requestId = '550e8400-e29b-41d4-a716-446655440000';
    const req = makeRequest({ headers: { 'x-client-request-id': requestId } });
    const result = validateToken(req);
    expect(result.requestId).toBe(requestId);
  });
});

// ─── authResponse ─────────────────────────────────────────────────────────

describe('authResponse()', () => {
  it('returns null when authentication succeeded', () => {
    expect(authResponse({ userId: 'u_1', isAuthenticated: true })).toBeNull();
  });

  it('returns 401 for missing_token failure', () => {
    const res = authResponse({ userId: null, isAuthenticated: false, reason: 'missing_token' });
    expect(res?.status).toBe(401);
  });

  it('returns 401 for invalid_token failure', () => {
    const res = authResponse({ userId: null, isAuthenticated: false, reason: 'invalid_token' });
    expect(res?.status).toBe(401);
  });

  it('returns 503 for missing_auth_secret (server misconfiguration)', () => {
    const res = authResponse({ userId: null, isAuthenticated: false, reason: 'missing_auth_secret' });
    expect(res?.status).toBe(503);
  });

  it('returns 503 for insecure_default_secret', () => {
    const res = authResponse({ userId: null, isAuthenticated: false, reason: 'insecure_default_secret' });
    expect(res?.status).toBe(503);
  });

  it('returns 503 for invalid_auth_secret (rotated secret misconfiguration)', () => {
    const res = authResponse({ userId: null, isAuthenticated: false, reason: 'invalid_auth_secret' });
    expect(res?.status).toBe(503);
  });

  it('returns 401 for token_expired failure', () => {
    const res = authResponse({ userId: null, isAuthenticated: false, reason: 'token_expired' });
    expect(res?.status).toBe(401);
  });
});

// ─── MISCONFIGURED_REASONS ────────────────────────────────────────────────

describe('MISCONFIGURED_REASONS', () => {
  it('contains all known server-side misconfiguration reasons', () => {
    expect(MISCONFIGURED_REASONS.has('missing_auth_secret')).toBe(true);
    expect(MISCONFIGURED_REASONS.has('insecure_default_secret')).toBe(true);
    expect(MISCONFIGURED_REASONS.has('invalid_auth_secret')).toBe(true);
  });

  it('does not contain client-side failure reasons', () => {
    expect(MISCONFIGURED_REASONS.has('missing_token')).toBe(false);
    expect(MISCONFIGURED_REASONS.has('invalid_token')).toBe(false);
    expect(MISCONFIGURED_REASONS.has('token_expired')).toBe(false);
  });
});
