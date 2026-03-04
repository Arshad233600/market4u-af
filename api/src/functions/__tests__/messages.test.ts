/**
 * Tests for api/src/functions/messages.ts
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
  validateToken: vi.fn().mockReturnValue({ userId: 'u_sender', isAuthenticated: true }),
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
    url: 'http://localhost/api/messages',
    query: new URLSearchParams(),
  } as unknown as HttpRequest;
}

function makeContext(): InvocationContext {
  return { log: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() } as unknown as InvocationContext;
}

let getInbox: typeof import('../messages').getInbox;
let getThread: typeof import('../messages').getThread;
let sendMessage: typeof import('../messages').sendMessage;

// getInbox() has an early-return when no SQL connection string is detected.
// Set a fake value so tests exercise the full code path (the pool is still mocked).
const originalConnStr = process.env.SqlConnectionString;
process.env.SqlConnectionString = 'fake-test-connection-string';

beforeEach(async () => {
  mocks.mockQuery.mockReset();
  mocks.mockQuery.mockResolvedValue({ recordset: [], rowsAffected: [0] });
  mocks.mockPool.request.mockImplementation(() => ({
    input: mocks.mockInput,
    query: mocks.mockQuery,
  }));

  const authUtils = await import('../../utils/authUtils');
  vi.mocked(authUtils.validateToken).mockReturnValue({ userId: 'u_sender', isAuthenticated: true });
  vi.mocked(authUtils.authResponse).mockReturnValue(null);

  const mod = await import('../messages');
  getInbox = mod.getInbox;
  getThread = mod.getThread;
  sendMessage = mod.sendMessage;
});

// ─── getInbox ─────────────────────────────────────────────────────────────

describe('getInbox()', () => {
  it('returns 401 when user is not authenticated', async () => {
    const authUtils = await import('../../utils/authUtils');
    vi.mocked(authUtils.validateToken).mockReturnValueOnce({
      userId: null,
      isAuthenticated: false,
      reason: 'missing_token',
    });

    const res = await getInbox(makeRequest({}), makeContext());
    expect(res.status).toBe(401);
  });

  it('returns 200 with empty inbox when no messages exist', async () => {
    mocks.mockQuery.mockResolvedValueOnce({ recordset: [] });
    const res = await getInbox(makeRequest({}), makeContext());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.jsonBody)).toBe(true);
  });

  it('returns 200 with inbox conversations', async () => {
    const conversations = [
      {
        OtherUserId: 'u_other',
        OtherUserName: 'Other User',
        LastMessage: 'Hello!',
        UnreadCount: 2,
      },
    ];
    mocks.mockQuery.mockResolvedValueOnce({ recordset: conversations });

    const res = await getInbox(makeRequest({}), makeContext());
    expect(res.status).toBe(200);
    expect((res.jsonBody as unknown[]).length).toBe(1);
  });
});

// ─── getThread ────────────────────────────────────────────────────────────

describe('getThread()', () => {
  it('returns 401 when user is not authenticated', async () => {
    const { authResponse } = await import('../../utils/authUtils');
    vi.mocked(authResponse).mockReturnValueOnce({ status: 401, jsonBody: { error: 'Unauthorized' } });

    const res = await getThread(makeRequest({ params: { userId: 'u_other' } }), makeContext());
    expect(res.status).toBe(401);
  });

  it('returns 400 when userId param is missing', async () => {
    const res = await getThread(makeRequest({ params: {} }), makeContext());
    expect(res.status).toBe(400);
  });

  it('returns 200 with message thread', async () => {
    const messages = [
      { Id: 'msg_1', FromUserId: 'u_sender', ToUserId: 'u_other', Content: 'Hi' },
    ];
    mocks.mockQuery.mockResolvedValueOnce({ recordset: messages }); // SELECT messages
    mocks.mockQuery.mockResolvedValueOnce({ recordset: [], rowsAffected: [1] }); // UPDATE read

    const res = await getThread(makeRequest({ params: { userId: 'u_other' } }), makeContext());
    expect(res.status).toBe(200);
    expect((res.jsonBody as unknown[]).length).toBe(1);
  });
});

// ─── sendMessage ──────────────────────────────────────────────────────────

describe('sendMessage()', () => {
  it('returns 401 when user is not authenticated', async () => {
    const { authResponse } = await import('../../utils/authUtils');
    vi.mocked(authResponse).mockReturnValueOnce({ status: 401, jsonBody: { error: 'Unauthorized' } });

    const res = await sendMessage(
      makeRequest({ body: { toUserId: 'u_other', content: 'Hello' } }),
      makeContext()
    );
    expect(res.status).toBe(401);
  });

  it('returns 400 when toUserId is missing', async () => {
    const res = await sendMessage(
      makeRequest({ body: { content: 'Hello' } }),
      makeContext()
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when content is empty', async () => {
    const res = await sendMessage(
      makeRequest({ body: { toUserId: 'u_other', content: '   ' } }),
      makeContext()
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when user tries to message themselves', async () => {
    const authUtils = await import('../../utils/authUtils');
    vi.mocked(authUtils.validateToken).mockReturnValueOnce({
      userId: 'u_sender',
      isAuthenticated: true,
    });
    vi.mocked(authUtils.authResponse).mockReturnValueOnce(null);

    const res = await sendMessage(
      makeRequest({ body: { toUserId: 'u_sender', content: 'Hello' } }),
      makeContext()
    );
    expect(res.status).toBe(400);
    expect((res.jsonBody as Record<string, unknown>)?.error).toMatch(/yourself/i);
  });

  it('returns 404 when recipient does not exist', async () => {
    mocks.mockQuery.mockResolvedValueOnce({ recordset: [] }); // user existence check

    const res = await sendMessage(
      makeRequest({ body: { toUserId: 'u_nonexistent', content: 'Hello' } }),
      makeContext()
    );
    expect(res.status).toBe(404);
  });

  it('returns 201 when message is sent successfully', async () => {
    mocks.mockQuery.mockResolvedValueOnce({ recordset: [{ Id: 'u_other' }] }); // recipient exists
    mocks.mockQuery.mockResolvedValueOnce({ recordset: [], rowsAffected: [1] }); // INSERT

    const res = await sendMessage(
      makeRequest({ body: { toUserId: 'u_other', content: 'Hello there!' } }),
      makeContext()
    );
    expect(res.status).toBe(201);
  });
});
