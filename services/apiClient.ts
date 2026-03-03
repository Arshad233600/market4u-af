
import { authService } from './authService';
import { logApiCall, logApiResponse, logAuthSnapshot } from '../utils/debugAuth';
import { safeStorage } from '../utils/safeStorage';

const base = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, "");
if (import.meta.env.DEV) console.log("[apiClient] baseURL=", base);

/** Thrown (and re-thrown) whenever the backend returns HTTP 401. */
export class AuthError extends Error {
  /** Structured reason returned by the backend, e.g. "token_expired". */
  readonly reason?: string;
  constructor(reason?: string) {
    super('نشست شما منقضی شده است.');
    this.name = 'AuthError';
    this.reason = reason;
  }
}

/** Thrown for any non-2xx, non-401 HTTP response. Carries structured debug fields. */
export class ApiError extends Error {
  readonly status: number;
  readonly requestId?: string;
  readonly category?: string;
  constructor(message: string, status: number, requestId?: string, category?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.requestId = requestId;
    this.category = category;
  }
}

interface RequestOptions extends RequestInit {
  headers?: Record<string, string>;
  retries?: number;
  backoff?: number;
}

/** Options shared by all apiClient methods. */
export interface ApiCallOptions {
  /**
   * When true, the caller handles the error silently.
   * Use this for background / polling calls (e.g. notification polling).
   */
  silent?: boolean;
}

export const apiClient = {
  get: async <T>(endpoint: string, options?: ApiCallOptions): Promise<T> => {
    return request<T>(endpoint, 'GET', undefined, 2, 300, false, options?.silent ?? false);
  },

  post: async <T>(endpoint: string, body?: unknown): Promise<T> => {
    return request<T>(endpoint, 'POST', body);
  },

  put: async <T>(endpoint: string, body?: unknown): Promise<T> => {
    return request<T>(endpoint, 'PUT', body);
  },

  patch: async <T>(endpoint: string, body?: unknown): Promise<T> => {
    return request<T>(endpoint, 'PATCH', body);
  },

  delete: async <T>(endpoint: string): Promise<T> => {
    return request<T>(endpoint, 'DELETE');
  },
};

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Rate-limit 401 diagnostic logging to at most once per 60 seconds to prevent spam
// (especially on iOS Safari where polling endpoints may trigger many 401s).
let last401LogTime = 0;
const LOG_401_COOLDOWN_MS = 60_000;

// Deduplicate concurrent token refresh calls: at most one refresh request is
// in-flight at any time. Subsequent callers await the same promise.
let pendingRefreshPromise: Promise<string | null> | null = null;

function tryRefreshToken(): Promise<string | null> {
  if (!pendingRefreshPromise) {
    pendingRefreshPromise = authService.refreshToken().finally(() => {
      pendingRefreshPromise = null;
    });
  }
  return pendingRefreshPromise;
}

/** Generate a UUID v4 correlation ID for request tracing. */
function generateCorrelationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback: manual UUID v4
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

