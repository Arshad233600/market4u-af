import { BlobServiceClient, ContainerClient } from "@azure/storage-blob";

/**
 * Returns a ContainerClient configured from env vars.
 * NOTE: does NOT create the container.
 */
export function getBlobContainerClient(): ContainerClient {
  const conn = process.env.AZURE_STORAGE_CONNECTION_STRING;

  // Prefer AZURE_STORAGE_CONTAINER, fallback to STORAGE_CONTAINER_NAME, then "product-images"
  const container =
    process.env.AZURE_STORAGE_CONTAINER ||
    process.env.STORAGE_CONTAINER_NAME ||
    "product-images";

  if (!conn) throw new Error("Missing AZURE_STORAGE_CONNECTION_STRING");

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
