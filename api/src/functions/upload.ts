
import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { getOrCreateBlobContainerClient, resolveStorageConnectionString } from "../blob";
import { validateToken, authResponse } from "../utils/authUtils";

/**
 * Classifies a caught error from the blob storage upload path.
 *
 * - STORAGE_UNAVAILABLE (503): Azure authentication failure, network unreachable,
 *   or the storage service returned a 5xx — a transient or credential problem that
 *   the user cannot resolve by retrying.
 * - UNEXPECTED (500): anything else — a real code bug or unknown condition.
 *
 * The connection-string-missing case is caught earlier (before this function is
 * reached) and returns 503 with reason='storage_not_configured'.
 */
function classifyBlobError(err: unknown): { status: number; reason: string; category: string } {
  const msg = err instanceof Error ? err.message : String(err);

  // Network / DNS errors: storage account unreachable
  if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|network.*error|getaddrinfo/i.test(msg)) {
    return { status: 503, reason: 'storage_unavailable', category: 'STORAGE_UNAVAILABLE' };
  }

  // Azure SDK RestError: check statusCode property for auth / service failures
  const restErr = err as { statusCode?: number; code?: string };
  if (typeof restErr.statusCode === 'number') {
    if (restErr.statusCode === 401 || restErr.statusCode === 403) {
      return { status: 503, reason: 'storage_unavailable', category: 'STORAGE_UNAVAILABLE' };
    }
    if (restErr.statusCode === 503) {
      return { status: 503, reason: 'storage_unavailable', category: 'STORAGE_UNAVAILABLE' };
    }
  }

  // Azure error codes that indicate authentication / authorisation failure
  if (
    /AuthenticationFailed|AuthorizationFailure|AccountIsDisabled|InvalidAuthenticationInfo/i.test(msg)
  ) {
    return { status: 503, reason: 'storage_unavailable', category: 'STORAGE_UNAVAILABLE' };
  }

  return { status: 500, reason: 'unexpected', category: 'UNEXPECTED' };
}

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export async function upload(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    const auth = validateToken(request);
    const authErr = authResponse(auth);
    if (authErr || !auth.userId) {
        context.warn(`[upload] auth_failed reason=${auth.reason ?? "unknown"} requestId=${auth.requestId ?? "none"}`);
        return authErr ?? { status: 401, jsonBody: { error: "Unauthorized", category: "AUTH_REQUIRED", reason: auth.reason, requestId: auth.requestId } };
    }

    try {
        const body = await request.json() as any;
        const { fileName, contentType, base64 } = body || {};

        if (!fileName || !base64) {
            return { status: 400, jsonBody: { error: "fileName and base64 are required" } };
        }

        // Validate content type against allowlist
        if (!ALLOWED_MIME_TYPES.includes(contentType)) {
            return { status: 400, jsonBody: { error: "Unsupported file type. Allowed: image/jpeg, image/png, image/webp, image/gif" } };
        }

        // Validate base64 encoding (must be valid base64 characters)
        const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
        if (typeof base64 !== 'string' || !base64Regex.test(base64)) {
            return { status: 400, jsonBody: { error: "Invalid base64 encoding" } };
        }

        const buffer = Buffer.from(base64, "base64");

        // Enforce maximum file size
        if (buffer.byteLength > MAX_SIZE_BYTES) {
            return { status: 413, jsonBody: { error: "File too large. Maximum size is 10 MB" } };
        }

        // When blob storage credentials are not configured, fall back to returning
        // the image as a data URL instead of failing with 503.  This ensures the
        // upload flow works even when AZURE_STORAGE_CONNECTION_STRING (or the
        // individual STORAGE_ACCOUNT_NAME + AZURE_STORAGE_ACCOUNT_KEY credentials)
        // is not set or contains a placeholder value.
        //
        // The data URL is storable in the database (MainImageUrl / AdImages.Url
        // columns are NVARCHAR(MAX)) and renderable directly in <img> tags.
        if (!resolveStorageConnectionString()) {
            context.warn('[upload] storage_not_configured: using data URL fallback');
            const dataUrl = `data:${contentType};base64,${base64}`;
            if (dataUrl.length > 1_000_000) {
                context.warn(`[upload] data URL fallback is large (${Math.round(dataUrl.length / 1024)} KB). Consider configuring Azure Blob Storage.`);
            }
            return {
                status: 200,
                jsonBody: {
                    ok: true,
                    url: dataUrl,
                    name: fileName,
                    fallback: true,
                },
            };
        }

        if (!process.env.AZURE_STORAGE_CONTAINER && !process.env.STORAGE_CONTAINER_NAME) {
            context.warn('[upload] container_name_not_configured: using default container "ads-images"');
        }

        const containerClient = await getOrCreateBlobContainerClient();

        // Unique safe name to prevent collisions
        const safeName = `${crypto.randomUUID()}-${fileName.replace(/[^\w.-]/g, "_")}`;
        const blobClient = containerClient.getBlockBlobClient(safeName);

        await blobClient.uploadData(buffer, {
            blobHTTPHeaders: {
                // Content-type from validated allowlist only (never from client)
                blobContentType: contentType,
                // Force download behavior to prevent inline rendering / stored XSS
                blobContentDisposition: `attachment; filename="${safeName}"`,
            },
        });

        return {
            status: 200,
            jsonBody: {
                ok: true,
                url: blobClient.url,
                name: safeName,
            }
        };
    } catch (e: unknown) {
        const { status, reason, category } = classifyBlobError(e);
        if (status === 503) {
            // Log only the sanitized reason/category — never the raw error message
            // which could contain credentials (e.g. account key fragments from the SDK).
            context.warn(`[upload] storage_error reason=${reason} category=${category}`);
            return {
                status: 503,
                jsonBody: {
                    error: 'Service unavailable',
                    reason,
                    category,
                },
            };
        }
        context.error("Upload Error:", e);
        return { status: 500, jsonBody: { error: "Internal server error" } };
    }
}

app.http('upload', {
    methods: ['POST'],
    authLevel: 'anonymous',
    route: 'upload',
    handler: upload
});
