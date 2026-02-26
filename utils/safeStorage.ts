/**
 * safeStorage - A localStorage wrapper that gracefully handles
 * browser tracking prevention (Safari ITP, Edge/Firefox ETP) which
 * can throw SecurityError / NotAllowedError when accessing localStorage.
 *
 * Fallback chain: localStorage → sessionStorage → in-memory store
 */

type StorageBackend = 'localStorage' | 'sessionStorage' | 'memory';

class SafeStorage {
  private backend: StorageBackend;
  private memoryStore = new Map<string, string>();

  constructor() {
    this.backend = this.detectBackend();
  }

  private detectBackend(): StorageBackend {
    try {
      const testKey = '__storage_test__';
      localStorage.setItem(testKey, '1');
      localStorage.removeItem(testKey);
      return 'localStorage';
    } catch {
      // localStorage blocked (tracking prevention or private browsing)
      try {
        const testKey = '__storage_test__';
        sessionStorage.setItem(testKey, '1');
        sessionStorage.removeItem(testKey);
        return 'sessionStorage';
      } catch {
        // sessionStorage also blocked – fall back to in-memory (ephemeral)
        return 'memory';
      }
    }
  }

  private get storage(): Storage | null {
    if (this.backend === 'localStorage') return localStorage;
    if (this.backend === 'sessionStorage') return sessionStorage;
    return null;
  }

  getItem(key: string): string | null {
    try {
      if (this.storage) return this.storage.getItem(key);
      return this.memoryStore.get(key) ?? null;
    } catch {
      return this.memoryStore.get(key) ?? null;
    }
  }

  setItem(key: string, value: string): void {
    if (this.storage) {
      try {
        this.storage.setItem(key, value);
        return;
      } catch {
        // Storage write failed (e.g. quota exceeded) – fall back to memory
      }
    }
    this.memoryStore.set(key, value);
  }

  removeItem(key: string): void {
    if (this.storage) {
      try {
        this.storage.removeItem(key);
        return;
      } catch {
        // ignore
      }
    }
    this.memoryStore.delete(key);
  }

  clear(): void {
    if (this.storage) {
      try {
        this.storage.clear();
        return;
      } catch {
        // ignore
      }
    }
    this.memoryStore.clear();
  }

  /** Returns true when persistent storage (localStorage or sessionStorage) is available */
  isAvailable(): boolean {
    return this.backend !== 'memory';
  }
}

export const safeStorage = new SafeStorage();
