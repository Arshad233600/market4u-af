import { describe, it, expect } from 'vitest';
import { generateUUID, resolveRequestId } from '../uuidUtils';

describe('uuidUtils', () => {
  describe('generateUUID()', () => {
    it('returns a string in UUID v4 format', () => {
      const uuid = generateUUID();
      expect(uuid).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    });

    it('generates unique values on each call', () => {
      const uuids = new Set(Array.from({ length: 100 }, () => generateUUID()));
      expect(uuids.size).toBe(100);
    });

    it('has version bit equal to 4', () => {
      const uuid = generateUUID();
      expect(uuid[14]).toBe('4');
    });

    it('has variant bits in [89ab]', () => {
      const uuid = generateUUID();
      expect('89ab').toContain(uuid[19]);
    });
  });

  describe('resolveRequestId()', () => {
    it('returns the client header when it is a valid UUID v4', () => {
      const validUUID = '550e8400-e29b-41d4-a716-446655440000';
      const result = resolveRequestId(validUUID);
      expect(result).toBe(validUUID);
    });

    it('generates a fresh UUID when header is null', () => {
      const result = resolveRequestId(null);
      expect(result).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    });

    it('generates a fresh UUID when header is not a valid UUID v4', () => {
      const result = resolveRequestId('not-a-uuid');
      expect(result).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    });

    it('generates a fresh UUID when header is an arbitrary injection string', () => {
      const result = resolveRequestId("'; DROP TABLE users; --");
      expect(result).not.toBe("'; DROP TABLE users; --");
      expect(result).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    });

    it('rejects a UUID v1 string', () => {
      const uuidV1 = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
      const result = resolveRequestId(uuidV1);
      // v1 has "1" in position 14, not "4", so it should be rejected
      expect(result).not.toBe(uuidV1);
    });
  });
});
