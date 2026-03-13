import { BlobServiceClient, ContainerClient } from "@azure/storage-blob";

/**
 * Detects well-known placeholder patterns that ship in example config files
 * (local.settings.json.example, .env.example).  A connection string that
 * matches any of these patterns is unusable even though it is non-empty, so
 * resolveStorageConnectionString() returns null to surface the clearer
 * "storage_not_configured" reason instead of letting the SDK attempt a
 * network connection that will always fail with a misleading
 * "storage_unavailable" 503.
 *
 * Patterns are intentionally conservative — we only reject strings that
 * obviously come from example files (uppercase placeholders, angle-bracket
 * templates, or suspiciously short AccountKey values).
 */
export function isPlaceholderConnectionString(connStr: string): boolean {
  // Reject exact placeholder AccountKey values used in example files
  if (/AccountKey=YOUR_KEY\b/i.test(connStr)) return true;
  if (/AccountKey=your_account_key\b/i.test(connStr)) return true;
  if (/AccountKey=<[^>]+>/i.test(connStr)) return true;

  // Reject placeholder AccountName values (angle-bracket or uppercase YOUR_)
  if (/AccountName=<[^>]+>/i.test(connStr)) return true;
  if (/AccountName=YOUR_/i.test(connStr)) return true;

  // Reject an AccountKey that is suspiciously short.
  // Real Azure Storage Account keys are 512-bit values encoded as base64,
  // producing an 88-character string.  Anything shorter than 20 characters
  // is certainly a placeholder or a typo.
  const keyMatch = connStr.match(/AccountKey=([^;]+)/i);
  if (keyMatch && keyMatch[1].trim().length < 20) return true;

  return false;
}

/**
 * Resolves an Azure Storage connection string from env vars.
 *
 * Priority order:
 *  1. AZURE_STORAGE_CONNECTION_STRING  (full connection string — preferred)
 *  2. STORAGE_ACCOUNT_NAME (or AZURE_STORAGE_ACCOUNT_NAME) + AZURE_STORAGE_ACCOUNT_KEY
 *     — synthesised into a connection string so the service works even when only
 *       the individual credential env vars are configured in Azure.
 *
 * Returns null when no usable credentials are found OR when the connection
 * string is a known placeholder value from an example config file.
 */
export function resolveStorageConnectionString(): string | null {
  const connStr = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (connStr && !isPlaceholderConnectionString(connStr)) return connStr;

  const accountName =
    process.env.STORAGE_ACCOUNT_NAME || process.env.AZURE_STORAGE_ACCOUNT_NAME;
  const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY;
  if (accountName && accountKey && !isPlaceholderConnectionString(`AccountKey=${accountKey}`)) {
    return `DefaultEndpointsProtocol=https;AccountName=${accountName};AccountKey=${accountKey};EndpointSuffix=core.windows.net`;
  }

  return null;
}

/**
 * Returns a ContainerClient configured from env vars.
 * NOTE: does NOT create the container.
 */
export function getBlobContainerClient(): ContainerClient {
  const conn = resolveStorageConnectionString();

  // Prefer AZURE_STORAGE_CONTAINER, fallback to STORAGE_CONTAINER_NAME, then "ads-images"
  const container =
    process.env.AZURE_STORAGE_CONTAINER ||
    process.env.STORAGE_CONTAINER_NAME ||
    "ads-images";

  if (!conn) throw new Error("Missing AZURE_STORAGE_CONNECTION_STRING (or STORAGE_ACCOUNT_NAME + AZURE_STORAGE_ACCOUNT_KEY)");

  const service = BlobServiceClient.fromConnectionString(conn);
  return service.getContainerClient(container);
}

/**
 * Ensures the container exists with blob-level public read access so that
 * uploaded images can be served directly to browsers via their Azure URLs.
 *
 * Public read access ("blob") is required because image URLs are stored in
 * the database and accessed directly by clients without authentication.
 * Azure returns HTTP 404 (not 403) for blobs in private containers when
 * accessed without credentials — which is the root cause of "blob not found"
 * errors in the browser even though the upload succeeded.
 *
 * Safe to call repeatedly (idempotent):
 *  - New containers are created with access: "blob".
 *  - Existing private containers are upgraded to "blob" access.
 *    If the storage account has "Allow Blob public access" disabled at the
 *    account level the upgrade call is silently skipped; the diagnostics
 *    endpoint will surface the misconfiguration instead.
 */
export async function getOrCreateBlobContainerClient(): Promise<ContainerClient> {
  const containerClient = getBlobContainerClient();

  // Create with blob-level public access so images are publicly readable.
  // "blob" access: individual blobs are public; container listing is still private.
  const createResult = await containerClient.createIfNotExists({ access: "blob" });

  if (!createResult.succeeded) {
    // Container already existed — ensure it has the correct public access level
    // so that images uploaded before this fix are also reachable by browsers.
    try {
      const props = await containerClient.getProperties();
      if (props.blobPublicAccess !== "blob") {
        await containerClient.setAccessPolicy("blob");
      }
    } catch {
      // Best-effort: ignore errors (e.g. account-level public access disabled).
      // The diagnostics endpoint will surface this misconfiguration.
    }
  }

  return containerClient;
}
