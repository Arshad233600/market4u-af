import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { getPool } from "../db";
import { isAuthSecretInsecure } from "../utils/authUtils";

/**
 * Health Check Endpoint
 * Returns API, Database, and Auth configuration status.
 * Exposes only aggregate status — no env var names or values.
 */
export async function healthCheck(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const startTime = Date.now();

  // Auth configuration check (no secrets exposed)
  const authStatus = isAuthSecretInsecure
    ? "misconfigured_insecure_default"
    : "ok";

  // Count missing critical env vars without exposing their names
  const criticalVarsMissing = [
    process.env.AUTH_SECRET,
    process.env.SqlConnectionString || process.env.AZURE_SQL_CONNECTION_STRING,
    process.env.AZURE_STORAGE_CONNECTION_STRING,
    process.env.AZURE_STORAGE_CONTAINER || process.env.STORAGE_CONTAINER_NAME,
  ].filter((v) => !v).length;

  try {
    // Test database connection
    const pool = await getPool();
    await pool.request().query("SELECT 1");
    
    const responseTime = Date.now() - startTime;
    const isHealthy = criticalVarsMissing === 0 && authStatus === "ok";

    return {
      status: isHealthy ? 200 : 503,
      jsonBody: {
        success: isHealthy,
        data: {
          status: isHealthy ? "healthy" : "degraded",
          timestamp: new Date().toISOString(),
          responseTime: `${responseTime}ms`,
          database: "connected",
          auth: authStatus,
          configuredVars: 4 - criticalVarsMissing,
          requiredVars: 4,
          version: "1.0.0"
        }
      }
    };
  } catch (error: unknown) {
    const responseTime = Date.now() - startTime;
    context.error("Health check failed", error);
    
    return {
      status: 503,
      jsonBody: {
        success: false,
        error: "Service unavailable",
        data: {
          status: "unhealthy",
          timestamp: new Date().toISOString(),
          responseTime: `${responseTime}ms`,
          database: "disconnected",
          auth: authStatus,
          configuredVars: 4 - criticalVarsMissing,
          requiredVars: 4,
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
