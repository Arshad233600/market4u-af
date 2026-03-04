import { describe, it, expect } from 'vitest';
import {
  success,
  error,
  unauthorized,
  notFound,
  serverError,
  serviceUnavailable,
  badRequest,
} from '../responses';

describe('API Response Helpers', () => {
  describe('success()', () => {
    it('returns status 200 and success:true by default', () => {
      const res = success({ id: 1 });
      expect(res.status).toBe(200);
      expect((res.jsonBody as any).success).toBe(true);
      expect((res.jsonBody as any).data).toEqual({ id: 1 });
    });

    it('accepts a custom status code', () => {
      const res = success({ created: true }, 201);
      expect(res.status).toBe(201);
    });
  });

  describe('error()', () => {
    it('returns status 400 and success:false by default', () => {
      const res = error('Something went wrong');
      expect(res.status).toBe(400);
      expect((res.jsonBody as any).success).toBe(false);
      expect((res.jsonBody as any).error).toBe('Something went wrong');
    });

    it('accepts a custom status code', () => {
      const res = error('Conflict', 409);
      expect(res.status).toBe(409);
    });

    it('includes optional details when provided', () => {
      const res = error('Bad input', 422, { field: 'email' });
      expect((res.jsonBody as any).details).toEqual({ field: 'email' });
    });
  });

  describe('unauthorized()', () => {
    it('returns status 401', () => {
      const res = unauthorized();
      expect(res.status).toBe(401);
      expect((res.jsonBody as any).success).toBe(false);
    });

    it('includes reason and requestId when provided', () => {
      const res = unauthorized('Auth required', 'expired_token', 'req-123');
      expect((res.jsonBody as any).reason).toBe('expired_token');
      expect((res.jsonBody as any).requestId).toBe('req-123');
    });

    it('sets category to AUTH_REQUIRED', () => {
      const res = unauthorized();
      expect((res.jsonBody as any).category).toBe('AUTH_REQUIRED');
    });
  });

  describe('notFound()', () => {
    it('returns status 404', () => {
      const res = notFound();
      expect(res.status).toBe(404);
    });

    it('uses custom message', () => {
      const res = notFound('User not found');
      expect((res.jsonBody as any).error).toBe('User not found');
    });
  });

  describe('serverError()', () => {
    it('returns status 500', () => {
      const res = serverError(new Error('DB timeout'));
      expect(res.status).toBe(500);
    });

    it('includes error detail from Error object', () => {
      const res = serverError(new Error('connection refused'));
      expect((res.jsonBody as any).details?.detail).toBe('connection refused');
    });

    it('handles non-Error values', () => {
      const res = serverError('raw string error');
      expect((res.jsonBody as any).details?.detail).toBe('raw string error');
    });
  });

  describe('serviceUnavailable()', () => {
    it('returns status 503', () => {
      const res = serviceUnavailable('insecure_default_secret');
      expect(res.status).toBe(503);
    });

    it('sets category to MISCONFIGURED_AUTH', () => {
      const res = serviceUnavailable('insecure_default_secret');
      expect((res.jsonBody as any).category).toBe('MISCONFIGURED_AUTH');
    });

    it('includes the reason', () => {
      const res = serviceUnavailable('missing_secret');
      expect((res.jsonBody as any).reason).toBe('missing_secret');
    });
  });

  describe('badRequest()', () => {
    it('returns status 400', () => {
      const res = badRequest('Invalid input');
      expect(res.status).toBe(400);
    });

    it('includes the message', () => {
      const res = badRequest('Email is required');
      expect((res.jsonBody as any).error).toBe('Email is required');
    });
  });
});
