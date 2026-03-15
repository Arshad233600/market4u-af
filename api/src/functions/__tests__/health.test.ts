/**
 * Tests for api/src/functions/health.ts
 *
 * Verifies that the health endpoint's authSecret status is consistent with
 * the isAuthSecretInsecure flag used by the auth endpoints — in particular,
 * that known insecure placeholder values (not just 'CHANGE_ME_IN_AZURE') are
 * classified as 'insecure_default' rather than 'ok'.
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { HttpRequest, InvocationContext } from '@azure/functions';

// ─── hoisted mock state ────────────────────────────────────────────────────
const mocks = vi.hoisted(() => {
  const mockQuery = vi.fn().mockResolvedValue({ recordset: [{ '': 1 }], rowsAffected: [1] });
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

// ─── helpers ──────────────────────────────────────────────────────────────

function makeRequest(): HttpRequest {
  return {
    json: vi.fn(),
    headers: { get: () => null },
    params: {},
    method: 'GET',
    url: 'http://localhost/api/health',
    query: new URLSearchParams(),
  } as unknown as HttpRequest;
}

function makeContext(): InvocationContext {
  return { log: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() } as unknown as InvocationContext;
}

// ─── tests ────────────────────────────────────────────────────────────────

describe('healthCheck() authSecret detection', () => {
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(async () => {
    // Save env vars modified by tests
    savedEnv.AUTH_SECRET = process.env.AUTH_SECRET;
    savedEnv.SqlConnectionString = process.env.SqlConnectionString;
    savedEnv.AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
    savedEnv.AZURE_STORAGE_CONTAINER = process.env.AZURE_STORAGE_CONTAINER;
    mocks.mockQuery.mockReset();
    mocks.mockQuery.mockResolvedValue({ recordset: [{ '': 1 }], rowsAffected: [1] });
  });

  afterEach(() => {
    // Restore env vars
    for (const [key, val] of Object.entries(savedEnv)) {
      if (val === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = val;
      }
    }
    vi.resetModules();
  });

  it('reports authSecret=ok when AUTH_SECRET is a valid long random value', async () => {
    process.env.AUTH_SECRET = 'a-very-long-random-secret-that-is-at-least-32-chars-long';
    const { healthCheck } = await import('../health');
    const res = await healthCheck(makeRequest(), makeContext());
    const body = res.jsonBody as Record<string, unknown>;
    const data = body.data as Record<string, unknown>;
    expect(data.authSecret).toBe('ok');
  });

  it('reports authSecret=missing when AUTH_SECRET is not set', async () => {
    delete process.env.AUTH_SECRET;
    const { healthCheck } = await import('../health');
    const res = await healthCheck(makeRequest(), makeContext());
    const body = res.jsonBody as Record<string, unknown>;
    const data = body.data as Record<string, unknown>;
    expect(data.authSecret).toBe('missing');
  });

  it('reports authSecret=weak when AUTH_SECRET is shorter than 32 chars', async () => {
    process.env.AUTH_SECRET = 'tooshort';
    const { healthCheck } = await import('../health');
    const res = await healthCheck(makeRequest(), makeContext());
    const body = res.jsonBody as Record<string, unknown>;
    const data = body.data as Record<string, unknown>;
    expect(data.authSecret).toBe('weak');
  });

  it('reports authSecret=weak for CHANGE_ME_IN_AZURE placeholder (too short at 18 chars)', async () => {
    // CHANGE_ME_IN_AZURE is in the insecure placeholder list but is also < 32 chars,
    // so it is classified as 'weak' (length check takes priority).
    process.env.AUTH_SECRET = 'CHANGE_ME_IN_AZURE';
    const { healthCheck } = await import('../health');
    const res = await healthCheck(makeRequest(), makeContext());
    const body = res.jsonBody as Record<string, unknown>;
    const data = body.data as Record<string, unknown>;
    expect(data.authSecret).toBe('weak');
  });

  it('reports authSecret=insecure_default for dev-local placeholder (the .env.example default)', async () => {
    // This is the default value shipped in .env.example. Previously health.ts only checked
    // for 'CHANGE_ME_IN_AZURE' and would have reported 'ok' here, while login returns 503.
    process.env.AUTH_SECRET = 'dev-local-replace-before-deploying-to-azure-production';
    const { healthCheck } = await import('../health');
    const res = await healthCheck(makeRequest(), makeContext());
    const body = res.jsonBody as Record<string, unknown>;
    const data = body.data as Record<string, unknown>;
    expect(data.authSecret).toBe('insecure_default');
  });

  it('reports authSecret=insecure_default for change-this-to-a-random-string placeholder', async () => {
    process.env.AUTH_SECRET = 'change-this-to-a-random-string-min-32-characters-long';
    const { healthCheck } = await import('../health');
    const res = await healthCheck(makeRequest(), makeContext());
    const body = res.jsonBody as Record<string, unknown>;
    const data = body.data as Record<string, unknown>;
    expect(data.authSecret).toBe('insecure_default');
  });

  it('reports authSecret=insecure_default for local-dev-only placeholder (the local.settings.json.example default)', async () => {
    process.env.AUTH_SECRET = 'local-dev-only-must-be-replaced-for-any-azure-deploy';
    const { healthCheck } = await import('../health');
    const res = await healthCheck(makeRequest(), makeContext());
    const body = res.jsonBody as Record<string, unknown>;
    const data = body.data as Record<string, unknown>;
    expect(data.authSecret).toBe('insecure_default');
  });

  it('returns 503 (not 200) when authSecret is insecure_default and DB is connected', async () => {
    process.env.AUTH_SECRET = 'dev-local-replace-before-deploying-to-azure-production';
    // Even with DB connected, isHealthy must be false because authSecret != 'ok'
    const { healthCheck } = await import('../health');
    const res = await healthCheck(makeRequest(), makeContext());
    expect(res.status).toBe(503);
    const body = res.jsonBody as Record<string, unknown>;
    expect(body.success).toBe(false);
  });
});
