/**
 * Tests for api/src/functions/uploadSas.ts
 *
 * Azure blob storage and auth utilities are mocked so no real network traffic
 * is generated.
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { HttpRequest, InvocationContext } from '@azure/functions';

// ─── hoisted mock state ───────────────────────────────────────────────────
const mocks = vi.hoisted(() => {
  const mockGenerateSas = vi.fn().mockReturnValue('sig=fake-sas-token');
  return { mockGenerateSas };
});

vi.mock('@azure/storage-blob', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@azure/storage-blob')>();
  return {
    ...actual,
    StorageSharedKeyCredential: vi.fn().mockImplementation(function () {}),
    generateBlobSASQueryParameters: mocks.mockGenerateSas,
    BlobSASPermissions: vi.fn().mockImplementation(function () {
      return { write: false, create: false };
    }),
  };
});

vi.mock('applicationinsights', () => ({
  default: { defaultClient: null },
  defaultClient: null,
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
  headers?: Record<string, string>;
}): HttpRequest {
  return {
    json: vi.fn().mockResolvedValue(opts.body ?? {}),
    headers: { get: (name: string) => opts.headers?.[name.toLowerCase()] ?? null },
    params: {},
    method: 'POST',
    url: 'http://localhost/api/upload/sas-token',
    query: new URLSearchParams(),
  } as unknown as HttpRequest;
}

function makeContext(): InvocationContext {
  return { log: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() } as unknown as InvocationContext;
}

let uploadSas: typeof import('../uploadSas').uploadSas;

beforeEach(async () => {
  mocks.mockGenerateSas.mockReset();
  mocks.mockGenerateSas.mockReturnValue('sig=fake-sas-token');

  // Set valid storage env vars for the happy-path tests.
  // The account key must be at least 20 characters to avoid being rejected
  // as a placeholder by isPlaceholderConnectionString().
  process.env.AZURE_STORAGE_CONNECTION_STRING =
    'DefaultEndpointsProtocol=https;AccountName=testaccount;AccountKey=dGVzdGtleXRlc3RrZXl0ZXN0a2V5dGVzdGtleXRlc3RrZXl0ZXN0a2V5dGVzdGtleXQ=;EndpointSuffix=core.windows.net';
  process.env.AZURE_STORAGE_CONTAINER = 'test-container';

  const authUtils = await import('../../utils/authUtils');
  vi.mocked(authUtils.validateToken).mockReturnValue({ userId: 'u_test_123', isAuthenticated: true });
  vi.mocked(authUtils.authResponse).mockReturnValue(null);

  const mod = await import('../uploadSas');
  uploadSas = mod.uploadSas;
});

// ─── storage_not_configured (main fix for 503 issue) ─────────────────────

describe('uploadSas() storage_not_configured', () => {
  const savedVars: Record<string, string | undefined> = {};

  beforeEach(() => {
    savedVars.AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
    savedVars.STORAGE_ACCOUNT_NAME = process.env.STORAGE_ACCOUNT_NAME;
    savedVars.AZURE_STORAGE_ACCOUNT_NAME = process.env.AZURE_STORAGE_ACCOUNT_NAME;
    savedVars.AZURE_STORAGE_ACCOUNT_KEY = process.env.AZURE_STORAGE_ACCOUNT_KEY;
  });

  afterEach(() => {
    for (const [key, val] of Object.entries(savedVars)) {
      if (val === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = val;
      }
    }
  });

  it('returns 503 with storage_not_configured when AZURE_STORAGE_CONNECTION_STRING is not set', async () => {
    delete process.env.AZURE_STORAGE_CONNECTION_STRING;
    delete process.env.STORAGE_ACCOUNT_NAME;
    delete process.env.AZURE_STORAGE_ACCOUNT_NAME;
    delete process.env.AZURE_STORAGE_ACCOUNT_KEY;

    const req = makeRequest({ body: { fileName: 'photo.jpg', fileType: 'image/jpeg' } });
    const res = await uploadSas(req, makeContext());

    expect(res.status).toBe(503);
    const body = res.jsonBody as Record<string, unknown>;
    expect(body.reason).toBe('storage_not_configured');
    expect(body.category).toBe('STORAGE_NOT_CONFIGURED');
  });

  it('returns 503 when connection string lacks AccountName/AccountKey and no fallback vars are set', async () => {
    // A connection string without AccountName/AccountKey embedded
    process.env.AZURE_STORAGE_CONNECTION_STRING = 'UseDevelopmentStorage=true';
    delete process.env.STORAGE_ACCOUNT_NAME;
    delete process.env.AZURE_STORAGE_ACCOUNT_NAME;
    delete process.env.AZURE_STORAGE_ACCOUNT_KEY;

    const req = makeRequest({ body: { fileName: 'photo.jpg', fileType: 'image/jpeg' } });
    const res = await uploadSas(req, makeContext());

    expect(res.status).toBe(503);
    const body = res.jsonBody as Record<string, unknown>;
    expect(body.reason).toBe('storage_not_configured');
    expect(body.category).toBe('STORAGE_NOT_CONFIGURED');
  });

  it('returns 503 when connection string contains placeholder AccountKey=your_account_key', async () => {
    process.env.AZURE_STORAGE_CONNECTION_STRING =
      'DefaultEndpointsProtocol=https;AccountName=market4ustorage01;AccountKey=your_account_key;EndpointSuffix=core.windows.net';
    delete process.env.STORAGE_ACCOUNT_NAME;
    delete process.env.AZURE_STORAGE_ACCOUNT_NAME;
    delete process.env.AZURE_STORAGE_ACCOUNT_KEY;

    const req = makeRequest({ body: { fileName: 'photo.jpg', fileType: 'image/jpeg' } });
    const res = await uploadSas(req, makeContext());

    expect(res.status).toBe(503);
    const body = res.jsonBody as Record<string, unknown>;
    expect(body.reason).toBe('storage_not_configured');
    expect(body.category).toBe('STORAGE_NOT_CONFIGURED');
  });

  it('returns 503 when connection string contains placeholder AccountKey=YOUR_KEY', async () => {
    process.env.AZURE_STORAGE_CONNECTION_STRING =
      'DefaultEndpointsProtocol=https;AccountName=testaccount;AccountKey=YOUR_KEY;EndpointSuffix=core.windows.net';
    delete process.env.STORAGE_ACCOUNT_NAME;
    delete process.env.AZURE_STORAGE_ACCOUNT_NAME;
    delete process.env.AZURE_STORAGE_ACCOUNT_KEY;

    const req = makeRequest({ body: { fileName: 'photo.jpg', fileType: 'image/jpeg' } });
    const res = await uploadSas(req, makeContext());

    expect(res.status).toBe(503);
    const body = res.jsonBody as Record<string, unknown>;
    expect(body.reason).toBe('storage_not_configured');
  });

  it('returns 503 when individual account key env var is a placeholder', async () => {
    delete process.env.AZURE_STORAGE_CONNECTION_STRING;
    process.env.STORAGE_ACCOUNT_NAME = 'realaccount';
    process.env.AZURE_STORAGE_ACCOUNT_KEY = 'YOUR_KEY';

    const req = makeRequest({ body: { fileName: 'photo.jpg', fileType: 'image/jpeg' } });
    const res = await uploadSas(req, makeContext());

    expect(res.status).toBe(503);
    const body = res.jsonBody as Record<string, unknown>;
    expect(body.reason).toBe('storage_not_configured');
  });
});

// ─── auth checks ──────────────────────────────────────────────────────────

describe('uploadSas() auth', () => {
  it('returns 401 when user is not authenticated', async () => {
    const authUtils = await import('../../utils/authUtils');
    vi.mocked(authUtils.validateToken).mockReturnValueOnce({
      userId: null,
      isAuthenticated: false,
      reason: 'missing_token',
    });
    vi.mocked(authUtils.authResponse).mockReturnValueOnce({
      status: 401,
      jsonBody: { error: 'Unauthorized', category: 'AUTH_REQUIRED', reason: 'missing_token' },
    });

    const req = makeRequest({ body: { fileName: 'photo.jpg', fileType: 'image/jpeg' } });
    const res = await uploadSas(req, makeContext());
    expect(res.status).toBe(401);
  });

  it('returns 401 when auth.userId is null (authResponse returned null)', async () => {
    const authUtils = await import('../../utils/authUtils');
    vi.mocked(authUtils.validateToken).mockReturnValueOnce({
      userId: null,
      isAuthenticated: false,
      reason: 'missing_token',
    });
    // authResponse returns null (no pre-built error), but userId is still null
    vi.mocked(authUtils.authResponse).mockReturnValueOnce(null);

    const req = makeRequest({ body: { fileName: 'photo.jpg', fileType: 'image/jpeg' } });
    const res = await uploadSas(req, makeContext());
    expect(res.status).toBe(401);
    const body = res.jsonBody as Record<string, unknown>;
    expect(body.category).toBe('AUTH_REQUIRED');
  });
});

// ─── request validation ───────────────────────────────────────────────────

describe('uploadSas() request validation', () => {
  it('returns 400 when fileName is missing', async () => {
    const req = makeRequest({ body: { fileType: 'image/jpeg' } });
    const res = await uploadSas(req, makeContext());
    expect(res.status).toBe(400);
  });

  it('returns 400 when fileType is not in allowed list', async () => {
    const req = makeRequest({ body: { fileName: 'evil.html', fileType: 'text/html' } });
    const res = await uploadSas(req, makeContext());
    expect(res.status).toBe(400);
  });

  it('returns 400 when fileType is application/octet-stream', async () => {
    const req = makeRequest({ body: { fileName: 'file.bin', fileType: 'application/octet-stream' } });
    const res = await uploadSas(req, makeContext());
    expect(res.status).toBe(400);
  });

  it('accepts image/gif as a valid file type', async () => {
    const req = makeRequest({ body: { fileName: 'animation.gif', fileType: 'image/gif' } });
    const res = await uploadSas(req, makeContext());
    expect(res.status).toBe(200);
  });
});
