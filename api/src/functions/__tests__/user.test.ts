/**
 * Tests for api/src/functions/user.ts
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
  body?: unknown;
  params?: Record<string, string>;
  headers?: Record<string, string>;
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
    url: opts.url ?? 'http://localhost/api/user/profile',
    query: sp,
  } as unknown as HttpRequest;
}

function makeContext(): InvocationContext {
  return { log: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() } as unknown as InvocationContext;
}

let getUserProfile: typeof import('../user').getUserProfile;
let updateUserProfile: typeof import('../user').updateUserProfile;
let deleteAccount: typeof import('../user').deleteAccount;
let searchUsers: typeof import('../user').searchUsers;

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

  const mod = await import('../user');
  getUserProfile = mod.getUserProfile;
  updateUserProfile = mod.updateUserProfile;
  deleteAccount = mod.deleteAccount;
  searchUsers = mod.searchUsers;
});

// ─── getUserProfile ───────────────────────────────────────────────────────

describe('getUserProfile()', () => {
  it('returns 401 when user is not authenticated', async () => {
    const { authResponse } = await import('../../utils/authUtils');
    vi.mocked(authResponse).mockReturnValueOnce({ status: 401, jsonBody: { error: 'Unauthorized' } });

    const res = await getUserProfile(makeRequest({}), makeContext());
    expect(res.status).toBe(401);
  });

  it('returns 404 when user is not found', async () => {
    mocks.mockQuery.mockResolvedValueOnce({ recordset: [] });

    const res = await getUserProfile(makeRequest({}), makeContext());
    expect(res.status).toBe(404);
    expect(res.jsonBody).toBeDefined();
  });

  it('returns 200 with user profile when user exists', async () => {
    const profile = {
      Id: 'u_test_123',
      Name: 'Test User',
      Email: 'test@example.com',
      Phone: '0700000000',
      AvatarUrl: null,
      IsVerified: false,
      VerificationStatus: 'NONE',
      Role: 'USER',
      CreatedAt: new Date().toISOString(),
    };
    mocks.mockQuery.mockResolvedValueOnce({ recordset: [profile] });

    const res = await getUserProfile(makeRequest({}), makeContext());
    expect(res.status).toBe(200);
    expect(res.jsonBody).toMatchObject({ Id: 'u_test_123', Name: 'Test User' });
  });

  it('returns 500 on database error', async () => {
    mocks.mockQuery.mockRejectedValueOnce(new Error('DB error'));

    const res = await getUserProfile(makeRequest({}), makeContext());
    expect(res.status).toBe(500);
    expect(res.jsonBody).toBeDefined();
  });
});

// ─── updateUserProfile ────────────────────────────────────────────────────

describe('updateUserProfile()', () => {
  it('returns 401 when user is not authenticated', async () => {
    const { authResponse } = await import('../../utils/authUtils');
    vi.mocked(authResponse).mockReturnValueOnce({ status: 401, jsonBody: { error: 'Unauthorized' } });

    const res = await updateUserProfile(makeRequest({ method: 'PUT', body: { name: 'New Name' } }), makeContext());
    expect(res.status).toBe(401);
  });

  it('returns 400 when no fields provided to update', async () => {
    const res = await updateUserProfile(makeRequest({ method: 'PUT', body: {} }), makeContext());
    expect(res.status).toBe(400);
    expect(res.jsonBody).toBeDefined();
  });

  it('returns 200 when profile is updated successfully', async () => {
    mocks.mockQuery.mockResolvedValueOnce({ rowsAffected: [1] });

    const res = await updateUserProfile(
      makeRequest({ method: 'PUT', body: { name: 'New Name' } }),
      makeContext()
    );
    expect(res.status).toBe(200);
    expect(res.jsonBody).toMatchObject({ success: true });
  });

  it('returns 200 when avatarUrl is updated to empty string', async () => {
    mocks.mockQuery.mockResolvedValueOnce({ rowsAffected: [1] });

    const res = await updateUserProfile(
      makeRequest({ method: 'PUT', body: { avatarUrl: '' } }),
      makeContext()
    );
    expect(res.status).toBe(200);
    expect(res.jsonBody).toMatchObject({ success: true });
  });

  it('returns 500 on database error', async () => {
    mocks.mockQuery.mockRejectedValueOnce(new Error('DB error'));

    const res = await updateUserProfile(
      makeRequest({ method: 'PUT', body: { name: 'New Name' } }),
      makeContext()
    );
    expect(res.status).toBe(500);
    expect(res.jsonBody).toBeDefined();
  });
});

// ─── deleteAccount ────────────────────────────────────────────────────────

describe('deleteAccount()', () => {
  it('returns 401 when user is not authenticated', async () => {
    const { authResponse } = await import('../../utils/authUtils');
    vi.mocked(authResponse).mockReturnValueOnce({ status: 401, jsonBody: { error: 'Unauthorized' } });

    const res = await deleteAccount(makeRequest({ method: 'DELETE' }), makeContext());
    expect(res.status).toBe(401);
  });

  it('returns 200 when account is soft-deleted', async () => {
    mocks.mockQuery.mockResolvedValue({ rowsAffected: [1] });

    const res = await deleteAccount(makeRequest({ method: 'DELETE' }), makeContext());
    expect(res.status).toBe(200);
    expect(res.jsonBody).toMatchObject({ success: true });
  });

  it('returns 500 on database error', async () => {
    mocks.mockQuery.mockRejectedValueOnce(new Error('DB error'));

    const res = await deleteAccount(makeRequest({ method: 'DELETE' }), makeContext());
    expect(res.status).toBe(500);
    expect(res.jsonBody).toBeDefined();
  });
});

// ─── searchUsers ──────────────────────────────────────────────────────────

describe('searchUsers()', () => {
  it('returns 401 when user is not authenticated', async () => {
    const { authResponse } = await import('../../utils/authUtils');
    vi.mocked(authResponse).mockReturnValueOnce({ status: 401, jsonBody: { error: 'Unauthorized' } });

    const res = await searchUsers(
      makeRequest({ url: 'http://localhost/api/users/search?q=test' }),
      makeContext()
    );
    expect(res.status).toBe(401);
  });

  it('returns 200 with empty array when query is too short', async () => {
    const res = await searchUsers(
      makeRequest({ url: 'http://localhost/api/users/search?q=a' }),
      makeContext()
    );
    expect(res.status).toBe(200);
    expect(Array.isArray(res.jsonBody)).toBe(true);
    expect((res.jsonBody as unknown[]).length).toBe(0);
  });

  it('returns 200 with empty array when no users match', async () => {
    mocks.mockQuery.mockResolvedValueOnce({ recordset: [] });

    const res = await searchUsers(
      makeRequest({ url: 'http://localhost/api/users/search?q=nonexistent' }),
      makeContext()
    );
    expect(res.status).toBe(200);
    expect(Array.isArray(res.jsonBody)).toBe(true);
  });

  it('returns 200 with matching users', async () => {
    const users = [{ Id: 'u_1', Name: 'Ahmad', Province: 'Kabul' }];
    mocks.mockQuery.mockResolvedValueOnce({ recordset: users });

    const res = await searchUsers(
      makeRequest({ url: 'http://localhost/api/users/search?q=Ahmad' }),
      makeContext()
    );
    expect(res.status).toBe(200);
    expect((res.jsonBody as unknown[]).length).toBe(1);
  });

  it('returns 500 on database error', async () => {
    mocks.mockQuery.mockRejectedValueOnce(new Error('DB error'));

    const res = await searchUsers(
      makeRequest({ url: 'http://localhost/api/users/search?q=test' }),
      makeContext()
    );
    expect(res.status).toBe(500);
    expect(res.jsonBody).toBeDefined();
  });
});
