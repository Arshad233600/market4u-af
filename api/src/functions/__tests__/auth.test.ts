/**
 * Tests for api/src/functions/auth.ts
 *
 * All external dependencies (DB pool, applicationinsights, bcrypt) are mocked so
 * tests run entirely in-process without any network or file-system access.
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import * as sql from 'mssql';
import jwt from 'jsonwebtoken';

// ─── hoisted mock state ────────────────────────────────────────────────────
const mocks = vi.hoisted(() => {
  const mockQuery = vi.fn().mockResolvedValue({ recordset: [], rowsAffected: [0] });
  const mockInput = vi.fn().mockReturnThis();
  const mockRequest = () => ({ input: mockInput, query: mockQuery });
  const mockPool = { request: vi.fn().mockImplementation(mockRequest) };
  const mockCheckRateLimit = vi.fn().mockResolvedValue({ allowed: true, remaining: 9, resetAt: Date.now() + 60000, storeType: 'memory' });
  const mockResetRateLimit = vi.fn();
  return { mockQuery, mockInput, mockPool, mockCheckRateLimit, mockResetRateLimit };
});

// ─── module mocks ──────────────────────────────────────────────────────────

vi.mock('applicationinsights', () => ({
  default: {
    defaultClient: null,
    setup: vi.fn().mockReturnThis(),
    start: vi.fn(),
  },
  defaultClient: null,
}));

vi.mock('../../db', () => ({
  getPool: vi.fn().mockResolvedValue(mocks.mockPool),
  resetPool: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../utils/authUtils', () => ({
  isAuthSecretInsecure: false,
  validateToken: vi.fn().mockReturnValue({ userId: 'u_test_123', isAuthenticated: true }),
  authResponse: vi.fn().mockReturnValue(null),
  TOKEN_EXPIRATION_MS: 604800000,
  TOKEN_EXPIRATION_SECONDS: 604800,
  MISCONFIGURED_REASONS: new Set([
    'missing_auth_secret',
    'insecure_default_secret',
    'invalid_auth_secret',
  ]),
  lastAuthFailureSample: null,
}));

vi.mock('../../utils/rateLimit', () => ({
  checkRateLimit: mocks.mockCheckRateLimit,
  resetRateLimit: mocks.mockResetRateLimit,
}));

vi.mock('../../utils/authSecret', () => ({
  getAuthSecretStrict: vi
    .fn()
    .mockReturnValue('test-auth-secret-value-that-is-at-least-32-chars-long'),
  getSecretFingerprint: vi.fn().mockReturnValue('abcdef123456'),
  getSecretDiagnostics: vi
    .fn()
    .mockReturnValue({ secretLength: 48, secretFingerprint: 'abcdef123456' }),
}));

vi.mock('../../utils/usersSchemaCheck', () => ({
  checkUsersSchema: vi.fn().mockResolvedValue({ schemaOk: true, missingColumns: [] }),
  applyMissingUsersColumns: vi.fn().mockResolvedValue([]),
}));

vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('$2b$10$hashedpassword'),
    compare: vi.fn().mockImplementation(
      (plain: string, _hash: string) =>
        Promise.resolve(plain === 'correct-password')
    ),
  },
}));

// ─── helpers ──────────────────────────────────────────────────────────────

function makeRequest(opts: {
  body?: unknown;
  headers?: Record<string, string>;
  params?: Record<string, string>;
  method?: string;
  url?: string;
}): HttpRequest {
  return {
    json: vi.fn().mockResolvedValue(opts.body ?? {}),
    headers: { get: (name: string) => opts.headers?.[name.toLowerCase()] ?? null },
    params: opts.params ?? {},
    method: opts.method ?? 'POST',
    url: opts.url ?? 'http://localhost/api/test',
    query: new URLSearchParams(),
  } as unknown as HttpRequest;
}

function makeContext(): InvocationContext {
  return {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  } as unknown as InvocationContext;
}

/** Creates a mock Users recordset row with sensible defaults; override as needed. */
function makeUserRecord(overrides: Partial<{
  Id: string; Name: string; Email: string; Phone: string;
  PasswordHash: string | null; AvatarUrl: string; Role: string;
  IsVerified: boolean; VerificationStatus: string; CreatedAt: string;
}> = {}) {
  return {
    Id: 'u_1',
    Name: 'Test User',
    Email: 'user@example.com',
    Phone: '0700000000',
    PasswordHash: '$2b$10$hashedpassword',
    AvatarUrl: '',
    Role: 'USER',
    IsVerified: false,
    VerificationStatus: 'NONE',
    CreatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ─── tests ────────────────────────────────────────────────────────────────

// Deferred import so mocks are in place before the module is first evaluated
let login: (r: HttpRequest, c: InvocationContext) => Promise<HttpResponseInit>;
let register: (r: HttpRequest, c: InvocationContext) => Promise<HttpResponseInit>;
let refreshTokenHandler: (r: HttpRequest, c: InvocationContext) => Promise<HttpResponseInit>;

beforeEach(async () => {
  // mockReset clears call history AND the once-queue to prevent mock state leaking.
  mocks.mockQuery.mockReset();
  mocks.mockQuery.mockResolvedValue({ recordset: [], rowsAffected: [0] });
  mocks.mockPool.request.mockImplementation(() => ({
    input: mocks.mockInput,
    query: mocks.mockQuery,
  }));
  mocks.mockCheckRateLimit.mockReset();
  mocks.mockCheckRateLimit.mockResolvedValue({ allowed: true, remaining: 9, resetAt: Date.now() + 60000, storeType: 'memory' });

  // Reset db mocks (getPool and resetPool) to their default resolved state.
  const db = await import('../../db');
  (db.getPool as ReturnType<typeof vi.fn>).mockReset();
  (db.getPool as ReturnType<typeof vi.fn>).mockResolvedValue(mocks.mockPool);
  (db.resetPool as ReturnType<typeof vi.fn>).mockReset();
  (db.resetPool as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

  // Reset usersSchemaCheck to default healthy state.
  const usersSchemaCheckMod = await import('../../utils/usersSchemaCheck');
  (usersSchemaCheckMod.checkUsersSchema as ReturnType<typeof vi.fn>).mockReset();
  (usersSchemaCheckMod.checkUsersSchema as ReturnType<typeof vi.fn>).mockResolvedValue({ schemaOk: true, missingColumns: [] });
  (usersSchemaCheckMod.applyMissingUsersColumns as ReturnType<typeof vi.fn>).mockReset();
  (usersSchemaCheckMod.applyMissingUsersColumns as ReturnType<typeof vi.fn>).mockResolvedValue([]);

  // Ensure mocked authUtils.isAuthSecretInsecure is false
  const authUtils = await import('../../utils/authUtils');
  (authUtils as unknown as Record<string, unknown>).isAuthSecretInsecure = false;

  const mod = await import('../auth');
  login = mod.login;
  register = mod.register;
  refreshTokenHandler = mod.refreshTokenHandler;
});

// ─── login ────────────────────────────────────────────────────────────────

describe('login()', () => {
  it('returns 400 when email is missing', async () => {
    const req = makeRequest({ body: { email: '', password: 'pass' } });
    const res = await login(req, makeContext());
    expect(res.status).toBe(400);
  });

  it('returns 400 when password is missing', async () => {
    const req = makeRequest({ body: { email: 'user@example.com', password: '' } });
    const res = await login(req, makeContext());
    expect(res.status).toBe(400);
  });

  it('returns 401 when user is not found in DB', async () => {
    mocks.mockQuery.mockResolvedValueOnce({ recordset: [], rowsAffected: [0] });

    const req = makeRequest({ body: { email: 'notfound@example.com', password: 'pass' } });
    const res = await login(req, makeContext());
    expect(res.status).toBe(401);
  });

  it('returns 401 when password is incorrect', async () => {
    // Combined query: user lookup with full profile
    mocks.mockQuery.mockResolvedValueOnce({
      recordset: [makeUserRecord()],
    });
    // bcrypt.compare returns false for wrong passwords (see mock above)

    const req = makeRequest({ body: { email: 'user@example.com', password: 'wrong-password' } });
    const res = await login(req, makeContext());
    expect(res.status).toBe(401);
  });

  it('returns 401 when PasswordHash is null (OAuth-only account)', async () => {
    // Combined query returns user with null PasswordHash (e.g. registered via Google OAuth)
    mocks.mockQuery.mockResolvedValueOnce({
      recordset: [makeUserRecord({ Id: 'u_oauth', PasswordHash: null, Email: 'oauth@example.com', IsVerified: true })],
    });

    const req = makeRequest({ body: { email: 'oauth@example.com', password: 'somepassword' } });
    const res = await login(req, makeContext());
    // Must return 401 (not 500) — null hash should be caught before bcrypt.compare
    expect(res.status).toBe(401);
  });

  it('returns 401 when PasswordHash is empty string (legacy data)', async () => {
    // Combined query returns user with empty PasswordHash
    mocks.mockQuery.mockResolvedValueOnce({
      recordset: [makeUserRecord({ Id: 'u_guest', PasswordHash: '', Email: 'guest@example.com', Role: 'GUEST' })],
    });

    const req = makeRequest({ body: { email: 'guest@example.com', password: 'somepassword' } });
    const res = await login(req, makeContext());
    expect(res.status).toBe(401);
  });

  it('returns 200 with token on valid credentials', async () => {
    // Combined single query: user lookup with full profile
    mocks.mockQuery.mockResolvedValueOnce({
      recordset: [makeUserRecord({ Email: 'user@example.com' })],
    });

    const req = makeRequest({
      body: { email: 'user@example.com', password: 'correct-password' },
    });
    const res = await login(req, makeContext());
    expect(res.status).toBe(200);
    expect((res.jsonBody as Record<string, unknown>)?.success).toBe(true);
    const data = (res.jsonBody as Record<string, unknown>)?.data as Record<string, unknown>;
    expect(typeof data?.token).toBe('string');
    expect((data?.user as Record<string, unknown>)?.email).toBe('user@example.com');
  });
});

// ─── register ─────────────────────────────────────────────────────────────

describe('register()', () => {
  it('returns 400 when name is missing', async () => {
    const req = makeRequest({
      body: { name: '', email: 'a@b.com', password: 'longpassword' },
    });
    const res = await register(req, makeContext());
    expect(res.status).toBe(400);
  });

  it('returns 400 when email is missing', async () => {
    const req = makeRequest({ body: { name: 'Alice', email: '', password: 'longpassword' } });
    const res = await register(req, makeContext());
    expect(res.status).toBe(400);
  });

  it('returns 400 when email format is invalid', async () => {
    const req = makeRequest({
      body: { name: 'Alice', email: 'not-an-email', password: 'longpassword' },
    });
    const res = await register(req, makeContext());
    expect(res.status).toBe(400);
  });

  it('returns 400 when password is too short (< 8 chars)', async () => {
    const req = makeRequest({
      body: { name: 'Alice', email: 'alice@example.com', password: 'short' },
    });
    const res = await register(req, makeContext());
    expect(res.status).toBe(400);
  });

  it('returns 409 when email is already registered', async () => {
    // Email check query returns existing user
    mocks.mockQuery.mockResolvedValueOnce({ recordset: [{ Id: 'u_existing' }] });

    const req = makeRequest({
      body: { name: 'Alice', email: 'existing@example.com', password: 'password123' },
    });
    const res = await register(req, makeContext());
    expect(res.status).toBe(409);
  });

  it('returns 201 with token on successful registration', async () => {
    // Email check query: no existing user
    mocks.mockQuery.mockResolvedValueOnce({ recordset: [] });
    // INSERT query
    mocks.mockQuery.mockResolvedValueOnce({ recordset: [], rowsAffected: [1] });

    const req = makeRequest({
      body: { name: 'Alice', email: 'new@example.com', password: 'password123' },
    });
    const res = await register(req, makeContext());
    expect(res.status).toBe(201);
    const data = (res.jsonBody as Record<string, unknown>)?.data as Record<string, unknown>;
    expect(typeof data?.token).toBe('string');
    expect((data?.user as Record<string, unknown>)?.email).toBe('new@example.com');
  });

  it('stores a bcrypt-hashed password (never plaintext)', async () => {
    mocks.mockQuery.mockResolvedValueOnce({ recordset: [] });
    mocks.mockQuery.mockResolvedValueOnce({ recordset: [], rowsAffected: [1] });

    const req = makeRequest({
      body: { name: 'Bob', email: 'bob@example.com', password: 'mypassword123' },
    });
    await register(req, makeContext());

    // bcrypt.hash must have been called — password is never stored in plain text
    const bcrypt = await import('bcryptjs');
    expect(bcrypt.default.hash).toHaveBeenCalledWith('mypassword123', 10);
  });
});

// ─── insecure secret path ─────────────────────────────────────────────────

describe('insecure AUTH_SECRET guard', () => {
  it('login returns 503 when isAuthSecretInsecure is true', async () => {
    const authUtils = await import('../../utils/authUtils');
    (authUtils as unknown as Record<string, unknown>).isAuthSecretInsecure = true;

    const req = makeRequest({ body: { email: 'a@b.com', password: 'password123' } });
    const res = await login(req, makeContext());
    expect(res.status).toBe(503);

    // Restore for subsequent tests
    (authUtils as unknown as Record<string, unknown>).isAuthSecretInsecure = false;
  });

  it('register returns 503 when isAuthSecretInsecure is true', async () => {
    const authUtils = await import('../../utils/authUtils');
    (authUtils as unknown as Record<string, unknown>).isAuthSecretInsecure = true;

    const req = makeRequest({
      body: { name: 'A', email: 'a@b.com', password: 'password123' },
    });
    const res = await register(req, makeContext());
    expect(res.status).toBe(503);

    (authUtils as unknown as Record<string, unknown>).isAuthSecretInsecure = false;
  });
});

// ─── login rate limiting (BUG-005) ────────────────────────────────────────

describe('login() rate limiting', () => {
  it('returns 429 when rate limit is exceeded', async () => {
    mocks.mockCheckRateLimit.mockResolvedValueOnce({ allowed: false, remaining: 0, resetAt: Date.now() + 60000, storeType: 'memory' });

    const req = makeRequest({ body: { email: 'attacker@example.com', password: 'password' } });
    const res = await login(req, makeContext());
    expect(res.status).toBe(429);
  });

  it('does not expose sensitive info in 429 response', async () => {
    mocks.mockCheckRateLimit.mockResolvedValueOnce({ allowed: false, remaining: 0, resetAt: Date.now() + 60000, storeType: 'memory' });

    const req = makeRequest({ body: { email: 'attacker@example.com', password: 'password' } });
    const res = await login(req, makeContext());
    expect(res.status).toBe(429);
    const body = res.jsonBody as Record<string, unknown>;
    // Must have a generic error message; must not contain password or DB details
    expect(typeof body?.error).toBe('string');
    expect(JSON.stringify(body)).not.toContain('password');
  });

  it('builds rate-limit key from email and x-forwarded-for IP', async () => {
    // Allow the request so we can verify the key includes both email and IP
    mocks.mockCheckRateLimit.mockResolvedValueOnce({ allowed: true, remaining: 9, resetAt: Date.now() + 60000, storeType: 'memory' });
    // Return no user so login fails fast after the rate-limit check
    mocks.mockQuery.mockResolvedValueOnce({ recordset: [], rowsAffected: [0] });

    const req = makeRequest({
      body: { email: 'user@example.com', password: 'pass' },
      headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' },
    });
    await login(req, makeContext());

    expect(mocks.mockCheckRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({ identifier: 'login:user@example.com:1.2.3.4' })
    );
  });

  it('isolates rate-limit buckets by email+IP combination', async () => {
    // First identifier allowed; second identifier also allowed separately
    mocks.mockCheckRateLimit
      .mockResolvedValueOnce({ allowed: true, remaining: 9, resetAt: Date.now() + 60000, storeType: 'memory' })
      .mockResolvedValueOnce({ allowed: true, remaining: 9, resetAt: Date.now() + 60000, storeType: 'memory' });

    mocks.mockQuery.mockResolvedValue({ recordset: [], rowsAffected: [0] });

    const req1 = makeRequest({
      body: { email: 'user1@example.com', password: 'pass' },
      headers: { 'x-forwarded-for': '1.1.1.1' },
    });
    const req2 = makeRequest({
      body: { email: 'user2@example.com', password: 'pass' },
      headers: { 'x-forwarded-for': '2.2.2.2' },
    });

    const [res1, res2] = await Promise.all([
      login(req1, makeContext()),
      login(req2, makeContext()),
    ]);

    // Both should reach DB lookup (not 429)
    expect(res1.status).not.toBe(429);
    expect(res2.status).not.toBe(429);

    // Verify each call used its own distinct identifier
    const calls = mocks.mockCheckRateLimit.mock.calls;
    const ids = calls.map((c: unknown[]) => (c[0] as { identifier: string }).identifier);
    expect(ids[0]).toContain('user1@example.com');
    expect(ids[1]).toContain('user2@example.com');
    expect(ids[0]).not.toBe(ids[1]);
  });
});

// ─── DB error classification (BUG: login returned 500 for all DB errors) ─────

describe('login() DB error handling', () => {
  it('returns 503 with db_not_configured reason when DB is not configured', async () => {
    const { getPool } = await import('../../db');
    (getPool as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('Database not configured. Set SqlConnectionString or AZURE_SQL_CONNECTION_STRING')
    );

    const req = makeRequest({ body: { email: 'user@example.com', password: 'pass' } });
    const res = await login(req, makeContext());
    expect(res.status).toBe(503);
    const body = res.jsonBody as Record<string, unknown>;
    expect(body.reason).toBe('db_not_configured');
    expect(body.category).toBe('DB_NOT_CONFIGURED');
  });

  it('returns 503 with db_unavailable reason and resets pool on transient DB error', async () => {
    const { getPool, resetPool } = await import('../../db');
    const transientErr = new Error('ETIMEDOUT: Connection timed out');
    (getPool as ReturnType<typeof vi.fn>).mockRejectedValueOnce(transientErr);

    const req = makeRequest({ body: { email: 'user@example.com', password: 'pass' } });
    const res = await login(req, makeContext());
    expect(res.status).toBe(503);
    const body = res.jsonBody as Record<string, unknown>;
    expect(body.reason).toBe('db_unavailable');
    expect(body.category).toBe('DB_UNAVAILABLE');
    expect(resetPool).toHaveBeenCalled();
  });

  it('returns 500 for unexpected errors (not DB-related)', async () => {
    const { getPool } = await import('../../db');
    (getPool as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Something unexpected happened'));

    const req = makeRequest({ body: { email: 'user@example.com', password: 'pass' } });
    const res = await login(req, makeContext());
    expect(res.status).toBe(500);
  });

  it('does NOT call resetPool when DB_NOT_CONFIGURED (pool was never created)', async () => {
    const { getPool, resetPool } = await import('../../db');
    (resetPool as ReturnType<typeof vi.fn>).mockReset();
    (getPool as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('Database not configured. Set SqlConnectionString or AZURE_SQL_CONNECTION_STRING')
    );

    const req = makeRequest({ body: { email: 'user@example.com', password: 'pass' } });
    await login(req, makeContext());
    expect(resetPool).not.toHaveBeenCalled();
  });
});

describe('register() DB error handling', () => {
  it('returns 503 with db_not_configured reason when DB is not configured', async () => {
    const { getPool } = await import('../../db');
    (getPool as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('Database not configured. Set SqlConnectionString or AZURE_SQL_CONNECTION_STRING')
    );

    const req = makeRequest({ body: { name: 'Alice', email: 'alice@example.com', password: 'password123' } });
    const res = await register(req, makeContext());
    expect(res.status).toBe(503);
    const body = res.jsonBody as Record<string, unknown>;
    expect(body.reason).toBe('db_not_configured');
  });

  it('returns 503 and resets pool on transient DB error', async () => {
    const { getPool, resetPool } = await import('../../db');
    (getPool as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('ECONNREFUSED: DB server refused connection'));

    const req = makeRequest({ body: { name: 'Alice', email: 'alice@example.com', password: 'password123' } });
    const res = await register(req, makeContext());
    expect(res.status).toBe(503);
    const body = res.jsonBody as Record<string, unknown>;
    expect(body.reason).toBe('db_unavailable');
    expect(resetPool).toHaveBeenCalled();
  });
});

// ─── malformed request body (JSON parse errors) ───────────────────────────

describe('login() malformed request body', () => {
  it('returns 400 when request body is not valid JSON', async () => {
    const req = {
      json: vi.fn().mockRejectedValue(new SyntaxError('Unexpected end of JSON input')),
      headers: { get: (_name: string) => null },
      params: {},
      method: 'POST',
      url: 'http://localhost/api/test',
      query: new URLSearchParams(),
    } as unknown as import('@azure/functions').HttpRequest;

    const res = await login(req, makeContext());
    expect(res.status).toBe(400);
  });

  it('returns 400 (not 500) for any request.json() failure', async () => {
    const req = {
      json: vi.fn().mockRejectedValue(new TypeError('Failed to parse body')),
      headers: { get: (_name: string) => null },
      params: {},
      method: 'POST',
      url: 'http://localhost/api/test',
      query: new URLSearchParams(),
    } as unknown as import('@azure/functions').HttpRequest;

    const res = await login(req, makeContext());
    // Must not be 500 — parse failures are client errors, not server errors
    expect(res.status).toBe(400);
  });
});

describe('register() malformed request body', () => {
  it('returns 400 when request body is not valid JSON', async () => {
    const req = {
      json: vi.fn().mockRejectedValue(new SyntaxError('Unexpected end of JSON input')),
      headers: { get: (_name: string) => null },
      params: {},
      method: 'POST',
      url: 'http://localhost/api/test',
      query: new URLSearchParams(),
    } as unknown as import('@azure/functions').HttpRequest;

    const res = await register(req, makeContext());
    expect(res.status).toBe(400);
  });
});

// ─── AUTH_NOT_CONFIGURED error classification ─────────────────────────────

describe('login() AUTH_SECRET error classification', () => {
  it('returns 503 with auth_not_configured reason when AUTH_SECRET throws [authSecret] error', async () => {
    const { getPool } = await import('../../db');
    (getPool as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('[authSecret] AUTH_SECRET is not set. Configure it in Azure Application Settings: openssl rand -hex 32')
    );

    const req = makeRequest({ body: { email: 'user@example.com', password: 'pass' } });
    const res = await login(req, makeContext());
    expect(res.status).toBe(503);
    const body = res.jsonBody as Record<string, unknown>;
    expect(body.reason).toBe('auth_not_configured');
    expect(body.category).toBe('AUTH_NOT_CONFIGURED');
  });

  it('does NOT call resetPool for AUTH_NOT_CONFIGURED (pool unrelated to secret issue)', async () => {
    const { getPool, resetPool } = await import('../../db');
    (resetPool as ReturnType<typeof vi.fn>).mockReset();
    (getPool as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('[authSecret] AUTH_SECRET is too short (10 chars). Minimum 32 characters required.')
    );

    const req = makeRequest({ body: { email: 'user@example.com', password: 'pass' } });
    await login(req, makeContext());
    expect(resetPool).not.toHaveBeenCalled();
  });
});

// ─── DB_SCHEMA_ERROR classification (missing columns → 503, not 500) ─────────

describe('login() DB schema error classification', () => {
  it('returns 503 with db_schema_error reason when a SQL column is missing', async () => {
    // Simulates a production DB where VerificationStatus column was never migrated.
    const schemaErr = new sql.RequestError(
      "Invalid column name 'VerificationStatus'.",
      'EREQUEST'
    );
    mocks.mockQuery.mockRejectedValueOnce(schemaErr);

    const req = makeRequest({ body: { email: 'user@example.com', password: 'pass' } });
    const res = await login(req, makeContext());
    expect(res.status).toBe(503);
    const body = res.jsonBody as Record<string, unknown>;
    expect(body.reason).toBe('db_schema_error');
    expect(body.category).toBe('DB_SCHEMA_ERROR');
  });

  it('returns 503 with db_schema_error for Invalid object name (missing table)', async () => {
    const schemaErr = new sql.RequestError("Invalid object name 'Users'.", 'EREQUEST');
    mocks.mockQuery.mockRejectedValueOnce(schemaErr);

    const req = makeRequest({ body: { email: 'user@example.com', password: 'pass' } });
    const res = await login(req, makeContext());
    expect(res.status).toBe(503);
    const body = res.jsonBody as Record<string, unknown>;
    expect(body.reason).toBe('db_schema_error');
  });

  it('does NOT call resetPool for DB_SCHEMA_ERROR (pool is healthy)', async () => {
    const { resetPool } = await import('../../db');
    (resetPool as ReturnType<typeof vi.fn>).mockReset();
    const schemaErr = new sql.RequestError("Invalid column name 'IsDeleted'.", 'EREQUEST');
    mocks.mockQuery.mockRejectedValueOnce(schemaErr);

    const req = makeRequest({ body: { email: 'user@example.com', password: 'pass' } });
    await login(req, makeContext());
    expect(resetPool).not.toHaveBeenCalled();
  });

  it('returns 500 (UNEXPECTED) for a non-schema sql.RequestError', async () => {
    // A RequestError whose message does NOT match the schema-error pattern
    const otherErr = new sql.RequestError('Some unexpected SQL error occurred.', 'EREQUEST');
    mocks.mockQuery.mockRejectedValueOnce(otherErr);

    const req = makeRequest({ body: { email: 'user@example.com', password: 'pass' } });
    const res = await login(req, makeContext());
    expect(res.status).toBe(500);
  });
});

// ─── additional network error patterns → 503 ─────────────────────────────────

describe('login() extended network error classification', () => {
  it('returns 503 for "network-related" Azure SQL error', async () => {
    const { getPool } = await import('../../db');
    (getPool as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('A network-related or instance-specific error occurred while establishing a connection to SQL Server.')
    );

    const req = makeRequest({ body: { email: 'user@example.com', password: 'pass' } });
    const res = await login(req, makeContext());
    expect(res.status).toBe(503);
    const body = res.jsonBody as Record<string, unknown>;
    expect(body.category).toBe('DB_UNAVAILABLE');
  });

  it('returns 503 for "not allowed to access the server" Azure SQL firewall error', async () => {
    const { getPool } = await import('../../db');
    (getPool as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("Client with IP address '1.2.3.4' is not allowed to access the server. To enable access, use the Azure Portal.")
    );

    const req = makeRequest({ body: { email: 'user@example.com', password: 'pass' } });
    const res = await login(req, makeContext());
    expect(res.status).toBe(503);
    const body = res.jsonBody as Record<string, unknown>;
    expect(body.category).toBe('DB_UNAVAILABLE');
    expect(body.reason).toBe('db_unavailable');
  });

  it('returns 503 for "server was not found" Azure SQL error', async () => {
    const { getPool } = await import('../../db');
    (getPool as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('The server was not found or was not accessible.')
    );

    const req = makeRequest({ body: { email: 'user@example.com', password: 'pass' } });
    const res = await login(req, makeContext());
    expect(res.status).toBe(503);
  });
});

// ─── Users schema auto-migration (login / register) ───────────────────────

describe('login() Users schema auto-migration', () => {
  it('auto-migrates missing Users columns and proceeds to 401 (user not found)', async () => {
    const usersSchemaCheckMod = await import('../../utils/usersSchemaCheck');
    // Simulate outdated schema: VerificationStatus and IsDeleted are missing
    (usersSchemaCheckMod.checkUsersSchema as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      schemaOk: false,
      missingColumns: ['VerificationStatus', 'IsDeleted'],
    });
    (usersSchemaCheckMod.applyMissingUsersColumns as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      ['VerificationStatus', 'IsDeleted']
    );

    // DB query returns no user (email not found)
    mocks.mockQuery.mockResolvedValueOnce({ recordset: [], rowsAffected: [0] });

    const req = makeRequest({ body: { email: 'user@example.com', password: 'pass' } });
    const res = await login(req, makeContext());

    // Login should NOT return 503 — auto-migration ran, then query executed, user not found → 401
    expect(res.status).toBe(401);
    expect(usersSchemaCheckMod.applyMissingUsersColumns).toHaveBeenCalledWith(
      ['VerificationStatus', 'IsDeleted'],
      expect.any(Function)
    );
  });

  it('proceeds normally when Users schema is already up-to-date (no migration called)', async () => {
    const usersSchemaCheckMod = await import('../../utils/usersSchemaCheck');
    // Schema is healthy — applyMissingUsersColumns should NOT be called
    (usersSchemaCheckMod.checkUsersSchema as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      schemaOk: true,
      missingColumns: [],
    });

    mocks.mockQuery.mockResolvedValueOnce({ recordset: [], rowsAffected: [0] });

    const req = makeRequest({ body: { email: 'user@example.com', password: 'pass' } });
    await login(req, makeContext());

    expect(usersSchemaCheckMod.applyMissingUsersColumns).not.toHaveBeenCalled();
  });

  it('returns 503 (DB_SCHEMA_ERROR) when auto-migration itself fails', async () => {
    const { sql: sqlModule } = await vi.importActual<{ sql: typeof import('mssql') }>('mssql');
    const usersSchemaCheckMod = await import('../../utils/usersSchemaCheck');
    (usersSchemaCheckMod.checkUsersSchema as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      schemaOk: false,
      missingColumns: ['VerificationStatus'],
    });
    // applyMissingUsersColumns throws a schema error
    const schemaErr = new sql.RequestError("Invalid object name 'Users'.", 'EREQUEST');
    (usersSchemaCheckMod.applyMissingUsersColumns as ReturnType<typeof vi.fn>).mockRejectedValueOnce(schemaErr);

    const req = makeRequest({ body: { email: 'user@example.com', password: 'pass' } });
    const res = await login(req, makeContext());
    expect(res.status).toBe(503);
    const body = res.jsonBody as Record<string, unknown>;
    expect(body.reason).toBe('db_schema_error');
  });
});

describe('register() Users schema auto-migration', () => {
  it('auto-migrates missing Users columns and proceeds to 201 on successful registration', async () => {
    const usersSchemaCheckMod = await import('../../utils/usersSchemaCheck');
    (usersSchemaCheckMod.checkUsersSchema as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      schemaOk: false,
      missingColumns: ['IsDeleted'],
    });
    (usersSchemaCheckMod.applyMissingUsersColumns as ReturnType<typeof vi.fn>).mockResolvedValueOnce(['IsDeleted']);

    // Email check: no existing user
    mocks.mockQuery.mockResolvedValueOnce({ recordset: [] });
    // INSERT: success
    mocks.mockQuery.mockResolvedValueOnce({ recordset: [], rowsAffected: [1] });

    const req = makeRequest({
      body: { name: 'Alice', email: 'alice@example.com', password: 'password123' },
    });
    const res = await register(req, makeContext());
    expect(res.status).toBe(201);
    expect(usersSchemaCheckMod.applyMissingUsersColumns).toHaveBeenCalledWith(
      ['IsDeleted'],
      expect.any(Function)
    );
  });
});

