/**
 * debugAuth — Auth diagnostics helpers (PHASE 0)
 *
 * Enabled by setting the env variable VITE_DEBUG_AUTH=true.
 *
 * Security contract:
 *  - NEVER logs token values, only boolean presence flags.
 *  - NEVER logs passwords or sensitive PII.
 *  - Cookie logging reports count only, not names or values.
 */

import { DEBUG_AUTH } from '../config';
import { safeStorage } from './safeStorage';

const TOKEN_KEY = 'bazar_af_token';

/** Emit a single auth-diagnostics snapshot to the console. */
export function logAuthSnapshot(label = '[debugAuth] snapshot'): void {
  if (!DEBUG_AUTH) return;

  const tokenPresent = Boolean(safeStorage.getItem(TOKEN_KEY));
  const storageAvailable = safeStorage.isAvailable();
  const cookieCount = typeof document !== 'undefined'
    ? document.cookie.split(';').filter(c => c.trim().length > 0).length
    : 0;

  console.debug(label, {
    tokenPresent,
    storageAvailable,
    cookieCount,
  });
}

/** Log an outgoing API call with diagnostics (no token values). */
export function logApiCall(
  method: string,
  endpoint: string,
  authAttached: boolean,
  correlationId: string
): void {
  if (!DEBUG_AUTH) return;
  console.debug('[debugAuth] →', method, endpoint, {
    authAttached,
    correlationId,
  });
}

/** Log a completed API call with its HTTP status. */
export function logApiResponse(
  method: string,
  endpoint: string,
  status: number,
  correlationId: string
): void {
  if (!DEBUG_AUTH) return;
  console.debug('[debugAuth] ←', method, endpoint, {
    status,
    correlationId,
  });
}
