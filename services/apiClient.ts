
import { API_BASE_URL } from '../config';
import { authService } from './authService';

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

async function request<T>(endpoint: string, method: string, body?: unknown, retries = 3, backoff = 300): Promise<T> {
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

    // 401 Unauthorized - No Retry, just logout
    if (response.status === 401) {
      authService.logout();
      window.location.reload();
      throw new Error('نشست شما منقضی شده است.');
    }

    // 5xx Server Errors - Retryable
    if (response.status >= 500 && retries > 0) {
        await wait(backoff);
        return request<T>(endpoint, method, body, retries - 1, backoff * 2);
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `API Error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    // Network Errors (Offline) - Retryable
    if (retries > 0 && (error instanceof TypeError || (error as Error).message.includes('Failed to fetch'))) {
        await wait(backoff);
        return request<T>(endpoint, method, body, retries - 1, backoff * 2);
    }
    
    console.error(`API Request Failed [${method} ${endpoint}]:`, error);
    throw error;
  }
}
