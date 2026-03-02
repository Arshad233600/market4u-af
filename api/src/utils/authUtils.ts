import { HttpRequest, HttpResponseInit } from "@azure/functions";
import { Buffer } from "buffer";
import jwt from "jsonwebtoken";
import { unauthorized, serviceUnavailable } from "./responses";

export const TOKEN_EXPIRATION_SECONDS = 7 * 24 * 60 * 60; // 7 days in seconds
export const TOKEN_EXPIRATION_MS = TOKEN_EXPIRATION_SECONDS * 1000;

// Single source of truth: AUTH_SECRET read once from process.env and trimmed.
// Trimming handles copy-paste whitespace from Azure Application Settings which
// would otherwise cause jwt.verify to fail for freshly-issued tokens (invalid_token).
const rawAuthSecret = process.env.AUTH_SECRET;
const AUTH_SECRET = rawAuthSecret !== undefined ? rawAuthSecret.trim() : undefined;

// Startup log and fail-fast: log length so sign and verify can be confirmed to match
console.log("AUTH_SECRET length:", AUTH_SECRET?.length);
if (!AUTH_SECRET) {
  console.error('[STARTUP] AUTH_SECRET is not configured. All authenticated endpoints will fail. Set AUTH_SECRET in Azure Application Settings: openssl rand -hex 32');
  throw new Error("[STARTUP] AUTH_SECRET is not configured. Set AUTH_SECRET in Azure Application Settings.");
}
// Inform the operator if the raw value had whitespace that was trimmed.
if (rawAuthSecret !== AUTH_SECRET) {
  console.warn("[STARTUP] WARNING: AUTH_SECRET had leading/trailing whitespace which has been trimmed automatically. Remove the whitespace from the Azure Application Setting to avoid confusion.");
}

/**
 * Returns the AUTH_SECRET. The module-level check above guarantees it is set.
 */
export function getAuthSecretOrThrow(): string {
  return AUTH_SECRET!;
}

/**
 * Known insecure placeholder values that must never be used in production.
 * These are the default values from local.settings.json.example and .env.example.
 * Tokens signed with a placeholder secret offer no real security and indicate
 * that AUTH_SECRET was never properly configured in Azure Application Settings.
 */
const INSECURE_SECRET_PLACEHOLDERS = new Set([
  'change-this-to-a-random-string-min-32-characters-long',
  'CHANGE_ME_IN_AZURE',
  'your-secret-key',
  'changeme',
  'secret',
]);

/** True when AUTH_SECRET is missing or is a known insecure placeholder value. */
export const isAuthSecretInsecure = !AUTH_SECRET || INSECURE_SECRET_PLACEHOLDERS.has(AUTH_SECRET);

if (isAuthSecretInsecure && AUTH_SECRET) {
  console.error('[STARTUP] AUTH_SECRET is set to a known insecure placeholder value. Rotate it immediately: openssl rand -hex 32');
}

export interface AuthResult {
    userId: string | null;
    isAuthenticated: boolean;
    reason?: string;
    requestId?: string;
}

/** Stores the most recent auth failure sample for the diagnostics/auth endpoint. */
export let lastAuthFailureSample: { requestId: string; reason: string; timestamp: string } | null = null;

