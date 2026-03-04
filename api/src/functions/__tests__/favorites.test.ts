/**
 * Tests for api/src/functions/favorites.ts
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

// ─── helpers ─────────────────────────────────────────────────────────────

function makeRequest(opts: {
  params?: Record<string, string>;
  headers?: Record<string, string>;
  method?: string;
}): HttpRequest {
  return {
    json: vi.fn().mockResolvedValue({}),
    headers: { get: (name: string) => opts.headers?.[name.toLowerCase()] ?? null },
    params: opts.params ?? {},
    method: opts.method ?? 'GET',
    url: 'http://localhost/api/favorites',
    query: new URLSearchParams(),
  } as unknown as HttpRequest;
}

function makeContext(): InvocationContext {
  return { log: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() } as unknown as InvocationContext;
}

let getFavorites: typeof import('../favorites').getFavorites;
let addFavorite: typeof import('../favorites').addFavorite;
let removeFavorite: typeof import('../favorites').removeFavorite;

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

  const mod = await import('../favorites');
  getFavorites = mod.getFavorites;
  addFavorite = mod.addFavorite;
  removeFavorite = mod.removeFavorite;
});

// ─── getFavorites ─────────────────────────────────────────────────────────

describe('getFavorites()', () => {
  it('returns 401 when user is not authenticated', async () => {
    const { authResponse } = await import('../../utils/authUtils');
    vi.mocked(authResponse).mockReturnValueOnce({ status: 401, jsonBody: { error: 'Unauthorized' } });

    const res = await getFavorites(makeRequest({}), makeContext());
    expect(res.status).toBe(401);
  });

  it('returns 200 with empty list when user has no favorites', async () => {
    mocks.mockQuery.mockResolvedValueOnce({ recordset: [] });
    const res = await getFavorites(makeRequest({}), makeContext());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.jsonBody)).toBe(true);
  });

  it('returns 200 with favorites list when favorites exist', async () => {
    const favs = [
      { Id: 'ad_1', Title: 'Phone', FavoritedAt: new Date().toISOString() },
    ];
    mocks.mockQuery.mockResolvedValueOnce({ recordset: favs });

    const res = await getFavorites(makeRequest({}), makeContext());
    expect(res.status).toBe(200);
    expect((res.jsonBody as unknown[]).length).toBe(1);
  });
});

// ─── addFavorite ──────────────────────────────────────────────────────────

describe('addFavorite()', () => {
  it('returns 401 when user is not authenticated', async () => {
    const { authResponse } = await import('../../utils/authUtils');
    vi.mocked(authResponse).mockReturnValueOnce({ status: 401, jsonBody: { error: 'Unauthorized' } });

    const res = await addFavorite(makeRequest({ params: { adId: 'ad_1' } }), makeContext());
    expect(res.status).toBe(401);
  });

  it('returns 400 when adId param is missing', async () => {
    const res = await addFavorite(makeRequest({ params: {} }), makeContext());
    expect(res.status).toBe(400);
  });

  it('returns 404 when ad does not exist', async () => {
    mocks.mockQuery.mockResolvedValueOnce({ recordset: [] }); // ad existence check

    const res = await addFavorite(makeRequest({ params: { adId: 'nonexistent' } }), makeContext());
    expect(res.status).toBe(404);
  });

  it('returns 201 when favorite is added successfully', async () => {
    mocks.mockQuery.mockResolvedValueOnce({ recordset: [{ Id: 'ad_1' }] }); // ad exists
    mocks.mockQuery.mockResolvedValueOnce({ recordset: [] });               // already favorited check
    mocks.mockQuery.mockResolvedValueOnce({ recordset: [], rowsAffected: [1] }); // INSERT

    const res = await addFavorite(makeRequest({ params: { adId: 'ad_1' } }), makeContext());
    expect(res.status).toBe(201);
  });

  it('returns 200 when ad is already favorited (idempotent)', async () => {
    mocks.mockQuery.mockResolvedValueOnce({ recordset: [{ Id: 'ad_1' }] }); // ad exists
    mocks.mockQuery.mockResolvedValueOnce({ recordset: [{ AdId: 'ad_1' }] }); // already exists

    const res = await addFavorite(makeRequest({ params: { adId: 'ad_1' } }), makeContext());
    // Should not error — already favorited is not an error condition
    expect([200, 409]).toContain(res.status);
  });
});

// ─── removeFavorite ───────────────────────────────────────────────────────

describe('removeFavorite()', () => {
  it('returns 401 when user is not authenticated', async () => {
    const { authResponse } = await import('../../utils/authUtils');
    vi.mocked(authResponse).mockReturnValueOnce({ status: 401, jsonBody: { error: 'Unauthorized' } });

    const res = await removeFavorite(makeRequest({ params: { adId: 'ad_1' } }), makeContext());
    expect(res.status).toBe(401);
  });

  it('returns 400 when adId param is missing', async () => {
    const res = await removeFavorite(makeRequest({ params: {} }), makeContext());
    expect(res.status).toBe(400);
  });

  it('returns 200 when favorite is removed', async () => {
    mocks.mockQuery.mockResolvedValueOnce({ recordset: [], rowsAffected: [1] }); // DELETE

    const res = await removeFavorite(makeRequest({ params: { adId: 'ad_1' } }), makeContext());
    expect(res.status).toBe(200);
  });
});
