import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock idb-keyval
const mockStore = {};
vi.mock('idb-keyval', () => ({
  get: vi.fn(async (key) => mockStore[key] || null),
  set: vi.fn(async (key, val) => { mockStore[key] = val; }),
  del: vi.fn(async (key) => { delete mockStore[key]; }),
}));

describe('nfcStore', () => {
  let nfcStore;

  beforeEach(async () => {
    // Reset mock store
    Object.keys(mockStore).forEach(k => delete mockStore[k]);
    vi.resetModules();
    const mod = await import('../stores/nfc.js');
    nfcStore = mod.nfcStore;
    mod.enableMock();
  });

  it('canRead returns false in mock mode', () => {
    expect(nfcStore.canRead()).resolves.toBe(false);
  });

  it('writeTag in mock mode stores tag', async () => {
    const result = await nfcStore._mockWrite('EST-001', 'https://ecosyntech.com/trace/EST-001');
    expect(result.success).toBe(true);
    expect(result.mock).toBe(true);
    expect(result.tagUrl).toBe('https://ecosyntech.com/trace/EST-001');
  });

  it('recordRead stores checkpoint', async () => {
    const entry = await nfcStore.recordRead('EST-001', 'TAG_ABC', 'Cửa hàng HCM');
    expect(entry.lotCode).toBe('EST-001');
    expect(entry.tagId).toBe('TAG_ABC');
    expect(entry.location).toBe('Cửa hàng HCM');
    expect(entry.readAt).toBeGreaterThan(0);
  });

  it('getReadHistory returns only matching lot', async () => {
    await nfcStore.recordRead('EST-001', 'TAG1', 'Loc1');
    await nfcStore.recordRead('EST-001', 'TAG2', 'Loc2');
    await nfcStore.recordRead('EST-002', 'TAG3', 'Loc3');
    const hist = await nfcStore.getReadHistory('EST-001');
    expect(hist).toHaveLength(2);
    expect(hist[0].lotCode).toBe('EST-001');
  });
});