// ─── refreshTokenHandler ─────────────────────────────────────────────────

describe('refreshTokenHandler()', () => {
  /** Helper: sign a JWT with the mocked secret for test requests. */
  function signTestToken(payload: Record<string, unknown>, secret = 'test-auth-secret-value-that-is-at-least-32-chars-long'): string {
    return jwt.sign(payload, secret, { algorithm: 'HS256', expiresIn: '7d' });
  }

  it('returns 401 when Authorization header is missing', async () => {
    const req = makeRequest({ headers: {} });
    const res = await refreshTokenHandler(req, makeContext());
    expect(res.status).toBe(401);
  });

  it('returns 401 when token is empty', async () => {
    const req = makeRequest({ headers: { authorization: 'Bearer ' } });
    const res = await refreshTokenHandler(req, makeContext());
    expect(res.status).toBe(401);
  });

  it('returns 200 with a new token for a valid token', async () => {
    const token = signTestToken({ uid: 'u_test_123' });
    const req = makeRequest({ headers: { authorization: `Bearer ${token}` } });
    const res = await refreshTokenHandler(req, makeContext());
    expect(res.status).toBe(200);
    const body = res.jsonBody as { success: boolean; data: { token: string } };
    expect(body.success).toBe(true);
    expect(body.data.token).toBeTruthy();
  });

  it('returns 200 for an expired token within the grace window (ignoreExpiration)', async () => {
    // Sign a token that expired 1 hour ago (within the 30-day grace window)
    const token = jwt.sign(
      { uid: 'u_test_123', iat: Math.floor(Date.now() / 1000) - 3600 },
      'test-auth-secret-value-that-is-at-least-32-chars-long',
      { algorithm: 'HS256', expiresIn: '-1h' }
    );
    const req = makeRequest({ headers: { authorization: `Bearer ${token}` } });
    const res = await refreshTokenHandler(req, makeContext());
    expect(res.status).toBe(200);
  });

  it('returns 401 with reason=invalid_token for a malformed token', async () => {
    const req = makeRequest({ headers: { authorization: 'Bearer not.a.valid.jwt' } });
    const res = await refreshTokenHandler(req, makeContext());
    expect(res.status).toBe(401);
    const body = res.jsonBody as { reason?: string };
    expect(body.reason).toBe('invalid_token');
  });

  it('returns 401 with reason=invalid_token when token was signed with a different secret', async () => {
    // Sign a token with a DIFFERENT secret than the mocked one — simulates a
    // stale token after server rebuild or secret rotation.
    const token = signTestToken({ uid: 'u_test_123' }, 'completely-different-secret-that-is-at-least-32-chars');
    const req = makeRequest({ headers: { authorization: `Bearer ${token}` } });
    const res = await refreshTokenHandler(req, makeContext());
    expect(res.status).toBe(401);
    const body = res.jsonBody as { reason?: string };
    expect(body.reason).toBe('invalid_token');
  });

  it('returns 401 with reason=invalid_token when token is missing uid claim', async () => {
    const token = signTestToken({ sub: 'u_test_123' }); // uid is missing
    const req = makeRequest({ headers: { authorization: `Bearer ${token}` } });
    const res = await refreshTokenHandler(req, makeContext());
    expect(res.status).toBe(401);
    const body = res.jsonBody as { reason?: string };
    expect(body.reason).toBe('invalid_token');
  });

  it('returns 401 with reason=token_too_old for a token older than grace window', async () => {
    // iat 100 days ago => beyond 7+30 day window
    const token = jwt.sign(
      { uid: 'u_test_123', iat: Math.floor(Date.now() / 1000) - 100 * 24 * 3600 },
      'test-auth-secret-value-that-is-at-least-32-chars-long',
      { algorithm: 'HS256' }
    );
    const req = makeRequest({ headers: { authorization: `Bearer ${token}` } });
    const res = await refreshTokenHandler(req, makeContext());
    expect(res.status).toBe(401);
    const body = res.jsonBody as { reason?: string };
    expect(body.reason).toBe('token_too_old');
  });

  it('returns 503 when isAuthSecretInsecure is true', async () => {
    const authUtils = await import('../../utils/authUtils');
    (authUtils as unknown as Record<string, unknown>).isAuthSecretInsecure = true;

    const token = signTestToken({ uid: 'u_test_123' });
    const req = makeRequest({ headers: { authorization: `Bearer ${token}` } });
    const res = await refreshTokenHandler(req, makeContext());
    expect(res.status).toBe(503);
    const body = res.jsonBody as { reason?: string };
    expect(body.reason).toBe('insecure_default_secret');
  });
});
