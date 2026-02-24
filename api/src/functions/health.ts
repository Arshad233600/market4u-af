import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { getPool } from "../db";

/**
 * Health Check Endpoint
 * Returns API and Database connection status
 */
export async function healthCheck(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const startTime = Date.now();
  
  try {
    // Test database connection
    const pool = await getPool();
    await pool.request().query("SELECT 1");
    
    const responseTime = Date.now() - startTime;
    
    return {
      status: 200,
      jsonBody: {
        success: true,
        data: {
          status: "healthy",
          timestamp: new Date().toISOString(),
          responseTime: `${responseTime}ms`,
          database: "connected",
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
          database: "disconnected"
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
