import { describe, it, expect, vi } from 'vitest';
import { toJalali, toJalaliWithTime, getRelativeTime } from '../dateUtils';

describe('dateUtils', () => {
  describe('toJalali()', () => {
    it('returns a non-empty string for a valid date string', () => {
      const result = toJalali('2023-01-15');
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('returns a non-empty string for a Date object', () => {
      const result = toJalali(new Date(2023, 0, 15));
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('returns a non-empty string for a timestamp number', () => {
      const result = toJalali(Date.now());
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('returns the original value as string when input is invalid', () => {
      const result = toJalali('not-a-date');
      expect(result).toBe('not-a-date');
    });
  });

  describe('toJalaliWithTime()', () => {
    it('returns a non-empty string for a valid date', () => {
      const result = toJalaliWithTime('2023-06-01T10:30:00Z');
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('returns original value for invalid input', () => {
      const result = toJalaliWithTime('invalid');
      expect(result).toBe('invalid');
    });
  });

  describe('getRelativeTime()', () => {
    it('returns "همین الان" for a time just a few seconds ago', () => {
      const now = new Date();
      const result = getRelativeTime(now);
      expect(result).toBe('همین الان');
    });

    it('returns a minutes-ago string for ~5 minutes ago', () => {
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
      const result = getRelativeTime(fiveMinAgo);
      expect(result).toContain('دقیقه پیش');
    });

    it('returns an hours-ago string for ~3 hours ago', () => {
      const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
      const result = getRelativeTime(threeHoursAgo);
      expect(result).toContain('ساعت پیش');
    });

    it('returns a days-ago string for ~2 days ago', () => {
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      const result = getRelativeTime(twoDaysAgo);
      expect(result).toContain('روز پیش');
    });

    it('returns a formatted Jalali date for dates older than a week', () => {
      const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
      const result = getRelativeTime(twoWeeksAgo);
      // Should NOT contain 'پیش' suffix — returns full date
      expect(result).not.toContain('ثانیه پیش');
      expect(typeof result).toBe('string');
    });
  });
});
