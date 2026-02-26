import { safeStorage } from '../utils/safeStorage';

const DEFAULT_TTL = 1000 * 60 * 30; // 30 Minutes cache by default

interface CacheItem<T> {
  data: T;
  expiry: number;
}

export const cacheService = {
  set: <T>(key: string, data: T, ttl: number = DEFAULT_TTL): void => {
    try {
      const item: CacheItem<T> = {
        data,
        expiry: Date.now() + ttl,
      };
      safeStorage.setItem(key, JSON.stringify(item));
    } catch (e) {
      console.warn('Cache quota exceeded', e);
      // Optional: Clear old cache if full
      safeStorage.clear();
    }
  },

  get: <T>(key: string): T | null => {
    try {
      const itemStr = safeStorage.getItem(key);
      if (!itemStr) return null;

      const item: CacheItem<T> = JSON.parse(itemStr);
      if (Date.now() > item.expiry) {
        safeStorage.removeItem(key);
        return null;
      }
      return item.data;
    } catch {
      return null;
    }
  },

  remove: (key: string): void => {
    safeStorage.removeItem(key);
  },

  clearAll: (): void => {
    safeStorage.clear();
  }
};
