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

vi.mock('../../blob', () => ({
  resolveStorageConnectionString: vi.fn().mockImplementation(() => {
    // Simplified mirror of the real logic for health test purposes.
    // Returns the connection string when set (non-placeholder), or null.
    const connStr = process.env.AZURE_STORAGE_CONNECTION_STRING;
    if (connStr && !/AccountKey=YOUR_KEY\b/i.test(connStr)
        && !/AccountKey=your_account_key\b/i.test(connStr)
        && !/AccountKey=<[^>]+>/i.test(connStr)) {
      const keyMatch = connStr.match(/AccountKey=([^;]+)/i);
      if (!keyMatch || keyMatch[1].trim().length >= 20) return connStr;
    }
    const accountName = process.env.STORAGE_ACCOUNT_NAME || process.env.AZURE_STORAGE_ACCOUNT_NAME;
    const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY;
    if (accountName && accountKey && accountKey.length >= 20) {
      return `DefaultEndpointsProtocol=https;AccountName=${accountName};AccountKey=${accountKey};EndpointSuffix=core.windows.net`;
    }
    return null;
  }),
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
    savedEnv.STORAGE_ACCOUNT_NAME = process.env.STORAGE_ACCOUNT_NAME;
    savedEnv.AZURE_STORAGE_ACCOUNT_NAME = process.env.AZURE_STORAGE_ACCOUNT_NAME;
    savedEnv.AZURE_STORAGE_ACCOUNT_KEY = process.env.AZURE_STORAGE_ACCOUNT_KEY;
    savedEnv.STORAGE_CONTAINER_NAME = process.env.STORAGE_CONTAINER_NAME;
    mocks.mockQuery.mockReset();
    mocks.mockQuery.mockResolvedValue({ recordset: [{ '': 1 }], rowsAffected: [1] });

    // Set valid storage credentials by default so authSecret-focused tests are not
    // affected by blobStorage status.
    process.env.AZURE_STORAGE_CONNECTION_STRING =
      'DefaultEndpointsProtocol=https;AccountName=test;AccountKey=dGVzdGtleXRlc3RrZXl0ZXN0a2V5dGVzdGtleXQ=;EndpointSuffix=core.windows.net';
    process.env.AZURE_STORAGE_CONTAINER = 'test-container';
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

// ─── blob storage status ──────────────────────────────────────────────────

describe('healthCheck() blobStorage detection', () => {
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(async () => {
    savedEnv.AUTH_SECRET = process.env.AUTH_SECRET;
    savedEnv.SqlConnectionString = process.env.SqlConnectionString;
    savedEnv.AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
    savedEnv.AZURE_STORAGE_CONTAINER = process.env.AZURE_STORAGE_CONTAINER;
    savedEnv.STORAGE_ACCOUNT_NAME = process.env.STORAGE_ACCOUNT_NAME;
    savedEnv.AZURE_STORAGE_ACCOUNT_NAME = process.env.AZURE_STORAGE_ACCOUNT_NAME;
    savedEnv.AZURE_STORAGE_ACCOUNT_KEY = process.env.AZURE_STORAGE_ACCOUNT_KEY;
    savedEnv.STORAGE_CONTAINER_NAME = process.env.STORAGE_CONTAINER_NAME;
    mocks.mockQuery.mockReset();
    mocks.mockQuery.mockResolvedValue({ recordset: [{ '': 1 }], rowsAffected: [1] });

    // Set valid auth secret so blobStorage-focused tests are not affected
    process.env.AUTH_SECRET = 'a-very-long-random-secret-that-is-at-least-32-chars-long';
    process.env.SqlConnectionString = 'Server=tcp:test.database.windows.net,1433;Initial Catalog=testdb';
  });

  afterEach(() => {
    for (const [key, val] of Object.entries(savedEnv)) {
      if (val === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = val;
      }
    }
    vi.resetModules();
  });

  it('reports blobStorage=ok when AZURE_STORAGE_CONNECTION_STRING is a real value', async () => {
    process.env.AZURE_STORAGE_CONNECTION_STRING =
      'DefaultEndpointsProtocol=https;AccountName=test;AccountKey=dGVzdGtleXRlc3RrZXl0ZXN0a2V5dGVzdGtleXQ=;EndpointSuffix=core.windows.net';
    process.env.AZURE_STORAGE_CONTAINER = 'test-container';
    const { healthCheck } = await import('../health');
    const res = await healthCheck(makeRequest(), makeContext());
    expect(res.status).toBe(200);
    const body = res.jsonBody as Record<string, unknown>;
    expect(body.success).toBe(true);
    const data = body.data as Record<string, unknown>;
    expect(data.blobStorage).toBe('ok');
  });

  it('reports blobStorage=not_configured when no storage env vars are set', async () => {
    delete process.env.AZURE_STORAGE_CONNECTION_STRING;
    delete process.env.STORAGE_ACCOUNT_NAME;
    delete process.env.AZURE_STORAGE_ACCOUNT_NAME;
    delete process.env.AZURE_STORAGE_ACCOUNT_KEY;
    process.env.AZURE_STORAGE_CONTAINER = 'test-container';
    const { healthCheck } = await import('../health');
    const res = await healthCheck(makeRequest(), makeContext());
    const body = res.jsonBody as Record<string, unknown>;
    const data = body.data as Record<string, unknown>;
    expect(data.blobStorage).toBe('not_configured');
  });

  it('reports blobStorage=placeholder when connection string contains your_account_key', async () => {
    process.env.AZURE_STORAGE_CONNECTION_STRING =
      'DefaultEndpointsProtocol=https;AccountName=market4ustorage01;AccountKey=your_account_key;EndpointSuffix=core.windows.net';
    process.env.AZURE_STORAGE_CONTAINER = 'test-container';
    delete process.env.STORAGE_ACCOUNT_NAME;
    delete process.env.AZURE_STORAGE_ACCOUNT_NAME;
    delete process.env.AZURE_STORAGE_ACCOUNT_KEY;
    const { healthCheck } = await import('../health');
    const res = await healthCheck(makeRequest(), makeContext());
    expect(res.status).toBe(503);
    const body = res.jsonBody as Record<string, unknown>;
    expect(body.success).toBe(false);
    const data = body.data as Record<string, unknown>;
    expect(data.blobStorage).toBe('placeholder');
  });

  it('returns 503 when blobStorage is not_configured even if other vars are ok', async () => {
    delete process.env.AZURE_STORAGE_CONNECTION_STRING;
    delete process.env.STORAGE_ACCOUNT_NAME;
    delete process.env.AZURE_STORAGE_ACCOUNT_NAME;
    delete process.env.AZURE_STORAGE_ACCOUNT_KEY;
    process.env.AZURE_STORAGE_CONTAINER = 'test-container';
    const { healthCheck } = await import('../health');
    const res = await healthCheck(makeRequest(), makeContext());
    expect(res.status).toBe(503);
    const body = res.jsonBody as Record<string, unknown>;
    expect(body.success).toBe(false);
    const data = body.data as Record<string, unknown>;
    expect(data.status).toBe('degraded');
  });

  it('returns 503 when blobStorage is placeholder even if other vars are ok', async () => {
    process.env.AZURE_STORAGE_CONNECTION_STRING =
      'DefaultEndpointsProtocol=https;AccountName=market4ustorage01;AccountKey=your_account_key;EndpointSuffix=core.windows.net';
    process.env.AZURE_STORAGE_CONTAINER = 'test-container';
    delete process.env.STORAGE_ACCOUNT_NAME;
    delete process.env.AZURE_STORAGE_ACCOUNT_NAME;
    delete process.env.AZURE_STORAGE_ACCOUNT_KEY;
    const { healthCheck } = await import('../health');
    const res = await healthCheck(makeRequest(), makeContext());
    expect(res.status).toBe(503);
    const body = res.jsonBody as Record<string, unknown>;
    expect(body.success).toBe(false);
  });

  it('includes blobStorage field in error response when DB is disconnected', async () => {
    // DB throws to simulate disconnection
    mocks.mockQuery.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    delete process.env.AZURE_STORAGE_CONNECTION_STRING;
    delete process.env.STORAGE_ACCOUNT_NAME;
    delete process.env.AZURE_STORAGE_ACCOUNT_NAME;
    delete process.env.AZURE_STORAGE_ACCOUNT_KEY;
    const { healthCheck } = await import('../health');
    const res = await healthCheck(makeRequest(), makeContext());
    expect(res.status).toBe(503);
    const body = res.jsonBody as Record<string, unknown>;
    const data = body.data as Record<string, unknown>;
    expect(data.blobStorage).toBe('not_configured');
    expect(data.database).toBe('disconnected');
  });
});
