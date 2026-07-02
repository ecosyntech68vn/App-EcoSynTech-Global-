import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockStore = {};
vi.mock('idb-keyval', () => ({
  get: vi.fn(async (key) => mockStore[key] ?? null),
  set: vi.fn(async (key, val) => { mockStore[key] = val; }),
  del: vi.fn(async (key) => { delete mockStore[key]; }),
  keys: vi.fn(async () => Object.keys(mockStore))
}));

vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: vi.fn(async ({ key }) => ({ value: mockStore[key] ?? null })),
    set: vi.fn(async ({ key, value }) => { mockStore[key] = value; }),
    remove: vi.fn(async ({ key }) => { delete mockStore[key]; })
  }
}));

vi.mock('@capacitor/network', () => ({
  Network: { getStatus: vi.fn(async () => ({ connected: true })), addListener: vi.fn(() => ({ remove: vi.fn() })) }
}));

vi.mock('./secure.js', () => ({
  secureStore: {
    get: vi.fn(async (key) => mockStore[`insec_${key}`] ?? null),
    set: vi.fn(async (key, value) => { mockStore[`insec_${key}`] = value; }),
    remove: vi.fn(async (key) => { delete mockStore[`insec_${key}`]; })
  }
}));

import { authStore, __resetPinCache } from '../stores/auth.js';

function clearStore() {
  Object.keys(mockStore).forEach(k => delete mockStore[k]);
  try { __resetPinCache?.(); } catch (_) {}
}

describe('authStore', () => {
  beforeEach(async () => { clearStore(); });

  it('should login with default PIN 1234', async () => {
    mockStore['insec_pin_hash'] = JSON.stringify({ hash: 'e745d8297781431bc3d7885aec3c525bc5ff5a2629c6da17951ddb6d3813453b', v: 2, seededAt: '2026-01-01T00:00:00.000Z' });
    await authStore.login({ pin: '1234' });
    expect(authStore.token).toBeTruthy();
  });

  it('should reject empty PIN', async () => {
    await expect(authStore.login({ pin: '' })).rejects.toThrow();
  });

  it('should reject wrong PIN', async () => {
    mockStore['insec_pin_hash'] = JSON.stringify({ hash: '0000000000000000000000000000000000000000000000000000000000000000', v: 2 });
    await expect(authStore.login({ pin: '0000' })).rejects.toThrow();
  });

  it('should handle logout gracefully', async () => {
    mockStore['insec_pin_hash'] = JSON.stringify({ hash: 'e745d8297781431bc3d7885aec3c525bc5ff5a2629c6da17951ddb6d3813453b', v: 2, seededAt: '2026-01-01T00:00:00.000Z' });
    await authStore.login({ pin: '1234' });
    await authStore.logout();
    expect(authStore.token).toBeFalsy();
  });

  it('should handle restore with no saved data', async () => {
    const ok = await authStore.restore();
    expect(ok).toBe(false);
  });

  it('should handle save and restore url', async () => {
    authStore.url = 'http://192.168.1.100:3000';
    await authStore.save();
  });

  it('should seed default PIN if empty', async () => {
    const seeded = await authStore.seedDefaultPinIfEmpty();
    expect(seeded).toBe(true);
    expect(mockStore['insec_pin_hash']).toBeTruthy();
  });

  it('should reject PIN shorter than 4 digits', async () => {
    await expect(authStore.login({ pin: '123' })).rejects.toThrow();
  });

  it('should reject PIN longer than 6 digits', async () => {
    await expect(authStore.login({ pin: '1234567' })).rejects.toThrow();
  });
});
