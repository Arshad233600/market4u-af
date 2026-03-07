/**
 * Tests for api/src/functions/chat.ts
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
}): HttpRequest {
  return {
    json: vi.fn().mockResolvedValue(opts.body ?? {}),
    headers: { get: (name: string) => opts.headers?.[name.toLowerCase()] ?? null },
    params: opts.params ?? {},
    method: opts.method ?? 'GET',
    url: 'http://localhost/api/chat/requests',
    query: new URLSearchParams(),
  } as unknown as HttpRequest;
}

function makeContext(): InvocationContext {
  return { log: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() } as unknown as InvocationContext;
}

let getChatRequests: typeof import('../chat').getChatRequests;
let sendChatRequest: typeof import('../chat').sendChatRequest;
let acceptChatRequest: typeof import('../chat').acceptChatRequest;
let rejectChatRequest: typeof import('../chat').rejectChatRequest;

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

  const mod = await import('../chat');
  getChatRequests = mod.getChatRequests;
  sendChatRequest = mod.sendChatRequest;
  acceptChatRequest = mod.acceptChatRequest;
  rejectChatRequest = mod.rejectChatRequest;
});

// ─── getChatRequests ──────────────────────────────────────────────────────

describe('getChatRequests()', () => {
  it('returns 401 when user is not authenticated', async () => {
    const { authResponse } = await import('../../utils/authUtils');
    vi.mocked(authResponse).mockReturnValueOnce({ status: 401, jsonBody: { error: 'Unauthorized' } });

    const res = await getChatRequests(makeRequest({}), makeContext());
    expect(res.status).toBe(401);
  });

  it('returns 200 with empty list when no pending requests', async () => {
    mocks.mockQuery.mockResolvedValueOnce({ recordset: [] });

    const res = await getChatRequests(makeRequest({}), makeContext());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.jsonBody)).toBe(true);
    expect((res.jsonBody as unknown[]).length).toBe(0);
  });

  it('returns 200 with pending chat requests', async () => {
    const requests = [
      { Id: 'cr_1', FromUserId: 'u_other', FromUserName: 'Ahmad', ToUserId: 'u_test_123', Status: 'PENDING', CreatedAt: new Date().toISOString() },
    ];
    mocks.mockQuery.mockResolvedValueOnce({ recordset: requests });

    const res = await getChatRequests(makeRequest({}), makeContext());
    expect(res.status).toBe(200);
    expect((res.jsonBody as unknown[]).length).toBe(1);
  });

  it('returns 500 on database error', async () => {
    mocks.mockQuery.mockRejectedValueOnce(new Error('DB error'));

    const res = await getChatRequests(makeRequest({}), makeContext());
    expect(res.status).toBe(500);
  });
});

// ─── sendChatRequest ──────────────────────────────────────────────────────

describe('sendChatRequest()', () => {
  it('returns 401 when user is not authenticated', async () => {
    const { authResponse } = await import('../../utils/authUtils');
    vi.mocked(authResponse).mockReturnValueOnce({ status: 401, jsonBody: { error: 'Unauthorized' } });

    const res = await sendChatRequest(makeRequest({ method: 'POST', body: { toUserId: 'u_other' } }), makeContext());
    expect(res.status).toBe(401);
  });

  it('returns 400 when toUserId is missing', async () => {
    const res = await sendChatRequest(makeRequest({ method: 'POST', body: {} }), makeContext());
    expect(res.status).toBe(400);
  });

  it('returns 400 when user tries to send request to themselves', async () => {
    const res = await sendChatRequest(
      makeRequest({ method: 'POST', body: { toUserId: 'u_test_123' } }),
      makeContext()
    );
    expect(res.status).toBe(400);
  });

  it('returns 404 when target user does not exist', async () => {
    mocks.mockQuery.mockResolvedValueOnce({ recordset: [] }); // user not found

    const res = await sendChatRequest(
      makeRequest({ method: 'POST', body: { toUserId: 'u_nonexistent' } }),
      makeContext()
    );
    expect(res.status).toBe(404);
  });

  it('returns 409 when a pending request already exists', async () => {
    mocks.mockQuery.mockResolvedValueOnce({ recordset: [{ Id: 'u_other' }] }); // user exists
    mocks.mockQuery.mockResolvedValueOnce({ recordset: [{ Id: 'cr_existing' }] }); // request exists

    const res = await sendChatRequest(
      makeRequest({ method: 'POST', body: { toUserId: 'u_other' } }),
      makeContext()
    );
    expect(res.status).toBe(409);
  });

  it('returns 201 when chat request is sent successfully', async () => {
    mocks.mockQuery.mockResolvedValueOnce({ recordset: [{ Id: 'u_other' }] }); // user exists
    mocks.mockQuery.mockResolvedValueOnce({ recordset: [] });                   // no existing request
    mocks.mockQuery.mockResolvedValueOnce({ rowsAffected: [1] });              // INSERT

    const res = await sendChatRequest(
      makeRequest({ method: 'POST', body: { toUserId: 'u_other' } }),
      makeContext()
    );
    expect(res.status).toBe(201);
    expect((res.jsonBody as { success: boolean }).success).toBe(true);
  });
});

// ─── acceptChatRequest ────────────────────────────────────────────────────

describe('acceptChatRequest()', () => {
  it('returns 401 when user is not authenticated', async () => {
    const { authResponse } = await import('../../utils/authUtils');
    vi.mocked(authResponse).mockReturnValueOnce({ status: 401, jsonBody: { error: 'Unauthorized' } });

    const res = await acceptChatRequest(
      makeRequest({ method: 'POST', params: { requestId: 'cr_1' } }),
      makeContext()
    );
    expect(res.status).toBe(401);
  });

  it('returns 400 when requestId param is missing', async () => {
    const res = await acceptChatRequest(makeRequest({ method: 'POST', params: {} }), makeContext());
    expect(res.status).toBe(400);
  });

  it('returns 404 when request is not found or not pending', async () => {
    mocks.mockQuery.mockResolvedValueOnce({ recordset: [] }); // request not found

    const res = await acceptChatRequest(
      makeRequest({ method: 'POST', params: { requestId: 'cr_nonexistent' } }),
      makeContext()
    );
    expect(res.status).toBe(404);
  });

  it('returns 200 when chat request is accepted', async () => {
    mocks.mockQuery.mockResolvedValueOnce({ recordset: [{ Id: 'cr_1', FromUserId: 'u_sender' }] }); // request found
    mocks.mockQuery.mockResolvedValueOnce({ rowsAffected: [1] }); // update status
    mocks.mockQuery.mockResolvedValueOnce({ rowsAffected: [1] }); // insert initial message

    const res = await acceptChatRequest(
      makeRequest({ method: 'POST', params: { requestId: 'cr_1' } }),
      makeContext()
    );
    expect(res.status).toBe(200);
    expect((res.jsonBody as { success: boolean }).success).toBe(true);
  });
});

// ─── rejectChatRequest ────────────────────────────────────────────────────

describe('rejectChatRequest()', () => {
  it('returns 401 when user is not authenticated', async () => {
    const { authResponse } = await import('../../utils/authUtils');
    vi.mocked(authResponse).mockReturnValueOnce({ status: 401, jsonBody: { error: 'Unauthorized' } });

    const res = await rejectChatRequest(
      makeRequest({ method: 'POST', params: { requestId: 'cr_1' } }),
      makeContext()
    );
    expect(res.status).toBe(401);
  });

  it('returns 400 when requestId param is missing', async () => {
    const res = await rejectChatRequest(makeRequest({ method: 'POST', params: {} }), makeContext());
    expect(res.status).toBe(400);
  });

  it('returns 404 when request is not found or not pending', async () => {
    mocks.mockQuery.mockResolvedValueOnce({ recordset: [] }); // request not found

    const res = await rejectChatRequest(
      makeRequest({ method: 'POST', params: { requestId: 'cr_nonexistent' } }),
      makeContext()
    );
    expect(res.status).toBe(404);
  });

  it('returns 200 when chat request is rejected', async () => {
    mocks.mockQuery.mockResolvedValueOnce({ recordset: [{ Id: 'cr_1' }] }); // request found
    mocks.mockQuery.mockResolvedValueOnce({ rowsAffected: [1] });            // update status

    const res = await rejectChatRequest(
      makeRequest({ method: 'POST', params: { requestId: 'cr_1' } }),
      makeContext()
    );
    expect(res.status).toBe(200);
    expect((res.jsonBody as { success: boolean }).success).toBe(true);
  });
});
