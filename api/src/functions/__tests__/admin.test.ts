/**
 * Tests for api/src/functions/admin.ts
 *
 * DB pool and auth utilities are mocked so no real network traffic is generated.
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { HttpRequest, InvocationContext } from '@azure/functions';

// ─── hoisted mock state ───────────────────────────────────────────────────
const mocks = vi.hoisted(() => {
  const mockQuery = vi.fn().mockResolvedValue({ recordset: [], rowsAffected: [0] });
  const mockInput = vi.fn().mockReturnThis();
  const mockPool = {
    request: vi.fn().mockImplementation(() => ({ input: mockInput, query: mockQuery })),
  };
  return { mockQuery, mockInput, mockPool };
});

vi.mock('../../db', () => ({
  getPool: vi.fn().mockResolvedValue(mocks.mockPool),
  resetPool: vi.fn(),
}));

// Default: authenticated as ADMIN user
vi.mock('../../utils/authUtils', () => ({
  isAuthSecretInsecure: false,
  validateToken: vi.fn().mockReturnValue({ userId: 'u_admin', isAuthenticated: true }),
  authResponse: vi.fn().mockReturnValue(null),
  TOKEN_EXPIRATION_MS: 604800000,
  MISCONFIGURED_REASONS: new Set(['missing_auth_secret', 'insecure_default_secret']),
  lastAuthFailureSample: null,
}));

// ─── helpers ─────────────────────────────────────────────────────────────

function makeRequest(opts: {
  body?: unknown;
  params?: Record<string, string>;
  headers?: Record<string, string>;
  method?: string;
}): HttpRequest {
  return {
    json: vi.fn().mockResolvedValue(opts.body ?? {}),
    headers: { get: (name: string) => opts.headers?.[name.toLowerCase()] ?? null },
    params: opts.params ?? {},
    method: opts.method ?? 'GET',
    url: 'http://localhost/api/admin',
    query: new URLSearchParams(),
  } as unknown as HttpRequest;
}

function makeContext(): InvocationContext {
  return { log: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() } as unknown as InvocationContext;
}

let adminGetPendingAds: typeof import('../admin').adminGetPendingAds;
let adminApproveAd: typeof import('../admin').adminApproveAd;
let adminRejectAd: typeof import('../admin').adminRejectAd;

beforeEach(async () => {
  vi.clearAllMocks();
  mocks.mockQuery.mockResolvedValue({ recordset: [], rowsAffected: [0] });
  mocks.mockPool.request.mockImplementation(() => ({
    input: mocks.mockInput,
    query: mocks.mockQuery,
  }));

  const mod = await import('../admin');
  adminGetPendingAds = mod.adminGetPendingAds;
  adminApproveAd = mod.adminApproveAd;
  adminRejectAd = mod.adminRejectAd;
});

// ─── admin authentication ─────────────────────────────────────────────────

describe('Admin authentication guard', () => {
  it('returns 401 when user is not authenticated', async () => {
    const { authResponse } = await import('../../utils/authUtils');
    vi.mocked(authResponse).mockReturnValueOnce({ status: 401, jsonBody: { error: 'Unauthorized' } });

    const res = await adminGetPendingAds(makeRequest({}), makeContext());
    expect(res.status).toBe(401);
  });

  it('returns 403 when authenticated user is not ADMIN', async () => {
    // validateToken returns a regular user, but DB check returns non-ADMIN role
    mocks.mockQuery.mockResolvedValueOnce({ recordset: [{ Role: 'USER' }] });

    const res = await adminGetPendingAds(makeRequest({}), makeContext());
    expect(res.status).toBe(403);
  });

  it('returns 403 when user record is not found in DB', async () => {
    mocks.mockQuery.mockResolvedValueOnce({ recordset: [] }); // user not found

    const res = await adminGetPendingAds(makeRequest({}), makeContext());
    expect(res.status).toBe(403);
  });
});

// ─── adminGetPendingAds ───────────────────────────────────────────────────

describe('adminGetPendingAds()', () => {
  it('returns 200 with pending ads list', async () => {
    const pendingAds = [{ Id: 'ad_1', Title: 'Test Ad', Status: 'PENDING' }];
    mocks.mockQuery.mockResolvedValueOnce({ recordset: [{ Role: 'ADMIN' }] }); // admin check
    mocks.mockQuery.mockResolvedValueOnce({ recordset: pendingAds });           // pending ads

    const res = await adminGetPendingAds(makeRequest({}), makeContext());
    expect(res.status).toBe(200);
    expect((res.jsonBody as unknown[]).length).toBe(1);
  });

  it('returns 200 with empty list when no pending ads', async () => {
    mocks.mockQuery.mockResolvedValueOnce({ recordset: [{ Role: 'ADMIN' }] });
    mocks.mockQuery.mockResolvedValueOnce({ recordset: [] });

    const res = await adminGetPendingAds(makeRequest({}), makeContext());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.jsonBody)).toBe(true);
    expect((res.jsonBody as unknown[]).length).toBe(0);
  });
});

// ─── adminApproveAd ───────────────────────────────────────────────────────

describe('adminApproveAd()', () => {
  it('returns 400 when id param is missing', async () => {
    mocks.mockQuery.mockResolvedValueOnce({ recordset: [{ Role: 'ADMIN' }] }); // admin check

    const res = await adminApproveAd(makeRequest({ params: {} }), makeContext());
    expect(res.status).toBe(400);
  });

  it('returns 404 when ad is not found', async () => {
    mocks.mockQuery.mockResolvedValueOnce({ recordset: [{ Role: 'ADMIN' }] }); // admin check
    mocks.mockQuery.mockResolvedValueOnce({ recordset: [], rowsAffected: [0] }); // UPDATE → not found

    const res = await adminApproveAd(makeRequest({ params: { id: 'nonexistent' } }), makeContext());
    expect(res.status).toBe(404);
  });

  it('returns 200 when ad is approved', async () => {
    mocks.mockQuery.mockResolvedValueOnce({ recordset: [{ Role: 'ADMIN' }] }); // admin check
    mocks.mockQuery.mockResolvedValueOnce({ recordset: [], rowsAffected: [1] }); // UPDATE success

    const res = await adminApproveAd(makeRequest({ params: { id: 'ad_1' } }), makeContext());
    expect(res.status).toBe(200);
    expect((res.jsonBody as Record<string, unknown>)?.success).toBe(true);
  });
});

// ─── adminRejectAd ────────────────────────────────────────────────────────

describe('adminRejectAd()', () => {
  it('returns 400 when id param is missing', async () => {
    mocks.mockQuery.mockResolvedValueOnce({ recordset: [{ Role: 'ADMIN' }] });

    const res = await adminRejectAd(makeRequest({ params: {} }), makeContext());
    expect(res.status).toBe(400);
  });

  it('returns 404 when ad is not found', async () => {
    mocks.mockQuery.mockResolvedValueOnce({ recordset: [{ Role: 'ADMIN' }] });
    mocks.mockQuery.mockResolvedValueOnce({ recordset: [], rowsAffected: [0] });

    const res = await adminRejectAd(makeRequest({ params: { id: 'nonexistent' } }), makeContext());
    expect(res.status).toBe(404);
  });

  it('returns 200 when ad is rejected', async () => {
    mocks.mockQuery.mockResolvedValueOnce({ recordset: [{ Role: 'ADMIN' }] });
    mocks.mockQuery.mockResolvedValueOnce({ recordset: [], rowsAffected: [1] });

    const res = await adminRejectAd(makeRequest({ params: { id: 'ad_1' } }), makeContext());
    expect(res.status).toBe(200);
    expect((res.jsonBody as Record<string, unknown>)?.success).toBe(true);
  });
});
