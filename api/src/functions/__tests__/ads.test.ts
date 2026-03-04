/**
 * Tests for api/src/functions/ads.ts
 *
 * DB pool, auth utilities, mssql (for transaction support), and schema checks
 * are all mocked so no real network traffic is generated.
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { HttpRequest, InvocationContext } from '@azure/functions';

// ─── hoisted mock state ───────────────────────────────────────────────────
const mocks = vi.hoisted(() => {
  const mockQuery = vi.fn().mockResolvedValue({ recordset: [], rowsAffected: [0] });
  const mockInput = vi.fn().mockReturnThis();
  const mockTransaction = {
    begin: vi.fn().mockResolvedValue(undefined),
    commit: vi.fn().mockResolvedValue(undefined),
    rollback: vi.fn().mockResolvedValue(undefined),
  };
  const mockPool = {
    request: vi.fn().mockImplementation(() => ({ input: mockInput, query: mockQuery })),
  };
  return { mockQuery, mockInput, mockTransaction, mockPool };
});

vi.mock('applicationinsights', () => ({
  default: { defaultClient: null, setup: vi.fn().mockReturnThis(), start: vi.fn() },
  defaultClient: null,
}));

vi.mock('../../db', () => ({
  getPool: vi.fn().mockResolvedValue(mocks.mockPool),
  resetPool: vi.fn(),
}));

vi.mock('../../utils/authUtils', () => ({
  isAuthSecretInsecure: false,
  validateToken: vi.fn().mockReturnValue({ userId: 'u_test_123', isAuthenticated: true }),
  authResponse: vi.fn().mockReturnValue(null),
  TOKEN_EXPIRATION_MS: 604800000,
  TOKEN_EXPIRATION_SECONDS: 604800,
  MISCONFIGURED_REASONS: new Set(['missing_auth_secret', 'insecure_default_secret']),
  lastAuthFailureSample: null,
}));

// Mock mssql so that Transaction/Request work without a real connection pool.
// ConnectionError is also included because classifyPostAdError checks `instanceof sql.ConnectionError`.
vi.mock('mssql', () => ({
  NVarChar: 'NVarChar',
  Int: 'Int',
  Decimal: vi.fn().mockReturnValue('Decimal'),
  Float: 'Float',
  Bit: 'Bit',
  DateTime: 'DateTime',
  ConnectionError: class ConnectionError extends Error {},
  RequestError: class RequestError extends Error {},
  Transaction: vi.fn().mockImplementation(function () { return mocks.mockTransaction; }),
  Request: vi.fn().mockImplementation(function () {
    return { input: vi.fn().mockReturnThis(), query: mocks.mockQuery };
  }),
}));

vi.mock('../../utils/schemaCheck', () => ({
  checkAdsSchema: vi.fn().mockResolvedValue({ schemaOk: true, missingColumns: [] }),
  applyMissingAdsColumns: vi.fn().mockResolvedValue([]),
}));

// ─── helpers ─────────────────────────────────────────────────────────────

function makeRequest(opts: {
  body?: unknown;
  headers?: Record<string, string>;
  params?: Record<string, string>;
  method?: string;
  url?: string;
  query?: Record<string, string>;
}): HttpRequest {
  const sp = new URLSearchParams(opts.query ?? {});
  return {
    json: vi.fn().mockResolvedValue(opts.body ?? {}),
    headers: { get: (name: string) => opts.headers?.[name.toLowerCase()] ?? null },
    params: opts.params ?? {},
    method: opts.method ?? 'GET',
    url: opts.url ?? 'http://localhost/api/ads',
    query: sp,
  } as unknown as HttpRequest;
}

function makeContext(): InvocationContext {
  return { log: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() } as unknown as InvocationContext;
}

let getAds: typeof import('../ads').getAds;
let getAdDetail: typeof import('../ads').getAdDetail;
let getMyAds: typeof import('../ads').getMyAds;
let postAd: typeof import('../ads').postAd;
let updateAd: typeof import('../ads').updateAd;
let deleteAd: typeof import('../ads').deleteAd;

beforeEach(async () => {
  // mockReset clears call history AND the once-queue so mock responses don't
  // leak between tests.
  mocks.mockQuery.mockReset();
  mocks.mockQuery.mockResolvedValue({ recordset: [], rowsAffected: [0] });
  mocks.mockTransaction.begin.mockReset();
  mocks.mockTransaction.begin.mockResolvedValue(undefined);
  mocks.mockTransaction.commit.mockReset();
  mocks.mockTransaction.commit.mockResolvedValue(undefined);
  mocks.mockTransaction.rollback.mockReset();
  mocks.mockTransaction.rollback.mockResolvedValue(undefined);
  mocks.mockPool.request.mockImplementation(() => ({
    input: mocks.mockInput,
    query: mocks.mockQuery,
  }));

  // Re-set authUtils mocks after reset
  const authUtils = await import('../../utils/authUtils');
  vi.mocked(authUtils.validateToken).mockReturnValue({ userId: 'u_test_123', isAuthenticated: true });
  vi.mocked(authUtils.authResponse).mockReturnValue(null);

  const mod = await import('../ads');
  getAds = mod.getAds;
  getAdDetail = mod.getAdDetail;
  getMyAds = mod.getMyAds;
  postAd = mod.postAd;
  updateAd = mod.updateAd;
  deleteAd = mod.deleteAd;
});

// ─── getAds ───────────────────────────────────────────────────────────────

describe('getAds()', () => {
  it('returns 200 with an empty array when no ads exist', async () => {
    mocks.mockQuery.mockResolvedValueOnce({ recordset: [] });
    const req = makeRequest({});
    const res = await getAds(req, makeContext());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.jsonBody)).toBe(true);
  });

  it('returns 200 with filtered ads by category', async () => {
    const sampleAds = [{ Id: 'ad_1', Title: 'Phone', Category: 'electronics' }];
    mocks.mockQuery.mockResolvedValueOnce({ recordset: sampleAds });

    const req = makeRequest({ query: { category: 'electronics' } });
    const res = await getAds(req, makeContext());
    expect(res.status).toBe(200);
    expect((res.jsonBody as unknown[]).length).toBe(1);
  });

  it('returns 200 when searching by keyword', async () => {
    const sampleAds = [{ Id: 'ad_2', Title: 'Dell Laptop', Category: 'electronics' }];
    mocks.mockQuery.mockResolvedValueOnce({ recordset: sampleAds });

    const req = makeRequest({ query: { q: 'laptop' } });
    const res = await getAds(req, makeContext());
    expect(res.status).toBe(200);
  });

  it('returns 200 when filtering by price range', async () => {
    mocks.mockQuery.mockResolvedValueOnce({ recordset: [] });
    const req = makeRequest({ query: { minPrice: '100', maxPrice: '500' } });
    const res = await getAds(req, makeContext());
    expect(res.status).toBe(200);
  });

  it('returns 500 on database error', async () => {
    mocks.mockQuery.mockRejectedValueOnce(new Error('DB connection refused'));
    const req = makeRequest({});
    const res = await getAds(req, makeContext());
    expect(res.status).toBe(500);
  });
});

// ─── getAdDetail ──────────────────────────────────────────────────────────

describe('getAdDetail()', () => {
  it('returns 400 when id param is missing', async () => {
    const req = makeRequest({ params: {} });
    const res = await getAdDetail(req, makeContext());
    expect(res.status).toBe(400);
  });

  it('returns 404 when ad does not exist', async () => {
    // UPDATE views, then SELECT ad
    mocks.mockQuery.mockResolvedValueOnce({ recordset: [], rowsAffected: [0] }); // UPDATE views
    mocks.mockQuery.mockResolvedValueOnce({ recordset: [] }); // SELECT ad → not found
    const req = makeRequest({ params: { id: 'nonexistent' } });
    const res = await getAdDetail(req, makeContext());
    expect(res.status).toBe(404);
  });

  it('returns 200 with ad data when found', async () => {
    const ad = { Id: 'ad_1', Title: 'Test Ad', Price: 1000, MainImageUrl: '' };
    mocks.mockQuery.mockResolvedValueOnce({ recordset: [], rowsAffected: [0] }); // UPDATE views
    mocks.mockQuery.mockResolvedValueOnce({ recordset: [ad] });                  // SELECT ad
    mocks.mockQuery.mockResolvedValueOnce({ recordset: [] });                    // SELECT images

    const req = makeRequest({ params: { id: 'ad_1' } });
    const res = await getAdDetail(req, makeContext());
    expect(res.status).toBe(200);
    expect((res.jsonBody as Record<string, unknown>)?.Id).toBe('ad_1');
  });
});

// ─── getMyAds ─────────────────────────────────────────────────────────────

describe('getMyAds()', () => {
  it('returns 401 when user is not authenticated', async () => {
    const { authResponse } = await import('../../utils/authUtils');
    vi.mocked(authResponse).mockReturnValueOnce({ status: 401, jsonBody: { error: 'Unauthorized' } });

    const req = makeRequest({ headers: {} });
    const res = await getMyAds(req, makeContext());
    expect(res.status).toBe(401);
  });

  it('returns 200 with user ads when authenticated', async () => {
    const myAds = [{ Id: 'ad_1', Title: 'My Ad', UserId: 'u_test_123' }];
    mocks.mockQuery.mockResolvedValueOnce({ recordset: myAds });

    const req = makeRequest({ headers: { authorization: 'Bearer valid-token' } });
    const res = await getMyAds(req, makeContext());
    expect(res.status).toBe(200);
  });
});

// ─── postAd ───────────────────────────────────────────────────────────────

describe('postAd()', () => {
  it('returns 401 when user is not authenticated', async () => {
    const { authResponse } = await import('../../utils/authUtils');
    vi.mocked(authResponse).mockReturnValueOnce({ status: 401, jsonBody: { error: 'Unauthorized' } });

    const req = makeRequest({ body: { title: 'Test', price: 100 } });
    const res = await postAd(req, makeContext());
    expect(res.status).toBe(401);
  });

  it('returns 400 when title is missing', async () => {
    const req = makeRequest({ body: { price: 100, category: 'electronics', location: 'Kabul' } });
    const res = await postAd(req, makeContext());
    expect(res.status).toBe(400);
  });

  it('returns 201 when ad is created successfully', async () => {
    mocks.mockQuery.mockResolvedValue({ recordset: [], rowsAffected: [1] });

    const req = makeRequest({
      body: {
        title: 'iPhone 15',
        price: 50000,
        category: 'electronics',
        location: 'Kabul',
        description: 'Good condition',
      },
    });
    const res = await postAd(req, makeContext());
    expect(res.status).toBe(201);
  });
});

// ─── updateAd ─────────────────────────────────────────────────────────────

describe('updateAd()', () => {
  it('returns 401 when user is not authenticated', async () => {
    const { authResponse } = await import('../../utils/authUtils');
    vi.mocked(authResponse).mockReturnValueOnce({ status: 401, jsonBody: { error: 'Unauthorized' } });

    const req = makeRequest({ params: { id: 'ad_1' }, body: { title: 'Updated' } });
    const res = await updateAd(req, makeContext());
    expect(res.status).toBe(401);
  });

  it('returns 400 when id param is missing', async () => {
    const req = makeRequest({ params: {}, body: { title: 'Updated' } });
    const res = await updateAd(req, makeContext());
    expect(res.status).toBe(400);
  });
});

// ─── deleteAd ─────────────────────────────────────────────────────────────

describe('deleteAd()', () => {
  it('returns 401 when user is not authenticated', async () => {
    const { authResponse } = await import('../../utils/authUtils');
    vi.mocked(authResponse).mockReturnValueOnce({ status: 401, jsonBody: { error: 'Unauthorized' } });

    const req = makeRequest({ params: { id: 'ad_1' } });
    const res = await deleteAd(req, makeContext());
    expect(res.status).toBe(401);
  });

  it('returns 403 when ad does not belong to user', async () => {
    // UPDATE returns 0 rowsAffected (no row matched), so code returns 403
    mocks.mockQuery.mockResolvedValueOnce({ recordset: [], rowsAffected: [0] });

    const req = makeRequest({ params: { id: 'ad_other' } });
    const res = await deleteAd(req, makeContext());
    expect(res.status).toBe(403);
  });

  it('returns 200 when soft-delete succeeds', async () => {
    mocks.mockQuery.mockResolvedValueOnce({ recordset: [], rowsAffected: [1] });

    const req = makeRequest({ params: { id: 'ad_1' } });
    const res = await deleteAd(req, makeContext());
    expect(res.status).toBe(200);
  });
});
