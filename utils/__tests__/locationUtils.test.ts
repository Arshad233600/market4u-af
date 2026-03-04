import { describe, it, expect } from 'vitest';
import { findClosestProvince } from '../locationUtils';

describe('findClosestProvince()', () => {
  it('returns the closest province for Kabul coordinates', () => {
    // Kabul is at ~34.5553, 69.2075
    const result = findClosestProvince(34.5553, 69.2075);
    expect(result).not.toBeNull();
    expect(result?.id).toBe('kabul');
  });

  it('returns the closest province for Herat coordinates', () => {
    // Herat is at ~34.3529, 62.2040
    const result = findClosestProvince(34.3529, 62.2040);
    expect(result).not.toBeNull();
    expect(result?.id).toBe('herat');
  });

  it('returns the closest province for Kandahar coordinates', () => {
    // Kandahar is at ~31.6288, 65.7371
    const result = findClosestProvince(31.6288, 65.7371);
    expect(result).not.toBeNull();
    expect(result?.id).toBe('kandahar');
  });

  it('returns a province object with id, name, lat, and lng properties', () => {
    const result = findClosestProvince(34.5553, 69.2075);
    expect(result).toHaveProperty('id');
    expect(result).toHaveProperty('name');
    expect(result).toHaveProperty('lat');
    expect(result).toHaveProperty('lng');
  });

  it('does not return the "all" pseudo-province', () => {
    const result = findClosestProvince(34.5553, 69.2075);
    expect(result?.id).not.toBe('all');
  });

  it('returns a province for coordinates far outside Afghanistan', () => {
    // Should still return the nearest province, not null
    const result = findClosestProvince(0, 0);
    expect(result).not.toBeNull();
  });
});
