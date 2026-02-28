/**
 * safeStorage - A localStorage wrapper that gracefully handles
 * browser tracking prevention (Safari ITP, Edge/Firefox ETP) which
 * can throw SecurityError / NotAllowedError when accessing localStorage.
 *
 * Fallback chain: localStorage → sessionStorage → in-memory store
 *
 * Dual-write strategy (iOS Safari resilience):
 *  - setItem writes to BOTH localStorage AND sessionStorage when available.
 *  - getItem reads from localStorage first, falls back to sessionStorage,
 *    then in-memory. This ensures tokens survive both tab switches (which
 *    may clear sessionStorage) and Tracking Prevention blocking localStorage.
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
    // Try localStorage first (survives tab close), then sessionStorage (survives
    // Tracking Prevention that blocks localStorage), then in-memory.
    try {
      const lsValue = localStorage.getItem(key);
      if (lsValue !== null) return lsValue;
    } catch { /* blocked */ }
    try {
      const ssValue = sessionStorage.getItem(key);
      if (ssValue !== null) return ssValue;
    } catch { /* blocked */ }
    return this.memoryStore.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    // Dual-write: persist to both localStorage AND sessionStorage so the token
    // survives regardless of which storage the browser allows at read time.
    let persisted = false;
    try {
      localStorage.setItem(key, value);
      persisted = true;
    } catch { /* localStorage blocked */ }
    try {
      sessionStorage.setItem(key, value);
      persisted = true;
    } catch { /* sessionStorage blocked */ }
    if (!persisted) {
      this.memoryStore.set(key, value);
    }
  }

  removeItem(key: string): void {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
    try { sessionStorage.removeItem(key); } catch { /* ignore */ }
    this.memoryStore.delete(key);
  }

  clear(): void {
    try { localStorage.clear(); } catch { /* ignore */ }
    try { sessionStorage.clear(); } catch { /* ignore */ }
    this.memoryStore.clear();
  }

  /** Returns true when persistent storage (localStorage or sessionStorage) is available */
  isAvailable(): boolean {
    return this.backend !== 'memory';
  }

  /** Returns the active storage backend ("local", "session", or "memory"). */
  getMode(): 'local' | 'session' | 'memory' {
    if (this.backend === 'localStorage') return 'local';
    if (this.backend === 'sessionStorage') return 'session';
    return 'memory';
  }

  /**
   * Performs a live read/write self-test on both storage backends.
   * Returns { localOk, sessionOk } without throwing.
   */
  selfTest(): { localOk: boolean; sessionOk: boolean } {
    const testKey = '__storage_selftest__';
    let localOk = false;
    let sessionOk = false;
    try {
      localStorage.setItem(testKey, '1');
      localStorage.removeItem(testKey);
      localOk = true;
    } catch { /* blocked */ }
    try {
      sessionStorage.setItem(testKey, '1');
      sessionStorage.removeItem(testKey);
      sessionOk = true;
    } catch { /* blocked */ }
    return { localOk, sessionOk };
  }
}

export const safeStorage = new SafeStorage();
