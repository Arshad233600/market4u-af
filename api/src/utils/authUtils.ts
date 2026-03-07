import { HttpRequest, HttpResponseInit } from "@azure/functions";
import { Buffer } from "buffer";
import jwt from "jsonwebtoken";
import { unauthorized, serviceUnavailable } from "./responses";
import { getAuthSecretStrict, getSecretFingerprint } from "./authSecret";

export const TOKEN_EXPIRATION_SECONDS = 7 * 24 * 60 * 60; // 7 days in seconds
export const TOKEN_EXPIRATION_MS = TOKEN_EXPIRATION_SECONDS * 1000;

// Single source of truth: AUTH_SECRET is always obtained via getAuthSecretStrict()
// which reads process.env.AUTH_SECRET, trims whitespace, and validates length >= 32.
// We evaluate it once at startup to log diagnostics and populate isAuthSecretInsecure.
let _startupSecret: string | undefined;
let _startupFingerprint: string | undefined;
try {
  _startupSecret = getAuthSecretStrict();
  _startupFingerprint = getSecretFingerprint(_startupSecret);
  console.log(
    `[STARTUP] AUTH_SECRET configured: secretLength=${_startupSecret.length} secretFingerprint=${_startupFingerprint}`
  );
} catch (err) {
  // Log a clear error but do NOT throw here — a module-level throw crashes all
  // Azure Functions (not just auth ones).  Individual auth endpoints guard via
  // isAuthSecretInsecure and return 503 when the secret is missing or too short.
  console.error(
    "[STARTUP] AUTH_SECRET is not configured or too short. All authenticated endpoints will return 503.",
    (err as Error).message
  );
}

/**
 * Returns the AUTH_SECRET via getAuthSecretStrict(), or throws if it is not
 * configured or too short. Callers should guard with isAuthSecretInsecure first.
 */
export function getAuthSecretOrThrow(): string {
  return getAuthSecretStrict();
}

/**
 * Known insecure placeholder values that must never be used in production.
 * These are the default values from .env.example and api/.env.example.
 * Tokens signed with a placeholder secret offer no real security and indicate
 * that AUTH_SECRET was never properly configured in Azure Application Settings.
 * Note: local.settings.json.example uses a different dev-only default that is
 * intentionally excluded from this list so local development works out of the box.
 */
const INSECURE_SECRET_PLACEHOLDERS = new Set([
  'change-this-to-a-random-string-min-32-characters-long',
  'CHANGE_ME_IN_AZURE',
  'your-secret-key',
  'your-secret-key-min-32-chars-long',
  'dev-local-replace-before-deploying-to-azure-production',
  'changeme',
  'secret',
]);

/** True when AUTH_SECRET is missing, too short, or is a known insecure placeholder value. */
export const isAuthSecretInsecure =
  !_startupSecret || INSECURE_SECRET_PLACEHOLDERS.has(_startupSecret);

if (isAuthSecretInsecure && _startupSecret) {
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

    // Log token header.alg and payload iat/exp (decoded without verification) for debugging
    // signature algorithm mismatches and token expiry issues.
    // Raw token and secret are never logged.
    try {
        const parts = token.split('.');
        const headerB64 = parts[0];
        const payloadB64 = parts[1];
        const headerJson = Buffer.from(headerB64, 'base64url').toString('utf-8');
        const header = JSON.parse(headerJson) as { alg?: string };
        let iat: number | undefined;
        let exp: number | undefined;
        try {
            const payloadJson = Buffer.from(payloadB64, 'base64url').toString('utf-8');
            const payloadDecoded = JSON.parse(payloadJson) as { iat?: number; exp?: number };
            iat = payloadDecoded.iat;
            exp = payloadDecoded.exp;
        } catch { /* ignore payload decode failures */ }
        console.log(`[Auth] token_header alg=${header.alg ?? 'missing'} iat=${iat ?? 'missing'} exp=${exp ?? 'missing'} requestId=${correlationId}`);
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
      secret = getAuthSecretStrict();
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

    console.log(`Verifying with secretLength=${secret.length} secretFingerprint=${getSecretFingerprint(secret)}`);

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

        let reason: string;
        if (err instanceof jwt.TokenExpiredError) {
            reason = 'token_expired';
        } else if (err instanceof jwt.JsonWebTokenError && verifyMsg.includes('invalid signature')) {
            // The token has a valid structure but its signature does not match the current
            // AUTH_SECRET.  This is a server-side configuration issue (AUTH_SECRET was rotated
            // or differs across deployments) rather than a bad client token.
            // Returning 'invalid_auth_secret' (a MISCONFIGURED_REASON) causes authResponse to
            // return HTTP 503 instead of 401, so the client is NOT automatically logged out.
            reason = 'invalid_auth_secret';
        } else {
            reason = 'invalid_token';
        }

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
