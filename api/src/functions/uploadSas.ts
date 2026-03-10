
import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { StorageSharedKeyCredential, generateBlobSASQueryParameters, BlobSASPermissions } from "@azure/storage-blob";
import * as appInsights from "applicationinsights";
import { validateToken, authResponse } from "../utils/authUtils";

// App Insights is initialized once in index.ts before all function modules are loaded.
const telemetry = appInsights.defaultClient;

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * Resolves Azure Storage account credentials at request time (not module load
 * time) so that missing env vars are detected per-request and return 503.
 */
function resolveStorageCredentials(): { accountName: string; accountKey: string; containerName: string } | null {
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    let accountName = process.env.STORAGE_ACCOUNT_NAME || process.env.AZURE_STORAGE_ACCOUNT_NAME;
    let accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY;

    if (connectionString && (!accountName || !accountKey)) {
        const nameMatch = connectionString.match(/AccountName=([^;]+)/);
        const keyMatch = connectionString.match(/AccountKey=([^;]+)/);
        if (nameMatch && !accountName) accountName = nameMatch[1];
        if (keyMatch && !accountKey) accountKey = keyMatch[1];
    }

    if (!accountName || !accountKey) return null;

    const containerName = process.env.AZURE_STORAGE_CONTAINER || process.env.STORAGE_CONTAINER_NAME || "product-images";
    return { accountName, accountKey, containerName };
}

export async function uploadSas(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    const startTime = Date.now();

    const auth = validateToken(request);
    const authErr = authResponse(auth);
    if (authErr) return authErr;

    // Guard: fail fast with 503 when storage credentials are not configured, so
    // the client can distinguish a permanent server configuration error from a
    // transient internal error and avoid pointless retries.
    const credentials = resolveStorageCredentials();
    if (!credentials) {
        context.warn('[uploadSas] storage_not_configured: AZURE_STORAGE_CONNECTION_STRING (or STORAGE_ACCOUNT_NAME / AZURE_STORAGE_ACCOUNT_KEY) is not set');
        telemetry?.trackException({ exception: new Error("Storage configuration missing") });
        return {
            status: 503,
            jsonBody: {
                error: 'Service unavailable',
                reason: 'storage_not_configured',
                category: 'STORAGE_NOT_CONFIGURED',
            },
        };
    }

    const { accountName, accountKey, containerName } = credentials;

    try {
        const body = await request.json() as any;
        const { fileName, fileType } = body || {};

        // 1. Validation
        if (!fileName) return { status: 400, jsonBody: { error: "نام فایل الزامی است." } };
        if (!ALLOWED_MIME_TYPES.includes(fileType)) {
            return { status: 400, jsonBody: { error: "فرمت فایل مجاز نیست. فقط JPG, PNG, WEBP." } };
        }

        // 2. Telemetry Tracking
        telemetry?.trackEvent({ 
            name: "UploadSasRequested", 
            properties: { fileType, fileName } 
        });

        const sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);
        const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}-${fileName.replace(/[^\w.-]/g, "_")}`;
        
        const permissions = new BlobSASPermissions();
        permissions.write = true;
        permissions.create = true;

        const expiryDate = new Date();
        expiryDate.setMinutes(expiryDate.getMinutes() + 5); // Short-lived SAS (5 mins)

        const sasToken = generateBlobSASQueryParameters({
            containerName,
            blobName: uniqueName,
            permissions,
            expiresOn: expiryDate,
            contentType: fileType
        }, sharedKeyCredential).toString();

        const sasUrl = `https://${accountName}.blob.core.windows.net/${containerName}/${uniqueName}?${sasToken}`;
        const blobUrl = `https://${accountName}.blob.core.windows.net/${containerName}/${uniqueName}`;

        telemetry?.trackMetric({ name: "SasGenerationDuration", value: Date.now() - startTime });

        return {
            status: 200,
            jsonBody: { sasUrl, blobUrl, uniqueName }
        };

    } catch (error: unknown) {
        telemetry?.trackException({ exception: error instanceof Error ? error : new Error(String(error)) });
        context.error(error);
        return { status: 500, jsonBody: { error: "خطا در تولید توکن امن آپلود" } };
    }
}

app.http('uploadSas', {
    methods: ['POST'],
    authLevel: 'anonymous',
    route: 'upload/sas-token', // Explicitly match client: /api/upload/sas-token
    handler: uploadSas
});
