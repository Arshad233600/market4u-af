/**
 * Tests for api/src/functions/dashboard.ts
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

vi.mock('../../utils/authUtils', () => ({
  isAuthSecretInsecure: false,
  validateToken: vi.fn().mockReturnValue({ userId: 'u_test_123', isAuthenticated: true }),
  authResponse: vi.fn().mockReturnValue(null),
  TOKEN_EXPIRATION_MS: 604800000,
  MISCONFIGURED_REASONS: new Set(['missing_auth_secret', 'insecure_default_secret']),
  lastAuthFailureSample: null,
}));

vi.mock('../../utils/responses', () => ({
  serverError: vi.fn().mockImplementation((err?: unknown) => ({
    status: 500,
    jsonBody: { error: err instanceof Error ? err.message : 'Internal server error' },
  })),
}));

// ─── helpers ─────────────────────────────────────────────────────────────

function makeRequest(opts: {
  headers?: Record<string, string>;
  method?: string;
}): HttpRequest {
  return {
    json: vi.fn().mockResolvedValue({}),
    headers: { get: (name: string) => opts.headers?.[name.toLowerCase()] ?? null },
    params: {},
    method: opts.method ?? 'GET',
    url: 'http://localhost/api/dashboard/stats',
    query: new URLSearchParams(),
  } as unknown as HttpRequest;
}

function makeContext(): InvocationContext {
  return { log: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() } as unknown as InvocationContext;
}

let getDashboardStats: typeof import('../dashboard').getDashboardStats;
let getRecentActivities: typeof import('../dashboard').getRecentActivities;

beforeEach(async () => {
  mocks.mockQuery.mockReset();
  mocks.mockQuery.mockResolvedValue({ recordset: [], rowsAffected: [0] });
  mocks.mockPool.request.mockImplementation(() => ({
    input: mocks.mockInput,
    query: mocks.mockQuery,
  }));

  const authUtils = await import('../../utils/authUtils');
  vi.mocked(authUtils.validateToken).mockReturnValue({ userId: 'u_test_123', isAuthenticated: true });
  vi.mocked(authUtils.authResponse).mockReturnValue(null);

  const mod = await import('../dashboard');
  getDashboardStats = mod.getDashboardStats;
  getRecentActivities = mod.getRecentActivities;
});

// ─── getDashboardStats ────────────────────────────────────────────────────

describe('getDashboardStats()', () => {
  it('returns 401 when user is not authenticated', async () => {
    const { authResponse } = await import('../../utils/authUtils');
    vi.mocked(authResponse).mockReturnValueOnce({ status: 401, jsonBody: { error: 'Unauthorized' } });

    const res = await getDashboardStats(makeRequest({}), makeContext());
    expect(res.status).toBe(401);
  });

  it('returns 200 with stats when user has data', async () => {
    // ads result
    mocks.mockQuery.mockResolvedValueOnce({ recordset: [{ totalAds: 5, activeAds: 3, totalViews: 100 }] });
    // messages result
    mocks.mockQuery.mockResolvedValueOnce({ recordset: [{ unreadMessages: 2 }] });
    // wallet result
    mocks.mockQuery.mockResolvedValueOnce({ recordset: [{ walletBalance: 500 }] });

    const res = await getDashboardStats(makeRequest({}), makeContext());
    expect(res.status).toBe(200);
    const body = res.jsonBody as {
      totalAds: number;
      activeAds: number;
      totalViews: number;
      unreadMessages: number;
      walletBalance: number;
    };
    expect(body.totalAds).toBe(5);
    expect(body.activeAds).toBe(3);
    expect(body.totalViews).toBe(100);
    expect(body.unreadMessages).toBe(2);
    expect(body.walletBalance).toBe(500);
  });

  it('returns 200 with zero values when user has no data', async () => {
    mocks.mockQuery.mockResolvedValueOnce({ recordset: [{ totalAds: 0, activeAds: 0, totalViews: 0 }] });
    mocks.mockQuery.mockResolvedValueOnce({ recordset: [{ unreadMessages: 0 }] });
    mocks.mockQuery.mockResolvedValueOnce({ recordset: [{ walletBalance: 0 }] });

    const res = await getDashboardStats(makeRequest({}), makeContext());
    expect(res.status).toBe(200);
    const body = res.jsonBody as { totalAds: number; walletBalance: number };
    expect(body.totalAds).toBe(0);
    expect(body.walletBalance).toBe(0);
  });

  it('returns 500 on database error', async () => {
    mocks.mockQuery.mockRejectedValueOnce(new Error('DB error'));

    const res = await getDashboardStats(makeRequest({}), makeContext());
    expect(res.status).toBe(500);
  });
});

// ─── getRecentActivities ──────────────────────────────────────────────────

describe('getRecentActivities()', () => {
  it('returns 401 when user is not authenticated', async () => {
    const { authResponse } = await import('../../utils/authUtils');
    vi.mocked(authResponse).mockReturnValueOnce({ status: 401, jsonBody: { error: 'Unauthorized' } });

    const res = await getRecentActivities(makeRequest({}), makeContext());
    expect(res.status).toBe(401);
  });

  it('returns 200 with empty activities when user has no data', async () => {
    mocks.mockQuery.mockResolvedValueOnce({ recordset: [] }); // ads
    mocks.mockQuery.mockResolvedValueOnce({ recordset: [] }); // transactions
    mocks.mockQuery.mockResolvedValueOnce({ recordset: [] }); // messages

    const res = await getRecentActivities(makeRequest({}), makeContext());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.jsonBody)).toBe(true);
    expect((res.jsonBody as unknown[]).length).toBe(0);
  });

  it('returns 200 with merged and sorted activities', async () => {
    const now = new Date();
    const past = new Date(now.getTime() - 5000);
    mocks.mockQuery.mockResolvedValueOnce({
      recordset: [{ Id: 'ad_1', Title: 'Phone', CreatedAt: now.toISOString() }],
    }); // ads
    mocks.mockQuery.mockResolvedValueOnce({
      recordset: [{ Id: 'tx_1', Amount: 100, Description: 'شارژ', CreatedAt: past.toISOString() }],
    }); // transactions
    mocks.mockQuery.mockResolvedValueOnce({ recordset: [] }); // messages

    const res = await getRecentActivities(makeRequest({}), makeContext());
    expect(res.status).toBe(200);
    const activities = res.jsonBody as Array<{ type: string; id: string }>;
    expect(activities.length).toBe(2);
    // Most recent first
    expect(activities[0].type).toBe('AD');
    expect(activities[1].type).toBe('WALLET');
  });

  it('returns 500 on database error', async () => {
    mocks.mockQuery.mockRejectedValueOnce(new Error('DB error'));

    const res = await getRecentActivities(makeRequest({}), makeContext());
    expect(res.status).toBe(500);
  });
});
