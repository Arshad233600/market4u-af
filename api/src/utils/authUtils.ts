
import { HttpRequest } from "@azure/functions";
import { Buffer } from "buffer";
import crypto from "crypto";

const TOKEN_EXPIRATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

const IS_PRODUCTION = process.env.NODE_ENV === 'production' || !process.env.AzureWebJobsStorage?.includes('UseDevelopmentStorage');

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

  if (secret.length < 32) {
    console.warn(`[SECURITY] AUTH_SECRET is only ${secret.length} chars; minimum recommended length is 32.`);
  }

  return secret;
}

/** True when AUTH_SECRET is missing or the insecure fallback value. */
export const isAuthSecretInsecure =
  !process.env.AUTH_SECRET ||
  process.env.AUTH_SECRET.trim() === '' ||
  process.env.AUTH_SECRET === 'CHANGE_ME_IN_AZURE';

export interface AuthResult {
    userId: string | null;
    isAuthenticated: boolean;
    reason?: string;
}

export const validateToken = (request: HttpRequest): AuthResult => {
    const correlationId = request.headers.get('x-client-request-id') ?? 'no-correlation-id';

    // 1. Check for Azure Static Web Apps Built-in Auth Header
    const swaHeader = request.headers.get("x-ms-client-principal");
    if (swaHeader) {
        try {
            const decoded = JSON.parse(Buffer.from(swaHeader, 'base64').toString('utf-8'));
            if (decoded && decoded.userId) {
                return { userId: decoded.userId, isAuthenticated: true };
            }
        } catch (e) {
            console.error("SWA Auth Decode Error", e);
        }
    }

    const authHeader = request.headers.get("authorization");
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        console.warn(`[auth] missing_token correlationId=${correlationId}`);
        return { userId: null, isAuthenticated: false, reason: "missing_token" };
    }

    const token = authHeader.split(" ")[1];

    let secret: string;
    try {
      secret = getAuthSecretOrThrow();
    } catch (err) {
      const isInsecureDefault = (err as Error).message.includes('insecure default');
      console.warn('[Auth] Token validation skipped:', (err as Error).message, `correlationId=${correlationId}`);
      return {
        userId: null,
        isAuthenticated: false,
        reason: isInsecureDefault ? 'insecure_default_secret' : 'missing_auth_secret',
      };
    }
    
    try {
        // Token format: base64url(payload).base64url(signature)
        const parts = token.split('.');
        if (parts.length !== 2) {
            console.warn("[Auth] Token validation failed: unexpected token format (parts=" + parts.length + ") correlationId=" + correlationId);
            return { userId: null, isAuthenticated: false, reason: "invalid_token" };
        }

        const [payloadB64, sigB64] = parts;
        
        // Verify signature
        const expectedSig = crypto.createHmac("sha256", secret).update(payloadB64).digest("base64url");
        if (sigB64 !== expectedSig) {
            console.warn("[Auth] Token validation failed: signature mismatch — likely AUTH_SECRET mismatch between deployments correlationId=" + correlationId);
            return { userId: null, isAuthenticated: false, reason: "signature_mismatch" };
        }

        // Decode payload
        const payloadJson = Buffer.from(payloadB64, 'base64url').toString('utf-8');
        const payload = JSON.parse(payloadJson);

        if (!payload.uid) {
            console.warn("[Auth] Token validation failed: missing uid claim correlationId=" + correlationId);
            return { userId: null, isAuthenticated: false, reason: "invalid_token" };
        }

        // Check token age (30 days)
        const tokenAge = Date.now() - (payload.iat || 0);
        if (tokenAge > TOKEN_EXPIRATION_MS) {
            console.warn(`[Auth] Token expired: age=${tokenAge}ms correlationId=${correlationId}`);
            return { userId: null, isAuthenticated: false, reason: "token_expired" };
        }

        return { userId: payload.uid, isAuthenticated: true };
    } catch {
        console.warn(`[Auth] Token decode error correlationId=${correlationId}`);
        return { userId: null, isAuthenticated: false, reason: "invalid_token" };
    }
};
