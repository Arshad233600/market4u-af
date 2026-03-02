import { BlobServiceClient, ContainerClient } from "@azure/storage-blob";

/**
 * Returns a ContainerClient configured from env vars.
 * NOTE: does NOT create the container.
 */
export function getBlobContainerClient(): ContainerClient {
  const conn = process.env.AZURE_STORAGE_CONNECTION_STRING;

  // Prefer AZURE_STORAGE_CONTAINER, fallback to STORAGE_CONTAINER_NAME
  const container =
    process.env.AZURE_STORAGE_CONTAINER || process.env.STORAGE_CONTAINER_NAME;

  if (!conn) throw new Error("Missing AZURE_STORAGE_CONNECTION_STRING");
  if (!container)
    throw new Error("Missing AZURE_STORAGE_CONTAINER or STORAGE_CONTAINER_NAME");

  const service = BlobServiceClient.fromConnectionString(conn);
  return service.getContainerClient(container);
}

/**
 * Ensures the container exists (idempotent). Safe to call repeatedly.
 */
export async function getOrCreateBlobContainerClient(): Promise<ContainerClient> {
  const containerClient = getBlobContainerClient();

  // This will NOT throw "ContainerAlreadyExists"
  await containerClient.createIfNotExists();

  return containerClient;
}
