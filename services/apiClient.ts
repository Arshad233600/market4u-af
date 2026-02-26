
import { API_BASE_URL } from '../config';
import { authService } from './authService';
import { toastService } from './toastService';

/** Thrown (and re-thrown) whenever the backend returns HTTP 401. */
export class AuthError extends Error {
  constructor() {
    super('نشست شما منقضی شده است.');
    this.name = 'AuthError';
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

  delete: async <T>(endpoint: string): Promise<T> => {
    return request<T>(endpoint, 'DELETE');
  },
};

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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

    // 401 Unauthorized - Only destroy the session when the client-side check
    // also confirms the token is expired. A 401 on a seemingly-valid token is
    // likely a transient backend issue (cold start, secret rotation) and should
    // NOT log the user out; the caller's catch block handles the empty response.
    if (response.status === 401) {
      if (authService.isTokenExpired()) {
        authService.logout();
        toastService.warning('نشست شما منقضی شده است. لطفاً دوباره وارد شوید.');
      }
      throw new AuthError();
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
