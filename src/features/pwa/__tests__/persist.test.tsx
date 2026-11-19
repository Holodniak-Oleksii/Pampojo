import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_PERSIST_KEY } from '../constants';
import { requestPersistentStorage } from '../persist';

// Browser test files share one origin, so another file can leave the flag behind.
beforeEach(() => {
  localStorage.removeItem(STORAGE_PERSIST_KEY);
});

afterEach(() => {
  localStorage.removeItem(STORAGE_PERSIST_KEY);
  vi.restoreAllMocks();
});

describe('requestPersistentStorage (AC6)', () => {
  it('asks once per device and sets the flag before asking', async () => {
    const persist = vi.spyOn(navigator.storage, 'persist').mockImplementation(async () => {
      expect(localStorage.getItem(STORAGE_PERSIST_KEY)).toBe('1');
      return true;
    });
    await requestPersistentStorage();
    await requestPersistentStorage();
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it('never asks again after a rejected request', async () => {
    const persist = vi.spyOn(navigator.storage, 'persist').mockRejectedValue(new Error('denied'));
    await requestPersistentStorage();
    await requestPersistentStorage();
    expect(persist).toHaveBeenCalledTimes(1);
  });
});
