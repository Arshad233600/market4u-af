
import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { getOrCreateBlobContainerClient } from "../blob";
import { validateToken } from "../utils/authUtils";

export async function upload(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    // Defensive auth check: always return 401 for any auth failure (never 503).
    // Using authResponse() here would return 503 when AUTH_SECRET is misconfigured,
    // causing spurious "Service Unavailable" errors instead of a clear "Unauthorized".
    const auth = validateToken(request);
    if (!auth.isAuthenticated || !auth.userId) {
        context.warn(`[upload] unauthorized reason=${auth.reason ?? "unknown"} requestId=${auth.requestId ?? "none"}`);
        return { status: 401, jsonBody: { error: "Unauthorized", reason: auth.reason, requestId: auth.requestId } };
    }

    try {
        const body = await request.json() as any;
        const { fileName, contentType, base64 } = body || {};
        
        if (!fileName || !base64) {
            return { status: 400, body: "fileName and base64 are required" };
        }

        const buffer = Buffer.from(base64, "base64");
        const containerClient = await getOrCreateBlobContainerClient();

        // Unique safe name to prevent collisions
        const safeName = `${crypto.randomUUID()}-${fileName.replace(/[^\w.-]/g, "_")}`;
        const blobClient = containerClient.getBlockBlobClient(safeName);

        await blobClient.uploadData(buffer, {
            blobHTTPHeaders: { blobContentType: contentType || "application/octet-stream" },
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
        const errorMessage = e instanceof Error ? e.message : String(e);
        return { status: 500, body: errorMessage };
    }
}

app.http('upload', {
    methods: ['POST'],
    authLevel: 'anonymous',
    route: 'upload',
    handler: upload
});
