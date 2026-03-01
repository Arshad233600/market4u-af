
import { HttpRequest, HttpResponseInit } from "@azure/functions";
import { Buffer } from "buffer";
import crypto from "crypto";
import { unauthorized, serviceUnavailable } from "./responses";

export const TOKEN_EXPIRATION_MS = 365 * 24 * 60 * 60 * 1000; // 1 year

const IS_PRODUCTION = process.env.NODE_ENV === 'production' || !process.env.AzureWebJobsStorage?.includes('UseDevelopmentStorage');

/**
 * Matches values that look like environment variable names (all uppercase letters,
 * digits, and underscores with at least one underscore), e.g. "VITE_API_BASE_URL".
 * Real secrets must contain lowercase letters or special characters.
 */
const LOOKS_LIKE_ENV_VAR_NAME = /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)+$/;

/**
 * Returns the AUTH_SECRET or throws if it is missing or insecure in production.
 * Always warns if the secret is shorter than 32 characters.
 */
export function getAuthSecretOrThrow(): string {
  const secret = process.env.AUTH_SECRET;

  if (!secret || secret.trim() === '') {
    if (IS_PRODUCTION) {
      throw new Error('AUTH_SECRET is not configured (Production).');
    }
    console.warn('[SECURITY] AUTH_SECRET is not set. Set AUTH_SECRET in Azure Application settings (min 32 chars).');
    return 'CHANGE_ME_IN_AZURE'; // dev-only fallback
  }

  if (secret === 'CHANGE_ME_IN_AZURE') {
    if (IS_PRODUCTION) {
      throw new Error('AUTH_SECRET is insecure default — set a strong random value in Azure Application settings.');
    }
    console.warn('[SECURITY] AUTH_SECRET uses insecure default value "CHANGE_ME_IN_AZURE".');
  }

  // Detect common misconfiguration: AUTH_SECRET set to an environment variable name
  // (e.g. "VITE_API_BASE_URL") instead of its actual value.  Real secrets must
  // contain lowercase letters or special characters, not be all-uppercase identifiers.
  if (LOOKS_LIKE_ENV_VAR_NAME.test(secret)) {
    const displayValue = secret.length <= 20 ? `"${secret}"` : `"${secret.slice(0, 8)}..."`;
    const msg = `AUTH_SECRET is set to what looks like an environment variable name (${displayValue}). ` +
      'Set AUTH_SECRET to a strong random value (min 32 chars) in Azure Application Settings, not a variable name.';
    if (IS_PRODUCTION) {
      throw new Error(msg);
    }
    console.warn(`[SECURITY] ${msg}`);
  }

  if (secret.length < 32) {
    console.warn(`[SECURITY] AUTH_SECRET is only ${secret.length} chars; minimum recommended length is 32.`);
  }

  return secret;
}

/** True when AUTH_SECRET is missing, the insecure fallback value, or looks like an env-var name. */
export const isAuthSecretInsecure =
  !process.env.AUTH_SECRET ||
  process.env.AUTH_SECRET.trim() === '' ||
  process.env.AUTH_SECRET === 'CHANGE_ME_IN_AZURE' ||
  LOOKS_LIKE_ENV_VAR_NAME.test(process.env.AUTH_SECRET);

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
    // accidental whitespace.  split(" ")[1] would return "" for "Bearer " (empty
    // token) and fall through to invalid_token instead of the clearer missing_token.
    const token = authHeader.slice('Bearer '.length).trim();
    if (!token) {
        const reason = "missing_token";
        lastAuthFailureSample = { requestId: correlationId, reason, timestamp: new Date().toISOString() };
        console.warn(`[auth] auth_failed reason=${reason} cause=empty_bearer_token requestId=${correlationId} method=${method} endpoint=${endpoint} hasAuthHeader=${hasAuthHeader}`);
        return { userId: null, isAuthenticated: false, reason, requestId: correlationId };
    }

    let secret: string;
    try {
      secret = getAuthSecretOrThrow();
    } catch (err) {
      const msg = (err as Error).message;
      const isInsecureDefault = msg.includes('insecure default');
      const isInvalidValue = msg.includes('environment variable name');
      const reason = isInsecureDefault ? 'insecure_default_secret' : isInvalidValue ? 'invalid_auth_secret' : 'missing_auth_secret';
      lastAuthFailureSample = { requestId: correlationId, reason, timestamp: new Date().toISOString() };
      console.warn('[Auth] Token validation skipped:', msg, `reason=${reason} requestId=${correlationId} method=${method} endpoint=${endpoint} hasAuthHeader=${hasAuthHeader}`);
      return {
        userId: null,
        isAuthenticated: false,
        reason,
        requestId: correlationId,
      };
    }
    
    try {
        // Token format: base64url(payload).base64url(signature)
        const parts = token.split('.');
        if (parts.length !== 2) {
            const reason = "invalid_token";
            lastAuthFailureSample = { requestId: correlationId, reason, timestamp: new Date().toISOString() };
            console.warn(`[Auth] auth_failed reason=${reason} cause=unexpected_format parts=${parts.length} requestId=${correlationId} method=${method} endpoint=${endpoint} hasAuthHeader=${hasAuthHeader}`);
            return { userId: null, isAuthenticated: false, reason, requestId: correlationId };
        }

        const [payloadB64, sigB64] = parts;
        
        // Verify signature
        const expectedSig = crypto.createHmac("sha256", secret).update(payloadB64).digest("base64url");
        if (sigB64 !== expectedSig) {
            const reason = "signature_mismatch";
            lastAuthFailureSample = { requestId: correlationId, reason, timestamp: new Date().toISOString() };
            console.warn(`[Auth] auth_failed reason=${reason} requestId=${correlationId} method=${method} endpoint=${endpoint} hasAuthHeader=${hasAuthHeader}`);
            return { userId: null, isAuthenticated: false, reason, requestId: correlationId };
        }

        // Decode payload
        const payloadJson = Buffer.from(payloadB64, 'base64url').toString('utf-8');
        const payload = JSON.parse(payloadJson);

        if (!payload.uid) {
            const reason = "invalid_token";
            lastAuthFailureSample = { requestId: correlationId, reason, timestamp: new Date().toISOString() };
            console.warn(`[Auth] auth_failed reason=${reason} cause=missing_uid requestId=${correlationId} method=${method} endpoint=${endpoint} hasAuthHeader=${hasAuthHeader}`);
            return { userId: null, isAuthenticated: false, reason, requestId: correlationId };
        }

        // Check token age (1 year)
        const tokenAge = Date.now() - (payload.iat || 0);
        if (tokenAge > TOKEN_EXPIRATION_MS) {
            const reason = "token_expired";
            lastAuthFailureSample = { requestId: correlationId, reason, timestamp: new Date().toISOString() };
            console.warn(`[Auth] auth_failed reason=${reason} ageMs=${tokenAge} userId=${payload.uid} requestId=${correlationId} method=${method} endpoint=${endpoint} hasAuthHeader=${hasAuthHeader}`);
            return { userId: null, isAuthenticated: false, reason, requestId: correlationId };
        }

        return { userId: payload.uid, isAuthenticated: true, requestId: correlationId };
    } catch {
        const reason = "invalid_token";
        lastAuthFailureSample = { requestId: correlationId, reason, timestamp: new Date().toISOString() };
        console.warn(`[Auth] auth_failed reason=${reason} cause=decode_error requestId=${correlationId} method=${method} endpoint=${endpoint} hasAuthHeader=${hasAuthHeader}`);
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