async function request<T>(endpoint: string, method: string, body?: unknown, retries = 2, backoff = 300, refreshAttempted = false, silent = false): Promise<T> {
  const correlationId = generateCorrelationId();

  // Compute protected-endpoint flag early so the expired-token pre-flight can use it.
  const PROTECTED_ENDPOINT_PATTERN = /\/(user|notifications|favorites|messages|wallet|admin|upload|dashboard|auth\/me|ads\/my-ads)/;
  const isPostAds = method === 'POST' && /^\/ads($|\?)/.test(endpoint);
  const isProtected = PROTECTED_ENDPOINT_PATTERN.test(endpoint) || isPostAds;

  // Pre-flight: handle client-side-expired tokens before making the network request.
  // This avoids unnecessary 401 round-trips that produce DevTools console errors.
  //
  // - Protected endpoints (e.g. POST /ads, GET /ads/my-ads): attempt a silent token
  //   refresh; if refresh fails, throw AuthError early so no network request is made.
  // - Non-protected endpoints (e.g. GET /ads): strip the expired token so the request
  //   is forwarded as anonymous. Azure SWA validates Bearer tokens even on routes
  //   configured with allowedRoles: ["anonymous"] — an expired token causes a 401
  //   even though the endpoint is public.
  const rawToken = authService.getToken();
  let token = rawToken;
  if (rawToken && authService.isTokenExpired()) {
    if (isProtected && !refreshAttempted) {
      const newToken = await tryRefreshToken();
      if (newToken) {
        return request<T>(endpoint, method, body, retries, backoff, true, silent);
      }
      throw new AuthError('token_expired');
    }
    if (!isProtected) {
      token = null;
    }
  }

  const authAttached = Boolean(token);

  // PHASE 0: log snapshot before every request when debug mode is active
  logAuthSnapshot(`[debugAuth] pre-request ${method} ${endpoint}`);
  
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'x-client-request-id': correlationId,
  };

  if (body && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // PHASE 3: structured pre-request log for protected endpoints and POST /ads
  // (storage may be blocked by Safari ITP / PWA restrictions)
  if (isProtected) {
    const callerStack = (() => {
      try {
        const frames = (new Error().stack ?? '').split('\n');
        const frame = frames.find((l) => (l.includes('.tsx') || l.includes('.ts')) && !l.includes('apiClient'));
        const m = frame?.match(/([^/\\]+\.tsx?):(\d+)/);
        return m ? `${m[1]}:${m[2]}` : 'unknown';
      } catch { return 'unknown'; }
    })();
    const hasAuth = Boolean(headers['Authorization']);
    const tokenLength = token ? token.length : 0;
    // Only include token prefix in non-production builds to avoid leaking token structure in prod logs
    const tokenPrefix = (token && import.meta.env.DEV) ? token.substring(0, 8) : '';
    const storageMode = safeStorage.getMode();
    console.log(
      `[apiClient] ${method} ${endpoint} hasAuth=${hasAuth} tokenLength=${tokenLength}${hasAuth && tokenPrefix ? ` tokenPrefix=${tokenPrefix}` : ''} storage=${storageMode} caller=${callerStack}`
    );
    if (!hasAuth) {
      console.warn(`[apiClient] token missing for protected endpoint ${method} ${endpoint} caller=${callerStack}`);
      // Throw early (before hitting the network) to prevent unnecessary 401 responses
      // and DevTools console errors. Callers that handle AuthError will direct users
      // to the login screen. This applies in both development and production.
      throw new AuthError('missing_token');
    }
  }

  // PHASE 0: log outgoing request details (no token value)
  logApiCall(method, endpoint, authAttached, correlationId);

  const config: RequestOptions = {
    method,
    headers,
  };

  if (body) {
    config.body = body instanceof FormData ? body : JSON.stringify(body);
  }

  try {
    const response = await fetch(`${base}${endpoint}`, config);

    // PHASE 0: log response status
    logApiResponse(method, endpoint, response.status, correlationId);

    if (response.status === 401) {
      // Parse structured reason + requestId from backend response.
      let reason: string | undefined;
      let responseRequestId: string | undefined;
      try {
        const errBody = await response.json().catch(() => ({})) as { reason?: string; error?: string; requestId?: string };
        reason = errBody.reason;
        responseRequestId = errBody.requestId;
      } catch { /* ignore parse failures */ }

      const storedToken = authService.getToken();
      const logReason = reason ?? (storedToken ? 'token_rejected_by_server' : 'no_token');

      // Diagnostic log with cooldown (max once per 60s) to prevent iOS Safari polling spam
      const now = Date.now();
      if (now - last401LogTime >= LOG_401_COOLDOWN_MS) {
        last401LogTime = now;
        console.warn(
          `[apiClient] 401 on ${method} ${endpoint}`,
          `reason: ${logReason}`,
          `requestId: ${responseRequestId ?? correlationId}`,
          `hasToken: ${Boolean(storedToken)}`,
          `storageMode: ${safeStorage.getMode()}`,
          `storageAvailable: ${safeStorage.isAvailable()}`,
          `responseBody: ${JSON.stringify({ reason, requestId: responseRequestId })}`,
        );
      }

      // If the token is expired, attempt a silent refresh before giving up.
      // Skip if we already tried once for this request (prevents infinite loops).
      // This runs before the storage_blocked check so that a recoverable
      // token_expired error is not incorrectly surfaced as storage_blocked
      // when the storage backend has fallen back to in-memory (e.g. due to
      // browser tracking prevention blocking localStorage/sessionStorage).
      if (reason === 'token_expired' && !refreshAttempted) {
        const newToken = await tryRefreshToken();
        if (newToken) {
          // Refresh succeeded — retry with refreshAttempted=true to prevent infinite refresh loops.
          return request<T>(endpoint, method, body, retries, backoff, /* refreshAttempted */ true, silent);
        }
        // Refresh failed — throw without invalidating the session.
        // The user must log out explicitly; we never auto-logout.
        throw new AuthError(reason);
      }

      // When storage is blocked (Safari ITP / private browsing), a 401 means the
      // browser cannot persist credentials — not that the session is invalid.
      // Throw the error so the UI can show a proper message to the user.
      // This check runs after the token_expired refresh attempt above so that
      // a recoverable expired token is not incorrectly masked as storage_blocked.
      if (!safeStorage.isAvailable() && isProtected) {
        throw new AuthError('storage_blocked');
      }

      // invalid_token: the stored token failed signature verification. Before giving up,
      // attempt a silent refresh — the server may have rotated the secret and the refresh
      // endpoint accepts the old token within the grace window.
      // Only attempt once (refreshAttempted guard) to prevent infinite loops.
      if (reason === 'invalid_token' && !refreshAttempted) {
        const newToken = await tryRefreshToken();
        if (newToken) {
          // Refresh succeeded — retry with refreshAttempted=true to prevent infinite refresh loops.
          return request<T>(endpoint, method, body, retries, backoff, /* refreshAttempted */ true, silent);
        }
        // Refresh failed — do NOT clear the session here; throw so the UI can decide
        // (e.g. show a "re-login" prompt rather than an unexpected logout).
        throw new AuthError(reason);
      }

      // For all other 401 reasons: throw the error without invalidating the session.
      // Automatic logout is disabled — users are never logged out without their action.
      throw new AuthError(reason ?? logReason);
    }

    // 5xx Server Errors - Retryable only for idempotent methods (GET, DELETE, PUT).
    // POST/PATCH are not retried: POST is not idempotent (creates a new resource each call),
    // and PATCH semantics vary per endpoint.
    // 503 misconfigured_auth is a permanent server configuration error — never retry it.
    const isIdempotent = method === 'GET' || method === 'DELETE' || method === 'PUT';
    if (response.status >= 500 && retries > 0 && isIdempotent) {
      // For 503, peek at the body to detect permanent errors before retrying.
      // - misconfigured_auth: AUTH_SECRET is missing/insecure — permanent, never retry.
      // - db_not_configured: DB connection string is missing — permanent, never retry.
      let shouldRetry = true;
      if (response.status === 503) {
        try {
          const peek = await response.clone().json() as { error?: string; reason?: string };
          if (peek.error === 'misconfigured_auth' || peek.reason === 'db_not_configured') {
            shouldRetry = false; // permanent config error — fall through to !response.ok handler
          }
        } catch {
          console.warn(`[apiClient] 503 ${method} ${endpoint} — could not parse response body; treating as retryable`);
        }
      }
      if (shouldRetry) {
        await wait(backoff);
        return request<T>(endpoint, method, body, retries - 1, backoff * 2, refreshAttempted, silent);
      }
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as { message?: string; error?: string; requestId?: string; category?: string };
      // For 5xx server errors prefer the high-level "error" label so raw SQL/internal details
      // are not surfaced to the browser; for 4xx use the more-specific "message" first.
      const msg = response.status >= 500
        ? errorData.error || errorData.message
        : errorData.message || errorData.error;
      console.warn(
        `[apiClient] ${response.status} ${method} ${endpoint} ok=false correlationId=${correlationId}`,
        `requestId=${errorData.requestId ?? 'none'}`,
      );
      throw new ApiError(msg || `API Error: ${response.status}`, response.status, errorData.requestId, errorData.category);
    }

    return await response.json().catch(() => {
      throw new Error('Invalid JSON response from server');
    });
  } catch (error) {
    // Network Errors (Offline) - Retryable
    if (retries > 0 && (error instanceof TypeError || (error as Error).message.includes('Failed to fetch'))) {
        await wait(backoff);
        return request<T>(endpoint, method, body, retries - 1, backoff * 2, refreshAttempted, silent);
    }

    // Auth errors are already handled above; skip duplicate logging
    if (!(error instanceof AuthError)) {
      console.error(`API Request Failed [${method} ${endpoint}] correlationId=${correlationId}:`, error);
    }
    throw error;
  }
}

