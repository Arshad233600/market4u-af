import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { getPool } from "../db";
import { isAuthSecretInsecure, getAuthSecretOrThrow, lastAuthFailureSample } from "../utils/authUtils";
import { getBlobContainerClient } from "../blob";
import { checkRateLimit } from "../utils/rateLimit";
import { checkAdsSchema, AdsSchemaResult } from "../utils/schemaCheck";
import jwt from "jsonwebtoken";

/**
 * Diagnostics Endpoint — Forensic Audit (Phases 1–4)
 *
 * Performs a live configuration and connectivity check:
 *  - Phase 1: Environment variable inventory (aggregate only; no secret values)
 *  - Phase 2: AUTH_SECRET security validation + sign/verify round-trip test
 *  - Phase 3: Database handshake + schema sanity
 *  - Phase 4: Azure Blob Storage container reachability
 *
 * Route: GET /api/diagnostics
 * Auth:  Header: X-Diagnostics-Key = <DIAGNOSTICS_SECRET>
 *        Do NOT use ?key= query param.
 *        Without a valid key, only aggregate health status is returned.
 */
export async function diagnostics(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const startTime = Date.now();

  // ── Access control ────────────────────────────────────────────────────────
  // Require X-Diagnostics-Key header (never query param) to prevent secret leakage
  // in server logs, proxy logs, and browser history.
  const diagSecret = process.env.DIAGNOSTICS_SECRET;
  const providedKey = request.headers.get("x-diagnostics-key");
  const isAuthorized = diagSecret ? providedKey === diagSecret : false;

  // Extract client IP for rate limiting and audit logging
  const clientIp =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  if (!isAuthorized) {
    // Rate limit failed auth attempts: max 10 per 60 seconds per IP
    const rl = checkRateLimit({
      identifier: `diag_auth:${clientIp}`,
      maxRequests: 10,
      windowMs: 60 * 1000,
    });

    if (!rl.allowed) {
      context.warn(`[diagnostics] diagnostics.auth_failed rate_limited ip=${clientIp} timestamp=${new Date().toISOString()}`);
      return {
        status: 429,
        jsonBody: {
          success: false,
          error: "Too many failed authentication attempts. Try again later.",
        },
      };
    }

    context.warn(`[diagnostics] diagnostics.auth_failed ip=${clientIp} timestamp=${new Date().toISOString()}`);

    // Return only a minimal status without sensitive configuration details.
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
    return {
      status: overallStatus === "critical" ? 503 : 200,
      jsonBody: {
        success: overallStatus === "healthy",
        data: {
          overallStatus,
          timestamp: new Date().toISOString(),
          responseTimeMs: Date.now() - startTime,
          note: "Supply X-Diagnostics-Key header for full diagnostic details",
        },
      },
    };
  }

  const issues: DiagnosticIssue[] = [];

  // ── Phase 1: Environment Variable Inventory (aggregate only) ──────────────
  const requiredVarNames = [
    "AUTH_SECRET",
    "AZURE_SQL_CONNECTION_STRING",
    "AZURE_STORAGE_CONNECTION_STRING",
    "AZURE_STORAGE_CONTAINER",
  ] as const;
  // Also check aliased names
  const sqlConnAvailable =
    !!process.env.SqlConnectionString || !!process.env.AZURE_SQL_CONNECTION_STRING;
  const storageConnAvailable = !!process.env.AZURE_STORAGE_CONNECTION_STRING;
  const storageContainerAvailable =
    !!process.env.AZURE_STORAGE_CONTAINER || !!process.env.STORAGE_CONTAINER_NAME;
  // authSecretAvailable: true only when AUTH_SECRET is set AND is not a known placeholder.
  // isAuthSecretInsecure already encodes this logic (missing OR placeholder → insecure).
  const authSecretAvailable = !isAuthSecretInsecure;

  const configuredRequiredCount = [
    authSecretAvailable,
    sqlConnAvailable,
    storageConnAvailable,
    storageContainerAvailable,
  ].filter(Boolean).length;

  const envInventory = {
    requiredVarsConfigured: `${configuredRequiredCount}/${requiredVarNames.length}`,
    optionalVarsConfigured: [
      "APPLICATIONINSIGHTS_CONNECTION_STRING",
      "GEMINI_API_KEY",
    ].filter((v) => !!process.env[v]).length,
  };

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

  // ── Phase 2: AUTH_SECRET Validation + sign/verify round-trip ─────────────
  const authSecretStatus = isAuthSecretInsecure ? "insecure_default" : "configured";
  let authTestResult: { status: 'ok' | 'failed'; latencyMs: number; reason?: string } = {
    status: 'failed',
    latencyMs: 0,
    reason: 'not_run',
  };

  if (isAuthSecretInsecure) {
    const secretValue = process.env.AUTH_SECRET;
    const isPlaceholder = !!secretValue; // set but still insecure → known placeholder
    issues.push({
      phase: "Phase 2",
      issue: isPlaceholder
        ? "AUTH_SECRET is set to a known insecure placeholder value"
        : "AUTH_SECRET is missing (environment variable not set)",
      evidence: isPlaceholder
        ? "AUTH_SECRET matches a known placeholder from the example configuration files"
        : "AUTH_SECRET is empty or undefined",
      rootCause:
        "AUTH_SECRET was not configured with a real random secret in Azure Application settings. " +
        "Tokens signed by this deployment cannot be verified by any other deployment " +
        "that uses the real secret (or vice versa), causing immediate 401 → logout.",
      severity: "Critical",
      fix:
        "1. Generate a secure random secret: openssl rand -hex 32\n" +
        "2. Add AUTH_SECRET=<generated_value> in Azure → Static Web App → Configuration → Application settings\n" +
        "3. Also add AUTH_SECRET as a GitHub repository secret (Settings → Secrets → Actions → New repository secret)\n" +
        "4. Redeploy; existing sessions will need to re-login once",
    });
    authTestResult = { status: 'failed', latencyMs: 0, reason: 'insecure_default_secret' };
  } else {
    // Sign and verify a short-lived test token using the same jwt.sign/jwt.verify used in auth
    const authTestStart = Date.now();
    try {
      const secret = getAuthSecretOrThrow();
      const testToken = jwt.sign({ uid: '__diag_test__' }, secret, { algorithm: 'HS256', expiresIn: '1m' });
      jwt.verify(testToken, secret, { algorithms: ['HS256'] });
      authTestResult = {
        status: 'ok',
        latencyMs: Date.now() - authTestStart,
      };
    } catch (err) {
      authTestResult = {
        status: 'failed',
        latencyMs: Date.now() - authTestStart,
        reason: (err as Error).message,
      };
    }
  }

  // ── Phase 3: Database Handshake ───────────────────────────────────────────
  let dbStatus: "connected" | "disconnected" | "skipped" = "skipped";
  let dbDetails: Record<string, unknown> = {};
  let dbError: string | null = null;
  let adsSchema: AdsSchemaResult = { schemaOk: false, missingColumns: [] };

  if (sqlConnAvailable) {
    try {
      const pool = await getPool();

      // Verify connection (mssql does not support AbortSignal; rely on the pool's
      // requestTimeout setting which defaults to 30s — acceptable for diagnostics)
      await pool.request().query("SELECT 1 AS ping");
      dbStatus = "connected";

      // DB name and current user
      const metaResult = await pool.request().query("SELECT DB_NAME() AS dbName, SYSTEM_USER AS sysUser");
      const meta = metaResult.recordset[0] ?? {};

      // Check known tables or list top 5
      const knownTables = ['Users', 'Ads', 'AdImages', 'Favorites', 'Messages', 'WalletTransactions'];
      const schemaResult = await pool.request().query(`
        SELECT TABLE_NAME
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_TYPE = 'BASE TABLE'
          AND TABLE_NAME IN ('Users', 'Ads', 'AdImages', 'Favorites', 'Messages', 'WalletTransactions')
        ORDER BY TABLE_NAME
      `);
      const foundTables = schemaResult.recordset.map((r: { TABLE_NAME: string }) => r.TABLE_NAME);
      const missingTables = knownTables.filter((t) => !foundTables.includes(t));

      // Check Ads required columns (used by POST /api/ads)
      adsSchema = await checkAdsSchema();

      dbDetails = {
        dbName: meta.dbName,
        sysUser: meta.sysUser,
        foundTables,
        missingTables,
        adsSchemaOk: adsSchema.schemaOk,
        adsMissingColumns: adsSchema.missingColumns,
      };

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

      if (!adsSchema.schemaOk) {
        issues.push({
          phase: "Phase 3",
          issue: "Ads table missing required columns",
          evidence: `Missing columns: ${adsSchema.missingColumns.join(", ")}`,
          rootCause: "Schema migrations have not been applied to this database",
          severity: "Critical",
          fix: "Run migrations/2026_02_27_add_missing_ads_columns.sql against the Azure SQL database",
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
  let storageSampleBlob: string | null = null;

  if (storageConnAvailable && storageContainerAvailable) {
    try {
      const container = getBlobContainerClient();
      const exists = await container.exists();
      storageStatus = "ok";

      if (!exists) {
        issues.push({
          phase: "Phase 4",
          issue: "Storage container does not exist",
          evidence: "Container was not found in the storage account",
          rootCause: "Container was not created, or AZURE_STORAGE_CONTAINER points to wrong name",
          severity: "High",
          fix:
            "Create the container in Azure Portal → Storage Account → Containers, " +
            "or run: az storage container create --name product-images",
        });
      } else {
        // List at most 1 blob to confirm read access (do not dump names)
        let blobCount = 0;
        for await (const _blob of container.listBlobsFlat()) {
          blobCount++;
          storageSampleBlob = "found"; // signal: at least one blob exists; no name exposed
          break;
        }
        if (blobCount === 0) storageSampleBlob = "empty";
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
            status: configuredRequiredCount === requiredVarNames.length ? "ok" : "issues_found",
            inventory: envInventory,
          },
          phase2_auth: {
            status: authSecretStatus,
            authTest: authTestResult,
            recommendation:
              authSecretStatus === "insecure_default"
                ? "Set AUTH_SECRET in Azure Application settings (openssl rand -hex 32)"
                : "AUTH_SECRET is configured",
          },
          phase3_database: {
            status: dbStatus,
            ...(Object.keys(dbDetails).length > 0 && { details: dbDetails }),
            ...(dbError && { error: dbError }),
          },
          phase4_storage: {
            status: storageStatus,
            ...(storageSampleBlob && { sampleBlob: storageSampleBlob }),
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

app.http("diagnostics", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "diagnostics",
  handler: diagnostics,
});

/**
 * GET /api/diagnostics/auth
 * Lightweight auth-focused diagnostics endpoint (requires X-Diagnostics-Key header).
 * Returns: nowUtc, authSecretStatus, tokenVerification, lastFailureSample.
 * Never returns secret values.
 */
export async function diagnosticsAuth(
  request: HttpRequest,
  _context: InvocationContext
): Promise<HttpResponseInit> {
  const diagSecret = process.env.DIAGNOSTICS_SECRET;
  const providedKey = request.headers.get("x-diagnostics-key");
  if (!diagSecret || providedKey !== diagSecret) {
    return { status: 401, jsonBody: { error: "X-Diagnostics-Key required" } };
  }

  // Determine authSecretStatus
  const secret = process.env.AUTH_SECRET;
  const authSecretStatus: "ok" | "missing" = secret ? "ok" : "missing";

  // Perform a jwt sign/verify round-trip to check token verification
  let tokenVerification: "ok" | "fail" = "fail";
  if (authSecretStatus === "ok") {
    try {
      const testToken = jwt.sign({ uid: "__diag__" }, secret!, { algorithm: "HS256", expiresIn: "1m" });
      jwt.verify(testToken, secret!, { algorithms: ["HS256"] });
      tokenVerification = "ok";
    } catch {
      tokenVerification = "fail";
    }
  }

  return {
    status: 200,
    jsonBody: {
      nowUtc: new Date().toISOString(),
      authSecretStatus,
      tokenVerification,
      lastFailureSample: lastAuthFailureSample,
    },
  };
}

app.http("diagnosticsAuth", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "diagnostics/auth",
  handler: diagnosticsAuth,
});
