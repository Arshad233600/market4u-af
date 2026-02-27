import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { getPool } from "../db";
import { isAuthSecretInsecure } from "../utils/authUtils";
import { getBlobContainerClient } from "../blob";

/**
 * Diagnostics Endpoint — Forensic Audit (Phases 1–4)
 *
 * Performs a live configuration and connectivity check:
 *  - Phase 1: Environment variable inventory (no secret values exposed)
 *  - Phase 2: AUTH_SECRET security validation
 *  - Phase 3: Database handshake + schema sanity
 *  - Phase 4: Azure Blob Storage container reachability
 *
 * Returns a structured report useful for diagnosing the login→logout loop
 * and other production configuration issues.
 *
 * Route: GET /api/diagnostics?key=<DIAGNOSTICS_SECRET>
 * Auth:  Query-param secret (set DIAGNOSTICS_SECRET in Azure Application settings)
 *        Without a valid key, only aggregate health status is returned.
 */
export async function diagnostics(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const startTime = Date.now();

  // ── Access control ────────────────────────────────────────────────────────
  // Require the caller to supply the DIAGNOSTICS_SECRET query param (or fall
  // through to a redacted summary if it is not configured yet, so operators
  // can still verify the endpoint is up during initial setup).
  const diagSecret = process.env.DIAGNOSTICS_SECRET;
  const providedKey = request.query.get("key");
  const isAuthorized = diagSecret ? providedKey === diagSecret : false;

  if (!isAuthorized) {
    // Return only a minimal status without sensitive configuration details.
    const issues: DiagnosticIssue[] = [];
    let overallStatus = "unknown";
    try {
      if (process.env.SqlConnectionString || process.env.AZURE_SQL_CONNECTION_STRING) {
        const pool = await getPool();
        await pool.request().query("SELECT 1");
        overallStatus = isAuthSecretInsecure ? "degraded" : "healthy";
      } else {
        overallStatus = "critical";
      }
    } catch {
      overallStatus = "critical";
    }
    if (isAuthSecretInsecure) {
      issues.push({
        phase: "Phase 2",
        issue: "AUTH_SECRET uses insecure default value",
        evidence: "AUTH_SECRET === 'CHANGE_ME_IN_AZURE'",
        rootCause: "AUTH_SECRET not set in Azure Application settings",
        severity: "Critical",
        fix: "Set AUTH_SECRET in Azure → Static Web App → Configuration → Application settings",
      });
    }
    return {
      status: overallStatus === "critical" ? 503 : 200,
      jsonBody: {
        success: overallStatus === "healthy",
        data: {
          overallStatus,
          timestamp: new Date().toISOString(),
          responseTimeMs: Date.now() - startTime,
          note: "Supply ?key=<DIAGNOSTICS_SECRET> for full diagnostic details",
          issues,
        },
      },
    };
  }

  const issues: DiagnosticIssue[] = [];

  // ── Phase 1: Environment Variable Inventory ──────────────────────────────
  const envInventory = {
    AUTH_SECRET:                      envStatus("AUTH_SECRET"),
    SqlConnectionString:              envStatus("SqlConnectionString"),
    AZURE_SQL_CONNECTION_STRING:      envStatus("AZURE_SQL_CONNECTION_STRING"),
    AZURE_STORAGE_CONNECTION_STRING:  envStatus("AZURE_STORAGE_CONNECTION_STRING"),
    AZURE_STORAGE_CONTAINER:          envStatus("AZURE_STORAGE_CONTAINER"),
    STORAGE_CONTAINER_NAME:           envStatus("STORAGE_CONTAINER_NAME"),
    APPLICATIONINSIGHTS_CONNECTION_STRING: envStatus("APPLICATIONINSIGHTS_CONNECTION_STRING"),
    GEMINI_API_KEY:                   envStatus("GEMINI_API_KEY"),
  };

  const sqlConnAvailable =
    !!process.env.SqlConnectionString || !!process.env.AZURE_SQL_CONNECTION_STRING;
  const storageConnAvailable = !!process.env.AZURE_STORAGE_CONNECTION_STRING;
  const storageContainerAvailable =
    !!process.env.AZURE_STORAGE_CONTAINER || !!process.env.STORAGE_CONTAINER_NAME;

  if (!sqlConnAvailable) {
    issues.push({
      phase: "Phase 1",
      issue: "SQL connection string missing",
      evidence: "Neither SqlConnectionString nor AZURE_SQL_CONNECTION_STRING is set",
      rootCause: "Azure Application Setting not configured",
      severity: "Critical",
      fix: "Add SqlConnectionString in Azure Static Web App → Configuration → Application settings",
    });
  }

  if (!storageConnAvailable) {
    issues.push({
      phase: "Phase 1",
      issue: "Storage connection string missing",
      evidence: "AZURE_STORAGE_CONNECTION_STRING is not set",
      rootCause: "Azure Application Setting not configured",
      severity: "High",
      fix: "Add AZURE_STORAGE_CONNECTION_STRING in Azure Application settings",
    });
  }

  if (!storageContainerAvailable) {
    issues.push({
      phase: "Phase 1",
      issue: "Storage container name missing",
      evidence: "AZURE_STORAGE_CONTAINER and STORAGE_CONTAINER_NAME are both unset",
      rootCause: "Azure Application Setting not configured",
      severity: "High",
      fix: "Add AZURE_STORAGE_CONTAINER=product-images in Azure Application settings",
    });
  }

  // ── Phase 2: AUTH_SECRET Validation ──────────────────────────────────────
  const authSecretStatus = isAuthSecretInsecure ? "insecure_default" : "configured";

  if (isAuthSecretInsecure) {
    issues.push({
      phase: "Phase 2",
      issue: "AUTH_SECRET uses insecure default value",
      evidence: "AUTH_SECRET === 'CHANGE_ME_IN_AZURE' (environment variable not set)",
      rootCause:
        "AUTH_SECRET was not added to Azure Application settings. " +
        "Tokens signed by this deployment cannot be verified by any other deployment " +
        "that uses the real secret (or vice versa), causing immediate 401 → logout.",
      severity: "Critical",
      fix:
        "1. Generate a secure random secret: openssl rand -hex 32\n" +
        "2. Add AUTH_SECRET=<generated_value> in Azure → Static Web App → Configuration → Application settings\n" +
        "3. Redeploy; existing sessions will need to re-login once",
    });
  }

  // ── Phase 3: Database Handshake ───────────────────────────────────────────
  let dbStatus: "connected" | "disconnected" | "skipped" = "skipped";
  let dbDetails: Record<string, unknown> = {};
  let dbError: string | null = null;

  if (sqlConnAvailable) {
    try {
      const pool = await getPool();

      // Verify connection
      await pool.request().query("SELECT 1 AS ping");
      dbStatus = "connected";

      // Schema sanity — check critical tables exist
      const schemaResult = await pool.request().query(`
        SELECT TABLE_NAME
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_TYPE = 'BASE TABLE'
          AND TABLE_NAME IN ('Users', 'Ads', 'AdImages', 'Favorites', 'Messages', 'WalletTransactions')
        ORDER BY TABLE_NAME
      `);
      const foundTables = schemaResult.recordset.map((r: { TABLE_NAME: string }) => r.TABLE_NAME);
      const expectedTables = ["Ads", "AdImages", "Favorites", "Messages", "Users", "WalletTransactions"];
      const missingTables = expectedTables.filter((t) => !foundTables.includes(t));

      // Row count sanity
      const countResult = await pool.request().query(`
        SELECT
          (SELECT COUNT(*) FROM Users  WHERE IsDeleted = 0) AS activeUsers,
          (SELECT COUNT(*) FROM Ads    WHERE IsDeleted = 0) AS activeAds
      `);
      const counts = countResult.recordset[0] ?? {};

      dbDetails = { foundTables, missingTables, counts };

      if (missingTables.length > 0) {
        issues.push({
          phase: "Phase 3",
          issue: "Missing database tables",
          evidence: `Tables not found: ${missingTables.join(", ")}`,
          rootCause: "Schema migrations have not been applied to this database",
          severity: "Critical",
          fix: "Run database/schema.sql against the Azure SQL database",
        });
      }
    } catch (err: unknown) {
      dbStatus = "disconnected";
      dbError = err instanceof Error ? err.message : String(err);
      context.error("[Diagnostics] DB check failed", err);

      issues.push({
        phase: "Phase 3",
        issue: "Database connection failed",
        evidence: dbError,
        rootCause:
          "SQL firewall rule may be blocking the Azure Functions IP, or the connection string is incorrect",
        severity: "Critical",
        fix:
          "1. Verify SqlConnectionString in Azure Application settings\n" +
          "2. Add Azure Functions outbound IP to SQL Server firewall rules\n" +
          "3. Confirm SQL Server allows Azure Services (Azure Portal → SQL Server → Networking → Allow Azure services)",
      });
    }
  }

  // ── Phase 4: Storage Validation ───────────────────────────────────────────
  let storageStatus: "ok" | "error" | "skipped" = "skipped";
  let storageError: string | null = null;

  if (storageConnAvailable && storageContainerAvailable) {
    try {
      const container = getBlobContainerClient();
      const exists = await container.exists();
      storageStatus = "ok";

      if (!exists) {
        issues.push({
          phase: "Phase 4",
          issue: "Storage container does not exist",
          evidence: `Container '${container.containerName}' was not found in the storage account`,
          rootCause: "Container was not created, or AZURE_STORAGE_CONTAINER points to wrong name",
          severity: "High",
          fix:
            "Create the container in Azure Portal → Storage Account → Containers, " +
            "or run: az storage container create --name product-images",
        });
      }
    } catch (err: unknown) {
      storageStatus = "error";
      storageError = err instanceof Error ? err.message : String(err);
      context.error("[Diagnostics] Storage check failed", err);

      issues.push({
        phase: "Phase 4",
        issue: "Storage connectivity failed",
        evidence: storageError,
        rootCause: "AZURE_STORAGE_CONNECTION_STRING is invalid or network access is blocked",
        severity: "High",
        fix: "Verify AZURE_STORAGE_CONNECTION_STRING in Azure Application settings",
      });
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  const criticalCount = issues.filter((i) => i.severity === "Critical").length;
  const highCount = issues.filter((i) => i.severity === "High").length;
  const overallStatus =
    criticalCount > 0 ? "critical" : highCount > 0 ? "degraded" : "healthy";

  return {
    status: criticalCount > 0 ? 503 : 200,
    jsonBody: {
      success: overallStatus === "healthy",
      data: {
        overallStatus,
        timestamp: new Date().toISOString(),
        responseTimeMs: Date.now() - startTime,
        summary: {
          totalIssues: issues.length,
          criticalIssues: criticalCount,
          highIssues: highCount,
        },
        phases: {
          phase1_environment: {
            status: Object.values(envInventory).every((v) => v !== "missing") ? "ok" : "issues_found",
            inventory: envInventory,
          },
          phase2_auth: {
            status: authSecretStatus,
            recommendation:
              authSecretStatus === "insecure_default"
                ? "Set AUTH_SECRET in Azure Application settings (openssl rand -hex 32)"
                : "AUTH_SECRET is configured",
          },
          phase3_database: {
            status: dbStatus,
            ...(dbDetails && Object.keys(dbDetails).length > 0 && { details: dbDetails }),
            ...(dbError && { error: dbError }),
          },
          phase4_storage: {
            status: storageStatus,
            ...(storageError && { error: storageError }),
          },
        },
        issues,
      },
    },
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

interface DiagnosticIssue {
  phase: string;
  issue: string;
  evidence: string;
  rootCause: string;
  severity: "Critical" | "High" | "Medium" | "Low";
  fix: string;
}

/** Returns "set" or "missing" for a given env var name. Never returns the value itself. */
function envStatus(name: string): "set" | "missing" {
  return process.env[name] ? "set" : "missing";
}

app.http("diagnostics", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "diagnostics",
  handler: diagnostics,
});
