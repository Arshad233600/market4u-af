
import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { getOrCreateBlobContainerClient } from "../blob";
import { validateToken, authResponse } from "../utils/authUtils";

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

        // Guard: fail fast with 503 (not 500) when blob storage is not configured,
        // so the client can distinguish a permanent server configuration error
        // from a transient internal error and avoid pointless retries.
        if (!process.env.AZURE_STORAGE_CONNECTION_STRING) {
            context.warn('[upload] storage_not_configured: AZURE_STORAGE_CONNECTION_STRING is not set');
            return {
                status: 503,
                jsonBody: {
                    error: 'Service unavailable',
                    reason: 'storage_not_configured',
                    category: 'STORAGE_NOT_CONFIGURED',
                },
            };
        }
        if (!process.env.AZURE_STORAGE_CONTAINER && !process.env.STORAGE_CONTAINER_NAME) {
            context.warn('[upload] storage_not_configured: AZURE_STORAGE_CONTAINER and STORAGE_CONTAINER_NAME are both unset');
            return {
                status: 503,
                jsonBody: {
                    error: 'Service unavailable',
                    reason: 'storage_not_configured',
                    category: 'STORAGE_NOT_CONFIGURED',
                },
            };
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
