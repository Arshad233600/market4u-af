import { BlobServiceClient } from "@azure/storage-blob";

export function getBlobContainerClient() {
  const conn = process.env.AZURE_STORAGE_CONNECTION_STRING;
  const container = process.env.AZURE_STORAGE_CONTAINER || process.env.STORAGE_CONTAINER_NAME;

  if (!conn) throw new Error("Missing AZURE_STORAGE_CONNECTION_STRING");
  if (!container) throw new Error("Missing AZURE_STORAGE_CONTAINER or STORAGE_CONTAINER_NAME");

  const service = BlobServiceClient.fromConnectionString(conn);
  return service.getContainerClient(container);
}
