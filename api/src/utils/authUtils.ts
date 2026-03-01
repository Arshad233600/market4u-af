import { HttpRequest, HttpResponseInit } from "@azure/functions";
import { Buffer } from "buffer";
import jwt from "jsonwebtoken";
import { unauthorized, serviceUnavailable } from "./responses";

export const TOKEN_EXPIRATION_SECONDS = 365 * 24 * 60 * 60; // 1 year in seconds
export const TOKEN_EXPIRATION_MS = TOKEN_EXPIRATION_SECONDS * 1000; // kept for backward compat

/**
 * Matches values that look like environment variable names (all uppercase letters,
 * digits, and underscores with at least one underscore), e.g. "VITE_API_BASE_URL".
 * Real secrets must contain lowercase letters or special characters.
 */
const LOOKS_LIKE_ENV_VAR_NAME = /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)+$/;

/** Typed error codes thrown by getAuthSecretOrThrow for reliable classification. */
export type AuthSecretErrorCode = 'missing_auth_secret' | 'insecure_default_secret' | 'invalid_auth_secret';

export class AuthSecretError extends Error {
  constructor(public readonly code: AuthSecretErrorCode, message: string) {
    super(message);
    this.name = 'AuthSecretError';
  }
}

/**
 * Returns the AUTH_SECRET or throws if it is missing or insecure.
 * The secret is trimmed to prevent whitespace encoding mismatches.
 */
export function getAuthSecretOrThrow(): string {
  const raw = process.env.AUTH_SECRET;
  const secret = raw?.trim() ?? '';

  if (!secret) {
    const missing = !raw;
    console.error(`[AUTH] AUTH_SECRET missing=${missing} length=${raw?.length ?? 0} looks_like_env_var=false`);
    throw new AuthSecretError('missing_auth_secret', 'AUTH_SECRET is not configured.');
  }

  const looksLikeEnvVarName = LOOKS_LIKE_ENV_VAR_NAME.test(secret);
  console.log(`[AUTH] AUTH_SECRET length=${secret.length} missing=false looks_like_env_var=${looksLikeEnvVarName}`);

  if (secret === 'CHANGE_ME_IN_AZURE') {
    throw new AuthSecretError('insecure_default_secret', 'AUTH_SECRET is insecure default — set a strong random value in Azure Application settings.');
  }

  // Detect common misconfiguration: AUTH_SECRET set to an environment variable name
  // (e.g. "VITE_API_BASE_URL") instead of its actual value.
  if (looksLikeEnvVarName) {
    const displayValue = secret.length <= 20 ? `"${secret}"` : `"${secret.slice(0, 8)}..."`;
    throw new AuthSecretError(
      'invalid_auth_secret',
      `AUTH_SECRET is set to what looks like an environment variable name (${displayValue}). ` +
      'Set AUTH_SECRET to a strong random value (min 32 chars) in Azure Application Settings, not a variable name.'
    );
  }

  if (secret.length < 32) {
    console.warn(`[SECURITY] AUTH_SECRET is only ${secret.length} chars; minimum recommended length is 32.`);
  }

  return secret;
}

/** True when AUTH_SECRET is missing, the insecure fallback value, or looks like an env-var name. */
export const isAuthSecretInsecure = (() => {
  const raw = process.env.AUTH_SECRET;
  const secret = raw?.trim() ?? '';
  return (
    !secret ||
    secret === 'CHANGE_ME_IN_AZURE' ||
    LOOKS_LIKE_ENV_VAR_NAME.test(secret)
  );
})();

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

    let secret: string;
    try {
      secret = getAuthSecretOrThrow();
    } catch (err) {
      const reason: string = err instanceof AuthSecretError ? err.code : 'missing_auth_secret';
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
