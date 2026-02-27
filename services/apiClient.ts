
import { API_BASE_URL } from '../config';
import { authService } from './authService';
import { toastService } from './toastService';
import { logApiCall, logApiResponse, logAuthSnapshot } from '../utils/debugAuth';

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
   * When true, suppresses the auth-error warning toast on 401 responses.
   * Use this for background / polling calls (e.g. notification polling) where
   * the caller handles the error silently so the user is not repeatedly shown
   * the same toast.
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
  const token = authService.getToken();
  const correlationId = generateCorrelationId();
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
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);

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
      console.warn(
        `[apiClient] 401 on ${method} ${endpoint}`,
        `reason: ${logReason}`,
        `requestId: ${responseRequestId ?? correlationId}`,
        `hasToken: ${Boolean(storedToken)}`
      );

      // Helper: only show the auth-error toast when the caller is not silent.
      // Unauthenticated users browsing public pages must never see an auth error toast.
      // Uses a 60-second cooldown to prevent iOS Safari polling spam.
      const warnIfAuthenticated = () => {
        if (silent) return;
        if (reason === 'missing_token' || !storedToken) {
          // Authorization header was absent (no token stored or race condition clearing it).
          toastService.authWarning('توکن ارسال نشد. لطفاً دوباره وارد شوید.');
        } else if (reason === 'token_expired') {
          toastService.authWarning('نشست شما منقضی شد. دوباره وارد شوید.');
        } else if (reason === 'signature_mismatch') {
          toastService.authWarning('تنظیمات سرور تغییر کرده. دوباره وارد شوید.');
        } else {
          // Token present but rejected — session expired or unknown server-side reason.
          toastService.authWarning('نشست شما منقضی شده. دوباره وارد شوید.');
        }
      };

      // If the token is expired, attempt a silent refresh before giving up.
      // Skip if we already tried once for this request (prevents infinite loops).
      if (reason === 'token_expired' && !refreshAttempted) {
        const newToken = await tryRefreshToken();
        if (newToken) {
          // Refresh succeeded — retry the original request with the new token.
          return request<T>(endpoint, method, body, retries, backoff, true, silent);
        }
        // Refresh failed — throw without invalidating the session.
        // The user must log out explicitly; we never auto-logout.
        warnIfAuthenticated();
        throw new AuthError(reason);
      }

      // For all other 401 reasons: throw the error without invalidating the session.
      // Automatic logout is disabled — users are never logged out without their action.
      warnIfAuthenticated();
      throw new AuthError(reason ?? logReason);
    }

    // 5xx Server Errors - Retryable only for idempotent methods (GET, DELETE, PUT).
    // POST/PATCH are not retried: POST is not idempotent (creates a new resource each call),
    // and PATCH semantics vary per endpoint.
    const isIdempotent = method === 'GET' || method === 'DELETE' || method === 'PUT';
    if (response.status >= 500 && retries > 0 && isIdempotent) {
        await wait(backoff);
        return request<T>(endpoint, method, body, retries - 1, backoff * 2, refreshAttempted, silent);
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as { message?: string; error?: string; requestId?: string; category?: string };
      // For 5xx server errors prefer the high-level "error" label so raw SQL/internal details
      // are not surfaced to the browser; for 4xx use the more-specific "message" first.
      const msg = response.status >= 500
        ? errorData.error || errorData.message
        : errorData.message || errorData.error;
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

    // Auth errors are already handled (invalidation + toast) above; skip duplicate logging
    if (!(error instanceof AuthError)) {
      console.error(`API Request Failed [${method} ${endpoint}] correlationId=${correlationId}:`, error);
    }
    throw error;
  }
}

