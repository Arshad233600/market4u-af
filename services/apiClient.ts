
import { API_BASE_URL } from '../config';
import { authService } from './authService';
import { toastService } from './toastService';

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

/**
 * Reasons that indicate a definitive, unrecoverable auth failure.
 * On these reasons the client should log out immediately rather than
 * attempting a soft-fail / retry.
 */
const DEFINITIVE_AUTH_REASONS = new Set([
  'signature_mismatch',
  'token_expired',
  'missing_auth_secret',
  'insecure_default_secret',
  'invalid_token',
]);

interface RequestOptions extends RequestInit {
  headers?: Record<string, string>;
  retries?: number;
  backoff?: number;
}

export const apiClient = {
  get: async <T>(endpoint: string): Promise<T> => {
    return request<T>(endpoint, 'GET');
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

// Track 401 failures per endpoint to implement soft-fail before logout
const recentAuthFailures = new Map<string, number>();
const AUTH_FAILURE_WINDOW_MS = 5000; // 5 seconds

async function request<T>(endpoint: string, method: string, body?: unknown, retries = 2, backoff = 300): Promise<T> {
  const token = authService.getToken();
  
  const headers: Record<string, string> = {
    'Accept': 'application/json',
  };

  if (body && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config: RequestOptions = {
    method,
    headers,
  };

  if (body) {
    config.body = body instanceof FormData ? body : JSON.stringify(body);
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);

    // 401 Unauthorized – soft-fail: re-check token before triggering logout.
    // A single 401 immediately after login may indicate a stale mock token that
    // getToken() already cleaned up (returning null). In that case the caller
    // should redirect to login rather than call logout() which dispatches auth-change.
    if (response.status === 401) {
      const storedToken = authService.getToken(); // re-check after possible mock-token cleanup

      // Parse structured reason from backend response (may be absent for older responses).
      // response.json() is consumed only once here; all paths in the 401 block throw, so
      // the body stream is never read a second time further down.
      let reason: string | undefined;
      try {
        const errBody = await response.json().catch(() => ({})) as { reason?: string; error?: string };
        reason = errBody.reason;
      } catch { /* ignore parse failures */ }

      const logReason = reason ?? (storedToken ? 'token_rejected_by_server' : 'no_token');
      console.warn(`[apiClient] 401 on ${method} ${endpoint} — reason: ${logReason}`);

      // Definitive reasons: logout immediately (no retry window needed)
      if (reason && DEFINITIVE_AUTH_REASONS.has(reason)) {
        authService.logout();
        toastService.warning('نشست شما منقضی شده است. لطفاً دوباره وارد شوید.');
        throw new AuthError(reason);
      }

      const failureKey = `${method}:${endpoint}`;
      const lastFailure = recentAuthFailures.get(failureKey) ?? 0;
      const isRecentFailure = Date.now() - lastFailure < AUTH_FAILURE_WINDOW_MS;
      recentAuthFailures.set(failureKey, Date.now());

      if (!isRecentFailure) {
        // First 401 within window: token may have just been cleaned up (mock token).
        // Throw AuthError without calling logout so the UI can show a soft warning.
        throw new AuthError(reason ?? logReason);
      }

      // Repeated 401 within window: genuine session expiry — log out the user.
      authService.logout();
      toastService.warning('نشست شما منقضی شده است. لطفاً دوباره وارد شوید.');
      throw new AuthError(reason ?? logReason);
    }

    // 5xx Server Errors - Retryable
    if (response.status >= 500 && retries > 0) {
        await wait(backoff);
        return request<T>(endpoint, method, body, retries - 1, backoff * 2);
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as { message?: string; error?: string };
      throw new Error(errorData.message || errorData.error || `API Error: ${response.status}`);
    }

    return await response.json().catch(() => {
      throw new Error('Invalid JSON response from server');
    });
  } catch (error) {
    // Network Errors (Offline) - Retryable
    if (retries > 0 && (error instanceof TypeError || (error as Error).message.includes('Failed to fetch'))) {
        await wait(backoff);
        return request<T>(endpoint, method, body, retries - 1, backoff * 2);
    }

    // Auth errors are already handled (logout + toast) above; skip duplicate logging
    if (!(error instanceof AuthError)) {
      console.error(`API Request Failed [${method} ${endpoint}]:`, error);
    }
    throw error;
  }
}
