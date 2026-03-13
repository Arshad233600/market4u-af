/**
 * Tests for api/src/blob.ts
 *
 * Verifies that getOrCreateBlobContainerClient() creates the container with
 * blob-level public read access so that image URLs served to browsers are
 * reachable without authentication. Without public access, Azure returns HTTP
 * 404 (not 403) for unauthenticated blob GETs, causing ad images to fail to
 * load in the browser even though the upload succeeded.
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';

// ─── hoisted mock state ───────────────────────────────────────────────────
const mocks = vi.hoisted(() => {
  const mockCreateIfNotExists = vi.fn();
  const mockGetProperties = vi.fn();
  const mockSetAccessPolicy = vi.fn();
  const mockGetContainerClient = vi.fn();

  const mockContainerClient = {
    createIfNotExists: mockCreateIfNotExists,
    getProperties: mockGetProperties,
    setAccessPolicy: mockSetAccessPolicy,
  };

  mockGetContainerClient.mockReturnValue(mockContainerClient);

  const mockFromConnectionString = vi.fn().mockReturnValue({
    getContainerClient: mockGetContainerClient,
  });

  return {
    mockCreateIfNotExists,
    mockGetProperties,
    mockSetAccessPolicy,
    mockGetContainerClient,
    mockContainerClient,
    mockFromConnectionString,
  };
});

vi.mock('@azure/storage-blob', () => ({
  BlobServiceClient: {
    fromConnectionString: mocks.mockFromConnectionString,
  },
}));

let getOrCreateBlobContainerClient: typeof import('../blob').getOrCreateBlobContainerClient;
let getBlobContainerClient: typeof import('../blob').getBlobContainerClient;
let resolveStorageConnectionString: typeof import('../blob').resolveStorageConnectionString;
let isPlaceholderConnectionString: typeof import('../blob').isPlaceholderConnectionString;

// A valid-looking real connection string (AccountKey is 88 chars base64)
const REAL_CONN_STRING =
  'DefaultEndpointsProtocol=https;AccountName=market4ustorage01;AccountKey=dGVzdGtleXRlc3RrZXl0ZXN0a2V5dGVzdGtleXRlc3RrZXl0ZXN0a2V5dGVzdGtleXQ=;EndpointSuffix=core.windows.net';

beforeEach(async () => {
  mocks.mockCreateIfNotExists.mockReset();
  mocks.mockGetProperties.mockReset();
  mocks.mockSetAccessPolicy.mockReset();

  process.env.AZURE_STORAGE_CONNECTION_STRING = REAL_CONN_STRING;
  process.env.AZURE_STORAGE_CONTAINER = 'test-container';

  // Re-import module after mocks are set up
  vi.resetModules();
  const mod = await import('../blob');
  getOrCreateBlobContainerClient = mod.getOrCreateBlobContainerClient;
  getBlobContainerClient = mod.getBlobContainerClient;
  resolveStorageConnectionString = mod.resolveStorageConnectionString;
  isPlaceholderConnectionString = mod.isPlaceholderConnectionString;
});

// ─── isPlaceholderConnectionString ───────────────────────────────────────

describe('isPlaceholderConnectionString()', () => {
  it('returns false for a valid-looking real connection string', () => {
    expect(isPlaceholderConnectionString(REAL_CONN_STRING)).toBe(false);
  });

  it('detects YOUR_KEY placeholder (from local.settings.json.example)', () => {
    expect(
      isPlaceholderConnectionString(
        'DefaultEndpointsProtocol=https;AccountName=market4ustorage01;AccountKey=YOUR_KEY;EndpointSuffix=core.windows.net',
      ),
    ).toBe(true);
  });

  it('detects your_account_key placeholder (from .env.example) case-insensitively', () => {
    expect(
      isPlaceholderConnectionString(
        'DefaultEndpointsProtocol=https;AccountName=market4ustorage01;AccountKey=your_account_key;EndpointSuffix=core.windows.net',
      ),
    ).toBe(true);
  });

  it('detects angle-bracket AccountKey placeholder', () => {
    expect(
      isPlaceholderConnectionString(
        'DefaultEndpointsProtocol=https;AccountName=market4ustorage01;AccountKey=<your-storage-key>;EndpointSuffix=core.windows.net',
      ),
    ).toBe(true);
  });

  it('detects angle-bracket AccountName placeholder', () => {
    expect(
      isPlaceholderConnectionString(
        'DefaultEndpointsProtocol=https;AccountName=<account-name>;AccountKey=somevalidlongkeyvalue1234567890123456789012345678;EndpointSuffix=core.windows.net',
      ),
    ).toBe(true);
  });

  it('detects YOUR_ prefix in AccountName', () => {
    expect(
      isPlaceholderConnectionString(
        'DefaultEndpointsProtocol=https;AccountName=YOUR_ACCOUNT;AccountKey=somevalidlongkeyvalue1234567890123456789012345678;EndpointSuffix=core.windows.net',
      ),
    ).toBe(true);
  });

  it('detects suspiciously short AccountKey (< 20 chars)', () => {
    expect(
      isPlaceholderConnectionString(
        'DefaultEndpointsProtocol=https;AccountName=market4ustorage01;AccountKey=shortkey;EndpointSuffix=core.windows.net',
      ),
    ).toBe(true);
  });

  it('accepts AccountKey that is exactly 20 chars (minimum non-placeholder threshold)', () => {
    expect(
      isPlaceholderConnectionString(
        'DefaultEndpointsProtocol=https;AccountName=market4ustorage01;AccountKey=12345678901234567890;EndpointSuffix=core.windows.net',
      ),
    ).toBe(false);
  });
});

// ─── resolveStorageConnectionString ──────────────────────────────────────

describe('resolveStorageConnectionString()', () => {
  it('returns connection string when AZURE_STORAGE_CONNECTION_STRING is a real value', () => {
    process.env.AZURE_STORAGE_CONNECTION_STRING = REAL_CONN_STRING;
    expect(resolveStorageConnectionString()).toBe(REAL_CONN_STRING);
  });

  it('returns null when AZURE_STORAGE_CONNECTION_STRING is the YOUR_KEY placeholder', () => {
    process.env.AZURE_STORAGE_CONNECTION_STRING =
      'DefaultEndpointsProtocol=https;AccountName=market4ustorage01;AccountKey=YOUR_KEY;EndpointSuffix=core.windows.net';
    expect(resolveStorageConnectionString()).toBeNull();
  });

  it('returns null when AZURE_STORAGE_CONNECTION_STRING is the your_account_key placeholder', () => {
    process.env.AZURE_STORAGE_CONNECTION_STRING =
      'DefaultEndpointsProtocol=https;AccountName=market4ustorage01;AccountKey=your_account_key;EndpointSuffix=core.windows.net';
    expect(resolveStorageConnectionString()).toBeNull();
  });

  it('synthesises a connection string from STORAGE_ACCOUNT_NAME + AZURE_STORAGE_ACCOUNT_KEY when AZURE_STORAGE_CONNECTION_STRING is unset', () => {
    delete process.env.AZURE_STORAGE_CONNECTION_STRING;
    process.env.STORAGE_ACCOUNT_NAME = 'myaccount';
    process.env.AZURE_STORAGE_ACCOUNT_KEY = 'avalidlongkeyvaluefortesting1234567890123456789012345678';
    const result = resolveStorageConnectionString();
    expect(result).toContain('AccountName=myaccount');
    expect(result).toContain('AccountKey=avalidlongkeyvaluefortesting1234567890123456789012345678');
    delete process.env.STORAGE_ACCOUNT_NAME;
    delete process.env.AZURE_STORAGE_ACCOUNT_KEY;
  });

  it('synthesises a connection string from AZURE_STORAGE_ACCOUNT_NAME + AZURE_STORAGE_ACCOUNT_KEY', () => {
    delete process.env.AZURE_STORAGE_CONNECTION_STRING;
    process.env.AZURE_STORAGE_ACCOUNT_NAME = 'myaccount2';
    process.env.AZURE_STORAGE_ACCOUNT_KEY = 'avalidlongkeyvaluefortesting1234567890123456789012345678';
    const result = resolveStorageConnectionString();
    expect(result).toContain('AccountName=myaccount2');
    expect(result).toContain('AccountKey=avalidlongkeyvaluefortesting1234567890123456789012345678');
    delete process.env.AZURE_STORAGE_ACCOUNT_NAME;
    delete process.env.AZURE_STORAGE_ACCOUNT_KEY;
  });

  it('returns null when individual AZURE_STORAGE_ACCOUNT_KEY is a short placeholder', () => {
    delete process.env.AZURE_STORAGE_CONNECTION_STRING;
    process.env.STORAGE_ACCOUNT_NAME = 'myaccount';
    process.env.AZURE_STORAGE_ACCOUNT_KEY = 'shortkey';
    expect(resolveStorageConnectionString()).toBeNull();
    delete process.env.STORAGE_ACCOUNT_NAME;
    delete process.env.AZURE_STORAGE_ACCOUNT_KEY;
  });

  it('returns null when no credentials are configured', () => {
    delete process.env.AZURE_STORAGE_CONNECTION_STRING;
    delete process.env.STORAGE_ACCOUNT_NAME;
    delete process.env.AZURE_STORAGE_ACCOUNT_NAME;
    delete process.env.AZURE_STORAGE_ACCOUNT_KEY;
    expect(resolveStorageConnectionString()).toBeNull();
  });
});

// ─── getBlobContainerClient ───────────────────────────────────────────────

describe('getBlobContainerClient()', () => {
  it('throws when no storage credentials are configured', () => {
    delete process.env.AZURE_STORAGE_CONNECTION_STRING;
    delete process.env.STORAGE_ACCOUNT_NAME;
    delete process.env.AZURE_STORAGE_ACCOUNT_NAME;
    delete process.env.AZURE_STORAGE_ACCOUNT_KEY;
    expect(() => getBlobContainerClient()).toThrow(
      'Missing AZURE_STORAGE_CONNECTION_STRING',
    );
  });

  it('uses AZURE_STORAGE_CONTAINER env var for the container name', () => {
    process.env.AZURE_STORAGE_CONTAINER = 'my-container';
    getBlobContainerClient();
    expect(mocks.mockGetContainerClient).toHaveBeenCalledWith('my-container');
  });

  it('falls back to STORAGE_CONTAINER_NAME when AZURE_STORAGE_CONTAINER is unset', () => {
    delete process.env.AZURE_STORAGE_CONTAINER;
    process.env.STORAGE_CONTAINER_NAME = 'fallback-container';
    getBlobContainerClient();
    expect(mocks.mockGetContainerClient).toHaveBeenCalledWith('fallback-container');
    delete process.env.STORAGE_CONTAINER_NAME;
  });

  it('falls back to "ads-images" when both container env vars are unset', () => {
    delete process.env.AZURE_STORAGE_CONTAINER;
    delete process.env.STORAGE_CONTAINER_NAME;
    getBlobContainerClient();
    expect(mocks.mockGetContainerClient).toHaveBeenCalledWith('ads-images');
  });
});

// ─── getOrCreateBlobContainerClient ──────────────────────────────────────

describe('getOrCreateBlobContainerClient() — public access', () => {
  it('creates container with access:"blob" so images are publicly readable', async () => {
    // Simulate: container does not exist yet
    mocks.mockCreateIfNotExists.mockResolvedValueOnce({ succeeded: true });

    await getOrCreateBlobContainerClient();

    expect(mocks.mockCreateIfNotExists).toHaveBeenCalledWith({ access: 'blob' });
  });

  it('does NOT call setAccessPolicy when container is newly created', async () => {
    mocks.mockCreateIfNotExists.mockResolvedValueOnce({ succeeded: true });

    await getOrCreateBlobContainerClient();

    expect(mocks.mockSetAccessPolicy).not.toHaveBeenCalled();
  });

  it('upgrades existing private container to blob-level public access', async () => {
    // Simulate: container already exists (succeeded: false), currently private
    mocks.mockCreateIfNotExists.mockResolvedValueOnce({ succeeded: false });
    mocks.mockGetProperties.mockResolvedValueOnce({ blobPublicAccess: undefined });
    mocks.mockSetAccessPolicy.mockResolvedValueOnce({});

    await getOrCreateBlobContainerClient();

    expect(mocks.mockSetAccessPolicy).toHaveBeenCalledWith('blob');
  });

  it('does NOT call setAccessPolicy when container already has blob access', async () => {
    // Simulate: container already exists and is correctly configured
    mocks.mockCreateIfNotExists.mockResolvedValueOnce({ succeeded: false });
    mocks.mockGetProperties.mockResolvedValueOnce({ blobPublicAccess: 'blob' });

    await getOrCreateBlobContainerClient();

    expect(mocks.mockSetAccessPolicy).not.toHaveBeenCalled();
  });

  it('silently ignores setAccessPolicy errors (e.g. account-level public access disabled)', async () => {
    mocks.mockCreateIfNotExists.mockResolvedValueOnce({ succeeded: false });
    mocks.mockGetProperties.mockResolvedValueOnce({ blobPublicAccess: undefined });
    mocks.mockSetAccessPolicy.mockRejectedValueOnce(
      new Error('Public access is not permitted on this storage account.'),
    );

    // Should not throw — the error is swallowed so uploads still succeed
    await expect(getOrCreateBlobContainerClient()).resolves.toBeDefined();
  });

  it('silently ignores getProperties errors and skips setAccessPolicy', async () => {
    mocks.mockCreateIfNotExists.mockResolvedValueOnce({ succeeded: false });
    mocks.mockGetProperties.mockRejectedValueOnce(
      new Error('AuthorizationPermissionMismatch'),
    );

    await expect(getOrCreateBlobContainerClient()).resolves.toBeDefined();
    expect(mocks.mockSetAccessPolicy).not.toHaveBeenCalled();
  });

  it('returns the container client', async () => {
    mocks.mockCreateIfNotExists.mockResolvedValueOnce({ succeeded: true });

    const result = await getOrCreateBlobContainerClient();

    expect(result).toBe(mocks.mockContainerClient);
  });
});
