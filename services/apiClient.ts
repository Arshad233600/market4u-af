
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

  patch: async <T>(endpoint: string, body?: unknown): Promise<T> => {
    return request<T>(endpoint, 'PATCH', body);
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

    // 401 Unauthorized – the server has rejected the token (invalid, expired, or
    // missing secret). Always clear the local session so the user can re-login
    // and obtain a fresh token. Keeping a server-rejected token alive would leave
    // the user in a stuck state where the UI shows them as logged in but every
    // authenticated request fails.
    if (response.status === 401) {
      authService.logout();
      toastService.warning('نشست شما منقضی شده است. لطفاً دوباره وارد شوید.');
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
