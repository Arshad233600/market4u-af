import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { getPool } from "../db";
import { isAuthSecretInsecure } from "../utils/authUtils";
import { getAuthSecretStrict } from "../utils/authSecret";
import { resolveStorageConnectionString } from "../blob";

const processStartTime = Date.now();

/**
 * Health Check Endpoint
 * Returns API, Database, and Auth configuration status.
 * Exposes only aggregate status — no env var names or values.
 */
export async function healthCheck(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const startTime = Date.now();

  // Auth secret aggregate status (no secret values exposed).
  // Uses getAuthSecretStrict() for missing/weak classification (same logic as auth endpoints)
  // and isAuthSecretInsecure for placeholder detection, so this status accurately reflects
  // whether login/register will succeed.
  let authSecret: 'ok' | 'missing' | 'insecure_default' | 'weak';
  try {
    getAuthSecretStrict(); // throws if missing or shorter than 32 chars (after trim)
    authSecret = isAuthSecretInsecure ? 'insecure_default' : 'ok';
  } catch (err) {
    const msg = (err as Error).message;
    authSecret = /AUTH_SECRET is not set/i.test(msg) ? 'missing' : 'weak';
  }

  // Blob storage aggregate status (no credentials exposed).
  // Uses resolveStorageConnectionString() — the same guard used by the upload
  // endpoint — so this status accurately reflects whether uploads will succeed.
  // Possible values:
  //  - "ok": valid credentials found (full connection string or individual vars)
  //  - "not_configured": no storage credentials at all
  //  - "placeholder": credentials are set but contain placeholder values from
  //    .env.example (e.g. AccountKey=your_account_key) — uploads will fail 503
  const storageConnStr = resolveStorageConnectionString();
  let blobStorage: 'ok' | 'not_configured' | 'placeholder';
  if (storageConnStr) {
    blobStorage = 'ok';
  } else {
    // Distinguish "nothing set" from "set but placeholder"
    const rawConnStr = process.env.AZURE_STORAGE_CONNECTION_STRING;
    const rawAccountName = process.env.STORAGE_ACCOUNT_NAME || process.env.AZURE_STORAGE_ACCOUNT_NAME;
    const rawAccountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY;
    blobStorage = (rawConnStr || (rawAccountName && rawAccountKey)) ? 'placeholder' : 'not_configured';
  }

  // Count configured critical env vars without exposing their names.
  // Uses resolveStorageConnectionString() for storage (not raw env var check)
  // so that placeholder values are correctly reported as not configured.
  const requiredVars = [
    process.env.AUTH_SECRET,
    process.env.SqlConnectionString || process.env.AZURE_SQL_CONNECTION_STRING,
    storageConnStr,   // null when missing or placeholder — same guard as upload endpoint
    process.env.AZURE_STORAGE_CONTAINER || process.env.STORAGE_CONTAINER_NAME,
  ];
  const configuredCount = requiredVars.filter(Boolean).length;
  const configuredVars = `${configuredCount}/4`;

  try {
    // Test database connection
    const pool = await getPool();
    await pool.request().query("SELECT 1");
    
    const latencyMs = Date.now() - startTime;
    const isHealthy = configuredCount === 4 && authSecret === 'ok' && blobStorage === 'ok';

    return {
      status: isHealthy ? 200 : 503,
      jsonBody: {
        success: isHealthy,
        data: {
          status: isHealthy ? "healthy" : "degraded",
          nowUtc: new Date().toISOString(),
          uptimeMs: Date.now() - processStartTime,
          latencyMs,
          database: "connected",
          authSecret,
          blobStorage,
          configuredVars,
          version: "1.0.0"
        }
      }
    };
  } catch (error: unknown) {
    const latencyMs = Date.now() - startTime;
    context.error("Health check failed", error);
    
    return {
      status: 503,
      jsonBody: {
        success: false,
        error: "Service unavailable",
        data: {
          status: "unhealthy",
          nowUtc: new Date().toISOString(),
          uptimeMs: Date.now() - processStartTime,
          latencyMs,
          database: "disconnected",
          authSecret,
          blobStorage,
          configuredVars,
        }
      }
    };
  }
}

app.http("health", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "health",
  handler: healthCheck
});
