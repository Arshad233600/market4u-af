/**
 * Tests for api/src/functions/notifications.ts
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

vi.mock('../../utils/tableSchemaCheck', () => ({
  ensureNotificationsTable: vi.fn().mockResolvedValue(undefined),
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
    catch: vi.fn().mockImplementation(function (this: Promise<unknown>) { return this; }),
    headers: { get: (name: string) => opts.headers?.[name.toLowerCase()] ?? null },
    params: {},
    method: opts.method ?? 'GET',
    url: 'http://localhost/api/notifications',
    query: new URLSearchParams(),
  } as unknown as HttpRequest;
}

function makeContext(): InvocationContext {
  return { log: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() } as unknown as InvocationContext;
}

let getNotifications: typeof import('../notifications').getNotifications;
let markNotificationsRead: typeof import('../notifications').markNotificationsRead;

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

  const mod = await import('../notifications');
  getNotifications = mod.getNotifications;
  markNotificationsRead = mod.markNotificationsRead;
});

// ─── getNotifications ─────────────────────────────────────────────────────

describe('getNotifications()', () => {
  it('returns 200 with empty array when user is not authenticated', async () => {
    const { validateToken } = await import('../../utils/authUtils');
    vi.mocked(validateToken).mockReturnValueOnce({ userId: null, isAuthenticated: false, reason: 'missing_token' });

    const res = await getNotifications(makeRequest({}), makeContext());
    // getNotifications returns 200 with empty array for unauthenticated users
    expect(res.status).toBe(200);
    expect(Array.isArray(res.jsonBody)).toBe(true);
    expect((res.jsonBody as unknown[]).length).toBe(0);
  });

  it('returns 200 with empty list when user has no notifications', async () => {
    mocks.mockQuery.mockResolvedValueOnce({ recordset: [] });

    const res = await getNotifications(makeRequest({}), makeContext());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.jsonBody)).toBe(true);
  });

  it('returns 200 with notifications', async () => {
    const notifs = [
      { Id: 'n_1', Title: 'آگهی تأیید شد', Message: 'آگهی شما تأیید شد', Type: 'success', IsRead: false, CreatedAt: new Date().toISOString() },
    ];
    mocks.mockQuery.mockResolvedValueOnce({ recordset: notifs });

    const res = await getNotifications(makeRequest({}), makeContext());
    expect(res.status).toBe(200);
    expect((res.jsonBody as unknown[]).length).toBe(1);
  });

  it('returns 500 on database error', async () => {
    mocks.mockQuery.mockRejectedValueOnce(new Error('DB error'));

    const res = await getNotifications(makeRequest({}), makeContext());
    expect(res.status).toBe(500);
  });
});

// ─── markNotificationsRead ────────────────────────────────────────────────

describe('markNotificationsRead()', () => {
  it('returns 401 when user is not authenticated', async () => {
    const { authResponse } = await import('../../utils/authUtils');
    vi.mocked(authResponse).mockReturnValueOnce({ status: 401, jsonBody: { error: 'Unauthorized' } });

    const res = await markNotificationsRead(makeRequest({ method: 'PATCH', body: {} }), makeContext());
    expect(res.status).toBe(401);
  });

  it('marks all notifications as read when no id provided', async () => {
    mocks.mockQuery.mockResolvedValueOnce({ rowsAffected: [5] });

    const res = await markNotificationsRead(makeRequest({ method: 'PATCH', body: {} }), makeContext());
    expect(res.status).toBe(200);
    expect((res.jsonBody as { success: boolean }).success).toBe(true);
  });

  it('marks a specific notification as read when id is provided', async () => {
    mocks.mockQuery.mockResolvedValueOnce({ rowsAffected: [1] });

    const res = await markNotificationsRead(
      makeRequest({ method: 'PATCH', body: { id: 'n_1' } }),
      makeContext()
    );
    expect(res.status).toBe(200);
    expect((res.jsonBody as { success: boolean }).success).toBe(true);
  });

  it('returns 500 on database error', async () => {
    mocks.mockQuery.mockRejectedValueOnce(new Error('DB error'));

    const res = await markNotificationsRead(makeRequest({ method: 'PATCH', body: {} }), makeContext());
    expect(res.status).toBe(500);
  });
});
