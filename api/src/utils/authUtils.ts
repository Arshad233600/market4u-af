
import { HttpRequest } from "@azure/functions";
import { Buffer } from "buffer";
import crypto from "crypto";

const AUTH_SECRET = process.env.AUTH_SECRET || "CHANGE_ME_IN_AZURE";
const TOKEN_EXPIRATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/** True when AUTH_SECRET is the insecure fallback value. */
export const isAuthSecretInsecure = AUTH_SECRET === "CHANGE_ME_IN_AZURE";

if (isAuthSecretInsecure) {
    console.warn(
        "[SECURITY] AUTH_SECRET is not configured! " +
        "Set AUTH_SECRET as an Azure Application Setting (min 32 chars). " +
        "All tokens signed with the insecure default will be rejected in a hardened build."
    );
}

export interface AuthResult {
    userId: string | null;
    isAuthenticated: boolean;
    reason?: string;
}

export const validateToken = (request: HttpRequest): AuthResult => {
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
        return { userId: null, isAuthenticated: false, reason: "missing_bearer_token" };
    }

    const token = authHeader.split(" ")[1];
    
    try {
        // Token format: base64url(payload).base64url(signature)
        const parts = token.split('.');
        if (parts.length !== 2) {
            console.warn("[Auth] Token validation failed: unexpected token format (parts=" + parts.length + ")");
            return { userId: null, isAuthenticated: false, reason: "invalid_token_format" };
        }

        const [payloadB64, sigB64] = parts;
        
        // Verify signature
        const expectedSig = crypto.createHmac("sha256", AUTH_SECRET).update(payloadB64).digest("base64url");
        if (sigB64 !== expectedSig) {
            // Log this at warn level — a signature mismatch almost always means AUTH_SECRET
            // changed between the deployment that issued the token and this one.
            console.warn("[Auth] Token validation failed: signature mismatch — likely AUTH_SECRET mismatch between deployments");
            return { userId: null, isAuthenticated: false, reason: "signature_mismatch" };
        }

        // Decode payload
        const payloadJson = Buffer.from(payloadB64, 'base64url').toString('utf-8');
        const payload = JSON.parse(payloadJson);

        if (!payload.uid) {
            return { userId: null, isAuthenticated: false, reason: "missing_uid_claim" };
        }

        // Check token age (30 days)
        const tokenAge = Date.now() - (payload.iat || 0);
        if (tokenAge > TOKEN_EXPIRATION_MS) {
            return { userId: null, isAuthenticated: false, reason: "token_expired" };
        }

        return { userId: payload.uid, isAuthenticated: true };
    } catch {
        return { userId: null, isAuthenticated: false, reason: "decode_error" };
    }
};
