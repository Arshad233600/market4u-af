
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

// Track 401 failures per endpoint as a fallback for older endpoints that don't
// return a structured reason. Uses a generous 60-second window to avoid false
// logouts caused by quick back-and-forth navigation between dashboard pages.
const recentAuthFailures = new Map<string, number>();
const AUTH_FAILURE_WINDOW_MS = 60_000; // 60 seconds

// Reasons returned by the backend that confirm the token is genuinely invalid.
// Server configuration issues (missing_auth_secret, insecure_default_secret)
// are intentionally excluded — logging out won't help if the server is mis-configured.
const CONFIRMED_INVALID_SESSION_REASONS = new Set([
  'token_expired',
  'invalid_token',
  'signature_mismatch',
  'missing_token',
]);

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

    if (response.status === 401) {
      const storedToken = authService.getToken(); // re-check after possible mock-token cleanup

      // Parse structured reason from backend response (may be absent for older responses).
      let reason: string | undefined;
      try {
        const errBody = await response.json().catch(() => ({})) as { reason?: string; error?: string };
        reason = errBody.reason;
      } catch { /* ignore parse failures */ }

      const logReason = reason ?? (storedToken ? 'token_rejected_by_server' : 'no_token');
      console.warn(`[apiClient] 401 on ${method} ${endpoint} — reason: ${logReason}`);

      const failureKey = `${method}:${endpoint}`;

      // If the backend explicitly confirms the session is invalid, log out immediately.
      if (reason && CONFIRMED_INVALID_SESSION_REASONS.has(reason)) {
        recentAuthFailures.delete(failureKey);
        authService.logout();
        toastService.warning('نشست شما منقضی شده است. لطفاً دوباره وارد شوید.');
        throw new AuthError(reason);
      }

      // For unknown/server-config reasons: use a conservative soft-fail with a 60-second
      // window. Two unconfirmed 401s within the window are treated as genuine expiry.
      const lastFailure = recentAuthFailures.get(failureKey) ?? 0;
      const isRecentFailure = Date.now() - lastFailure < AUTH_FAILURE_WINDOW_MS;
      recentAuthFailures.set(failureKey, Date.now());

      if (isRecentFailure) {
        // Second unconfirmed 401 within window: treat as genuine expiry.
        recentAuthFailures.delete(failureKey);
        authService.logout();
        toastService.warning('نشست شما منقضی شده است. لطفاً دوباره وارد شوید.');
      }
      // First unconfirmed 401: throw without logout (transient server issue).
      throw new AuthError(reason ?? logReason);
    }

    // Clear any soft-fail record on success so a previous transient 401 doesn't
    // count toward the next failure window for this endpoint.
    recentAuthFailures.delete(`${method}:${endpoint}`);

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