export const validateToken = (request: HttpRequest): AuthResult => {
    const correlationId = request.headers.get('x-client-request-id') ?? 'no-correlation-id';
    const hasAuthHeader = Boolean(request.headers.get('authorization') || request.headers.get('Authorization'));
    const method = request.method;
    // Extract path from URL (strip query string) for safe logging
    let endpoint = 'unknown';
    try { endpoint = new URL(request.url).pathname; } catch { /* ignore */ }

    // 1. Check for Azure Static Web Apps Built-in Auth Header
    const swaHeader = request.headers.get("x-ms-client-principal");
    if (swaHeader) {
        try {
            const decoded = JSON.parse(Buffer.from(swaHeader, 'base64').toString('utf-8'));
            if (decoded && decoded.userId) {
                return { userId: decoded.userId, isAuthenticated: true, requestId: correlationId };
            }
        } catch (e) {
            console.error("SWA Auth Decode Error", e);
        }
    }

    const authHeader = request.headers.get("authorization") || request.headers.get("Authorization") || "";
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        const reason = "missing_token";
        lastAuthFailureSample = { requestId: correlationId, reason, timestamp: new Date().toISOString() };
        console.warn(`[auth] auth_failed reason=${reason} requestId=${correlationId} method=${method} endpoint=${endpoint} hasAuthHeader=${hasAuthHeader}`);
        return { userId: null, isAuthenticated: false, reason, requestId: correlationId };
    }

    // Use slice('Bearer '.length) to extract the token after "Bearer "; trim to handle any
    // accidental whitespace.
    const token = authHeader.slice('Bearer '.length).trim();
    if (!token) {
        const reason = "missing_token";
        lastAuthFailureSample = { requestId: correlationId, reason, timestamp: new Date().toISOString() };
        console.warn(`[auth] auth_failed reason=${reason} cause=empty_bearer_token requestId=${correlationId} method=${method} endpoint=${endpoint} hasAuthHeader=${hasAuthHeader}`);
        return { userId: null, isAuthenticated: false, reason, requestId: correlationId };
    }

    // Log token header.alg for debugging signature algorithm mismatches
    try {
        const headerB64 = token.split('.')[0];
        const headerJson = Buffer.from(headerB64, 'base64url').toString('utf-8');
        const header = JSON.parse(headerJson) as { alg?: string };
        console.log(`[Auth] token_header alg=${header.alg ?? 'missing'} requestId=${correlationId}`);
    } catch {
        console.warn(`[Auth] token_header parse_failed requestId=${correlationId}`);
    }

    // Guard: if AUTH_SECRET is an insecure placeholder, reject all token operations
    // with a 503-triggering reason rather than allowing authentication with a weak secret.
    if (isAuthSecretInsecure) {
        const reason = 'insecure_default_secret';
        lastAuthFailureSample = { requestId: correlationId, reason, timestamp: new Date().toISOString() };
        console.error(`[Auth] INSECURE_AUTH_SECRET detected during token validation reason=${reason} requestId=${correlationId} method=${method} endpoint=${endpoint}`);
        return { userId: null, isAuthenticated: false, reason, requestId: correlationId };
    }

    let secret: string;
    try {
      secret = getAuthSecretOrThrow();
    } catch (err) {
      const reason = 'missing_auth_secret';
      const msg = (err as Error).message;
      lastAuthFailureSample = { requestId: correlationId, reason, timestamp: new Date().toISOString() };
      console.warn(`[Auth] MISCONFIGURED_AUTH_SECRET token validation skipped: ${msg} reason=${reason} requestId=${correlationId} method=${method} endpoint=${endpoint} hasAuthHeader=${hasAuthHeader}`);
      return {
        userId: null,
        isAuthenticated: false,
        reason,
        requestId: correlationId,
      };
    }

    console.log("Verifying with secret length:", secret.length);

    try {
        // Verify using jsonwebtoken with HS256 — same algorithm used by jwt.sign in signToken()
        const payload = jwt.verify(token, secret, { algorithms: ['HS256'] }) as jwt.JwtPayload;

        if (!payload.uid) {
            const reason = "invalid_token";
            lastAuthFailureSample = { requestId: correlationId, reason, timestamp: new Date().toISOString() };
            console.warn(`[Auth] auth_failed reason=${reason} cause=missing_uid requestId=${correlationId} method=${method} endpoint=${endpoint} hasAuthHeader=${hasAuthHeader}`);
            return { userId: null, isAuthenticated: false, reason, requestId: correlationId };
        }

        return { userId: payload.uid as string, isAuthenticated: true, requestId: correlationId };
    } catch (err) {
        const verifyMsg = (err as Error).message;
        console.warn(`[Auth] jwt.verify error="${verifyMsg}" requestId=${correlationId} method=${method} endpoint=${endpoint} hasAuthHeader=${hasAuthHeader}`);
        const reason = err instanceof jwt.TokenExpiredError ? 'token_expired' : 'invalid_token';
        lastAuthFailureSample = { requestId: correlationId, reason, timestamp: new Date().toISOString() };
        return { userId: null, isAuthenticated: false, reason, requestId: correlationId };
    }
};

/** Auth reasons that indicate server misconfiguration rather than a bad client token. */
export const MISCONFIGURED_REASONS = new Set(['missing_auth_secret', 'insecure_default_secret', 'invalid_auth_secret']);

/**
 * Returns the appropriate HTTP error response for a failed AuthResult.
 * - Returns null when authentication succeeded (no error to return).
 * - Returns 503 when AUTH_SECRET is missing or insecure (server misconfiguration).
 * - Returns 401 for all other auth failures (bad/expired/missing token).
 *
 * Usage in handlers:
 *   const auth = validateToken(request);
 *   const authErr = authResponse(auth);
 *   if (authErr) return authErr;
 */
export function authResponse(auth: AuthResult): HttpResponseInit | null {
  if (auth.isAuthenticated) return null;
  if (auth.reason && MISCONFIGURED_REASONS.has(auth.reason)) {
    return serviceUnavailable(auth.reason);
  }
  return unauthorized('Unauthorized', auth.reason, auth.requestId);
}
