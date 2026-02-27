import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { getPool } from "../db";

const processStartTime = Date.now();

/**
 * Health Check Endpoint
 * Returns API, Database, and Auth configuration status.
 * Exposes only aggregate status — no env var names or values.
 */
export async function healthCheck(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const startTime = Date.now();

  // Auth secret aggregate status (no secret values exposed)
  const authSecretValue = process.env.AUTH_SECRET;
  let authSecret: 'ok' | 'missing' | 'insecure_default' | 'weak';
  if (!authSecretValue || authSecretValue.trim() === '') {
    authSecret = 'missing';
  } else if (authSecretValue === 'CHANGE_ME_IN_AZURE') {
    authSecret = 'insecure_default';
  } else if (authSecretValue.length < 32) {
    authSecret = 'weak';
  } else {
    authSecret = 'ok';
  }

  // Count configured critical env vars without exposing their names
  const requiredVars = [
    process.env.AUTH_SECRET,
    process.env.SqlConnectionString || process.env.AZURE_SQL_CONNECTION_STRING,
    process.env.AZURE_STORAGE_CONNECTION_STRING,
    process.env.AZURE_STORAGE_CONTAINER || process.env.STORAGE_CONTAINER_NAME,
  ];
  const configuredCount = requiredVars.filter(Boolean).length;
  const configuredVars = `${configuredCount}/4`;

  try {
    // Test database connection
    const pool = await getPool();
    await pool.request().query("SELECT 1");
    
    const latencyMs = Date.now() - startTime;
    const isHealthy = configuredCount === 4 && authSecret === 'ok';

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
