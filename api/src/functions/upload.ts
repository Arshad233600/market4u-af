
import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { BlobServiceClient } from "@azure/storage-blob";

export async function upload(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    try {
        const conn = process.env.AZURE_STORAGE_CONNECTION_STRING;
        const containerName = process.env.STORAGE_CONTAINER_NAME || "ads-images";

        if (!conn) {
            return { status: 500, body: "Missing AZURE_STORAGE_CONNECTION_STRING" };
        }

        const body = await request.json() as any;
        const { fileName, contentType, base64 } = body || {};
        
        if (!fileName || !base64) {
            return { status: 400, body: "fileName and base64 are required" };
        }

        const buffer = Buffer.from(base64, "base64");
        const blobServiceClient = BlobServiceClient.fromConnectionString(conn);
        const containerClient = blobServiceClient.getContainerClient(containerName);
        await containerClient.createIfNotExists();

        // Safe name
        const safeName = fileName.replace(/[^\w.-]/g, "_");
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
