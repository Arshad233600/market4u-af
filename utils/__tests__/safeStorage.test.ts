import { describe, it, expect, beforeEach, vi } from 'vitest';

// We must mock localStorage/sessionStorage before importing SafeStorage
// because it initialises the backend at construction time.

describe('SafeStorage', () => {
  // Re-import in each suite block so the constructor runs fresh
  beforeEach(() => {
    vi.resetModules();
    // Clear any stored values
    localStorage.clear();
    sessionStorage.clear();
  });

  it('stores and retrieves a value via localStorage', async () => {
    const { safeStorage } = await import('../safeStorage');
    safeStorage.setItem('key1', 'value1');
    expect(safeStorage.getItem('key1')).toBe('value1');
  });

  it('returns null for a key that was never set', async () => {
    const { safeStorage } = await import('../safeStorage');
    expect(safeStorage.getItem('nonexistent')).toBeNull();
  });

  it('overwrites an existing value', async () => {
    const { safeStorage } = await import('../safeStorage');
    safeStorage.setItem('k', 'first');
    safeStorage.setItem('k', 'second');
    expect(safeStorage.getItem('k')).toBe('second');
  });

  it('removes a value', async () => {
    const { safeStorage } = await import('../safeStorage');
    safeStorage.setItem('toRemove', 'yes');
    safeStorage.removeItem('toRemove');
    expect(safeStorage.getItem('toRemove')).toBeNull();
  });

  it('clear() removes all stored values', async () => {
    const { safeStorage } = await import('../safeStorage');
    safeStorage.setItem('a', '1');
    safeStorage.setItem('b', '2');
    safeStorage.clear();
    expect(safeStorage.getItem('a')).toBeNull();
    expect(safeStorage.getItem('b')).toBeNull();
  });

  it('isAvailable() returns true when localStorage is accessible', async () => {
    const { safeStorage } = await import('../safeStorage');
    expect(safeStorage.isAvailable()).toBe(true);
  });

  it('getMode() returns "local" when localStorage is accessible', async () => {
    const { safeStorage } = await import('../safeStorage');
    expect(safeStorage.getMode()).toBe('local');
  });

  it('selfTest() reports localOk:true and sessionOk:true in jsdom', async () => {
    const { safeStorage } = await import('../safeStorage');
    const result = safeStorage.selfTest();
    expect(result.localOk).toBe(true);
    expect(result.sessionOk).toBe(true);
  });
});
