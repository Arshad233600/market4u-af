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

beforeEach(async () => {
  mocks.mockCreateIfNotExists.mockReset();
  mocks.mockGetProperties.mockReset();
  mocks.mockSetAccessPolicy.mockReset();

  process.env.AZURE_STORAGE_CONNECTION_STRING =
    'DefaultEndpointsProtocol=https;AccountName=test;AccountKey=dGVzdA==;EndpointSuffix=core.windows.net';
  process.env.AZURE_STORAGE_CONTAINER = 'test-container';

  // Re-import module after mocks are set up
  vi.resetModules();
  const mod = await import('../blob');
  getOrCreateBlobContainerClient = mod.getOrCreateBlobContainerClient;
  getBlobContainerClient = mod.getBlobContainerClient;
  resolveStorageConnectionString = mod.resolveStorageConnectionString;
});

// ─── resolveStorageConnectionString ──────────────────────────────────────

describe('resolveStorageConnectionString()', () => {
  it('returns connection string when AZURE_STORAGE_CONNECTION_STRING is set', () => {
    const conn = 'DefaultEndpointsProtocol=https;AccountName=test;AccountKey=dGVzdA==;EndpointSuffix=core.windows.net';
    process.env.AZURE_STORAGE_CONNECTION_STRING = conn;
    expect(resolveStorageConnectionString()).toBe(conn);
  });

  it('synthesises a connection string from STORAGE_ACCOUNT_NAME + AZURE_STORAGE_ACCOUNT_KEY when AZURE_STORAGE_CONNECTION_STRING is unset', () => {
    delete process.env.AZURE_STORAGE_CONNECTION_STRING;
    process.env.STORAGE_ACCOUNT_NAME = 'myaccount';
    process.env.AZURE_STORAGE_ACCOUNT_KEY = 'mykey123';
    const result = resolveStorageConnectionString();
    expect(result).toContain('AccountName=myaccount');
    expect(result).toContain('AccountKey=mykey123');
    delete process.env.STORAGE_ACCOUNT_NAME;
    delete process.env.AZURE_STORAGE_ACCOUNT_KEY;
  });

  it('synthesises a connection string from AZURE_STORAGE_ACCOUNT_NAME + AZURE_STORAGE_ACCOUNT_KEY', () => {
    delete process.env.AZURE_STORAGE_CONNECTION_STRING;
    process.env.AZURE_STORAGE_ACCOUNT_NAME = 'myaccount2';
    process.env.AZURE_STORAGE_ACCOUNT_KEY = 'mykey456';
    const result = resolveStorageConnectionString();
    expect(result).toContain('AccountName=myaccount2');
    delete process.env.AZURE_STORAGE_ACCOUNT_NAME;
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
