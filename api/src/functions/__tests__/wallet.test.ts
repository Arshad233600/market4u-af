/**
 * Tests for api/src/functions/wallet.ts
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
  body?: unknown;
  headers?: Record<string, string>;
  method?: string;
}): HttpRequest {
  return {
    json: vi.fn().mockResolvedValue(opts.body ?? {}),
    headers: { get: (name: string) => opts.headers?.[name.toLowerCase()] ?? null },
    params: {},
    method: opts.method ?? 'GET',
    url: 'http://localhost/api/wallet/transactions',
    query: new URLSearchParams(),
  } as unknown as HttpRequest;
}

function makeContext(): InvocationContext {
  return { log: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() } as unknown as InvocationContext;
}

let getWalletTransactions: typeof import('../wallet').getWalletTransactions;
let topUpWallet: typeof import('../wallet').topUpWallet;

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

  const mod = await import('../wallet');
  getWalletTransactions = mod.getWalletTransactions;
  topUpWallet = mod.topUpWallet;
});

// ─── getWalletTransactions ────────────────────────────────────────────────

describe('getWalletTransactions()', () => {
  it('returns 401 when user is not authenticated', async () => {
    const { authResponse } = await import('../../utils/authUtils');
    vi.mocked(authResponse).mockReturnValueOnce({ status: 401, jsonBody: { error: 'Unauthorized' } });

    const res = await getWalletTransactions(makeRequest({}), makeContext());
    expect(res.status).toBe(401);
  });

  it('returns 200 with empty list when user has no transactions', async () => {
    mocks.mockQuery.mockResolvedValueOnce({ recordset: [] });

    const res = await getWalletTransactions(makeRequest({}), makeContext());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.jsonBody)).toBe(true);
    expect((res.jsonBody as unknown[]).length).toBe(0);
  });

  it('returns 200 with transaction list', async () => {
    const txs = [
      { Id: 'tx_1', Amount: 500, Type: 'DEPOSIT', Status: 'SUCCESS', Description: 'شارژ', CreatedAt: new Date().toISOString() },
    ];
    mocks.mockQuery.mockResolvedValueOnce({ recordset: txs });

    const res = await getWalletTransactions(makeRequest({}), makeContext());
    expect(res.status).toBe(200);
    expect((res.jsonBody as unknown[]).length).toBe(1);
  });

  it('returns 500 on database error', async () => {
    mocks.mockQuery.mockRejectedValueOnce(new Error('DB error'));

    const res = await getWalletTransactions(makeRequest({}), makeContext());
    expect(res.status).toBe(500);
  });
});

// ─── topUpWallet ──────────────────────────────────────────────────────────

describe('topUpWallet()', () => {
  it('returns 401 when user is not authenticated', async () => {
    const { authResponse } = await import('../../utils/authUtils');
    vi.mocked(authResponse).mockReturnValueOnce({ status: 401, jsonBody: { error: 'Unauthorized' } });

    const res = await topUpWallet(makeRequest({ method: 'POST', body: { amount: 100 } }), makeContext());
    expect(res.status).toBe(401);
  });

  it('returns 400 when amount is missing', async () => {
    const res = await topUpWallet(makeRequest({ method: 'POST', body: {} }), makeContext());
    expect(res.status).toBe(400);
  });

  it('returns 400 when amount is zero', async () => {
    const res = await topUpWallet(makeRequest({ method: 'POST', body: { amount: 0 } }), makeContext());
    expect(res.status).toBe(400);
  });

  it('returns 400 when amount is negative', async () => {
    const res = await topUpWallet(makeRequest({ method: 'POST', body: { amount: -100 } }), makeContext());
    expect(res.status).toBe(400);
  });

  it('returns 400 when amount is a string', async () => {
    const res = await topUpWallet(makeRequest({ method: 'POST', body: { amount: 'one hundred' } }), makeContext());
    expect(res.status).toBe(400);
  });

  it('returns 201 when wallet is topped up successfully', async () => {
    mocks.mockQuery.mockResolvedValueOnce({ rowsAffected: [1] }); // INSERT

    const res = await topUpWallet(
      makeRequest({ method: 'POST', body: { amount: 500, description: 'شارژ کیف پول' } }),
      makeContext()
    );
    expect(res.status).toBe(201);
    expect((res.jsonBody as { success: boolean }).success).toBe(true);
  });

  it('returns 500 on database error', async () => {
    mocks.mockQuery.mockRejectedValueOnce(new Error('DB error'));

    const res = await topUpWallet(
      makeRequest({ method: 'POST', body: { amount: 100 } }),
      makeContext()
    );
    expect(res.status).toBe(500);
  });
});
