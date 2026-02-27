/** UUID v4 pattern for header validation. */
const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Generate a RFC 4122 UUID v4. */
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Return the value of the `x-client-request-id` header if it is a valid UUID v4,
 * otherwise generate a fresh server-side UUID.  This guards against clients
 * injecting arbitrary strings into tracing / logging pipelines.
 */
export function resolveRequestId(clientHeader: string | null): string {
  if (clientHeader && UUID_V4_RE.test(clientHeader)) {
    return clientHeader;
  }
  return generateUUID();
}
