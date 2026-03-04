/**
 * Tests for api/src/functions/upload.ts (BUG-003)
 *
 * Azure blob storage and auth utilities are mocked so no real network traffic
 * is generated.
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { HttpRequest, InvocationContext } from '@azure/functions';

// ─── hoisted mock state ───────────────────────────────────────────────────
const mocks = vi.hoisted(() => {
  const mockUploadData = vi.fn().mockResolvedValue({});
  const mockGetBlockBlobClient = vi.fn().mockReturnValue({
    uploadData: mockUploadData,
    url: 'https://storage.example.com/container/test-blob',
  });
  const mockContainerClient = { getBlockBlobClient: mockGetBlockBlobClient };
  return { mockUploadData, mockGetBlockBlobClient, mockContainerClient };
});

vi.mock('../../blob', () => ({
  getOrCreateBlobContainerClient: vi.fn().mockResolvedValue(mocks.mockContainerClient),
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
    url: 'http://localhost/api/upload',
    query: new URLSearchParams(),
  } as unknown as HttpRequest;
}

function makeContext(): InvocationContext {
  return { log: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() } as unknown as InvocationContext;
}

// Valid small JPEG base64 (1x1 pixel)
const VALID_JPEG_B64 = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AJQAB/9k=';

let upload: typeof import('../upload').upload;

beforeEach(async () => {
  mocks.mockUploadData.mockReset();
  mocks.mockUploadData.mockResolvedValue({});

  const authUtils = await import('../../utils/authUtils');
  vi.mocked(authUtils.validateToken).mockReturnValue({ userId: 'u_test_123', isAuthenticated: true });

  const mod = await import('../upload');
  upload = mod.upload;
});

// ─── auth checks ──────────────────────────────────────────────────────────

describe('upload() auth', () => {
  it('returns 401 when user is not authenticated', async () => {
    const authUtils = await import('../../utils/authUtils');
    vi.mocked(authUtils.validateToken).mockReturnValueOnce({
      userId: null,
      isAuthenticated: false,
      reason: 'missing_token',
    });

    const req = makeRequest({ body: { fileName: 'test.jpg', contentType: 'image/jpeg', base64: VALID_JPEG_B64 } });
    const res = await upload(req, makeContext());
    expect(res.status).toBe(401);
  });
});

// ─── MIME type validation (BUG-003) ───────────────────────────────────────

describe('upload() MIME type validation', () => {
  it('accepts image/jpeg', async () => {
    const req = makeRequest({ body: { fileName: 'photo.jpg', contentType: 'image/jpeg', base64: VALID_JPEG_B64 } });
    const res = await upload(req, makeContext());
    expect(res.status).toBe(200);
  });

  it('accepts image/png', async () => {
    // Minimal valid PNG base64 (1x1 transparent)
    const pngB64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const req = makeRequest({ body: { fileName: 'img.png', contentType: 'image/png', base64: pngB64 } });
    const res = await upload(req, makeContext());
    expect(res.status).toBe(200);
  });

  it('accepts image/webp', async () => {
    const webpB64 = 'UklGRlYAAABXRUJQVlA4IEoAAADQAQCdASoBAAEAAkA4JYgCdAEO/gHOAAD++P/////////////////////8';
    const req = makeRequest({ body: { fileName: 'img.webp', contentType: 'image/webp', base64: webpB64 } });
    const res = await upload(req, makeContext());
    expect(res.status).toBe(200);
  });

  it('rejects text/html (BUG-003)', async () => {
    const req = makeRequest({ body: { fileName: 'evil.html', contentType: 'text/html', base64: VALID_JPEG_B64 } });
    const res = await upload(req, makeContext());
    expect(res.status).toBe(400);
    expect((res.jsonBody as Record<string, unknown>)?.error).toBeTruthy();
  });

  it('rejects application/octet-stream', async () => {
    const req = makeRequest({ body: { fileName: 'malware.exe', contentType: 'application/octet-stream', base64: VALID_JPEG_B64 } });
    const res = await upload(req, makeContext());
    expect(res.status).toBe(400);
  });

  it('rejects missing contentType', async () => {
    const req = makeRequest({ body: { fileName: 'photo.jpg', base64: VALID_JPEG_B64 } });
    const res = await upload(req, makeContext());
    expect(res.status).toBe(400);
  });
});

// ─── file size validation (BUG-003) ──────────────────────────────────────

describe('upload() size validation', () => {
  it('rejects payloads larger than 10 MB (BUG-003)', async () => {
    // Generate base64 larger than 10 MB when decoded (10 MB = ~13.4 MB base64)
    const oversizedB64 = 'A'.repeat(14 * 1024 * 1024); // ~10.5 MB decoded
    const req = makeRequest({ body: { fileName: 'big.jpg', contentType: 'image/jpeg', base64: oversizedB64 } });
    const res = await upload(req, makeContext());
    expect(res.status).toBe(413);
  });

  it('accepts files under the 10 MB limit', async () => {
    const req = makeRequest({ body: { fileName: 'small.jpg', contentType: 'image/jpeg', base64: VALID_JPEG_B64 } });
    const res = await upload(req, makeContext());
    expect(res.status).toBe(200);
  });
});

// ─── base64 validation (BUG-003) ─────────────────────────────────────────

describe('upload() base64 validation', () => {
  it('rejects invalid base64 with 400 (BUG-003)', async () => {
    const req = makeRequest({ body: { fileName: 'test.jpg', contentType: 'image/jpeg', base64: 'not-valid-base64!!!@#$' } });
    const res = await upload(req, makeContext());
    expect(res.status).toBe(400);
    expect((res.jsonBody as Record<string, unknown>)?.error).toMatch(/base64/i);
  });

  it('rejects missing base64', async () => {
    const req = makeRequest({ body: { fileName: 'test.jpg', contentType: 'image/jpeg' } });
    const res = await upload(req, makeContext());
    expect(res.status).toBe(400);
  });
});

// ─── safe content-disposition (BUG-003) ──────────────────────────────────

describe('upload() content-disposition header', () => {
  it('sets blobContentDisposition to attachment on upload', async () => {
    const req = makeRequest({ body: { fileName: 'photo.jpg', contentType: 'image/jpeg', base64: VALID_JPEG_B64 } });
    await upload(req, makeContext());

    const uploadCall = mocks.mockUploadData.mock.calls[0];
    const options = uploadCall?.[1] as { blobHTTPHeaders?: Record<string, string> };
    expect(options?.blobHTTPHeaders?.blobContentDisposition).toMatch(/^attachment/);
  });

  it('sets contentType from allowlist (not from client)', async () => {
    const req = makeRequest({ body: { fileName: 'photo.jpg', contentType: 'image/jpeg', base64: VALID_JPEG_B64 } });
    await upload(req, makeContext());

    const uploadCall = mocks.mockUploadData.mock.calls[0];
    const options = uploadCall?.[1] as { blobHTTPHeaders?: Record<string, string> };
    expect(options?.blobHTTPHeaders?.blobContentType).toBe('image/jpeg');
  });
});

// ─── error handling (BUG-006) ─────────────────────────────────────────────

describe('upload() error handling', () => {
  it('does not expose internal error details on storage failure', async () => {
    mocks.mockUploadData.mockRejectedValueOnce(new Error('AccountKey=secret123; connection failed'));

    const req = makeRequest({ body: { fileName: 'photo.jpg', contentType: 'image/jpeg', base64: VALID_JPEG_B64 } });
    const res = await upload(req, makeContext());

    expect(res.status).toBe(500);
    expect(JSON.stringify(res.jsonBody)).not.toContain('AccountKey');
    expect(JSON.stringify(res.jsonBody)).not.toContain('secret123');
  });
});
