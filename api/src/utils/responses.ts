import { HttpResponseInit } from "@azure/functions";

/**
 * Standardized API Response Structure
 * All endpoints should use these helpers for consistent responses
 */

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Success response builder
 */
export function success<T>(data: T, status = 200): HttpResponseInit {
  return {
    status,
    jsonBody: {
      success: true,
      data
    } as ApiResponse<T>
  };
}

/**
 * Error response builder
 */
export function error(message: string, status = 400, details?: Record<string, unknown>): HttpResponseInit {
  return {
    status,
    jsonBody: {
      success: false,
      error: message,
      ...(details && { details })
    } as ApiResponse
  };
}

/**
 * Unauthorized response
 */
export function unauthorized(message = "Unauthorized"): HttpResponseInit {
  return error(message, 401);
}

/**
 * Not found response
 */
export function notFound(message = "Resource not found"): HttpResponseInit {
  return error(message, 404);
}

/**
 * Server error response
 */
export function serverError(err: unknown, message = "Internal server error"): HttpResponseInit {
  const errorMessage = err instanceof Error ? err.message : String(err);
  return error(message, 500, { detail: errorMessage });
}

/**
 * Bad request response
 */
export function badRequest(message: string): HttpResponseInit {
  return error(message, 400);
}
