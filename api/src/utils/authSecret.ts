/**
 * authSecret – single source of truth for AUTH_SECRET.
 *
 * Both token signing (login/register/refresh) and token verification
 * (validateToken middleware) MUST import from this module so that the
 * same trimmed, validated secret is used everywhere.
 */

import { createHash } from "crypto";

const MIN_SECRET_LENGTH = 32;

/**
 * Returns the trimmed AUTH_SECRET from process.env.
 * Throws if the variable is absent or shorter than MIN_SECRET_LENGTH (32) chars.
 *
 * Trim is applied to handle copy-paste whitespace from Azure Application Settings.
 */
export function getAuthSecretStrict(): string {
  const raw = process.env.AUTH_SECRET;
  if (!raw) {
    throw new Error(
      "[authSecret] AUTH_SECRET is not set. " +
        "Configure it in Azure Application Settings: openssl rand -hex 32"
    );
  }
  const secret = raw.trim();
  if (secret.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `[authSecret] AUTH_SECRET is too short (${secret.length} chars). ` +
        `Minimum ${MIN_SECRET_LENGTH} characters required.`
    );
  }
  return secret;
}

/**
 * Returns the first 12 hex characters of SHA-256(secret).
 * This fingerprint lets you confirm both sign and verify use the same secret
 * in production without ever logging the raw secret.
 */
export function getSecretFingerprint(secret: string): string {
  return createHash("sha256").update(secret).digest("hex").substring(0, 12);
}

/**
 * Returns { secretLength, secretFingerprint } for the current AUTH_SECRET.
 * Safe to include in diagnostic responses — never exposes the raw secret.
 * Throws with the same errors as getAuthSecretStrict() if the secret is
 * absent or too short.
 */
export function getSecretDiagnostics(): {
  secretLength: number;
  secretFingerprint: string;
} {
  const secret = getAuthSecretStrict();
  return {
    secretLength: secret.length,
    secretFingerprint: getSecretFingerprint(secret),
  };
}
