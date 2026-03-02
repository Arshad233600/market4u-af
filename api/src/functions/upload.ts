
import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { getOrCreateBlobContainerClient } from "../blob";

export async function upload(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
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
    handler: upload
});
