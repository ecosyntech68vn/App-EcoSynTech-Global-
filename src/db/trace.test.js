import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockStore = {};
const mockKeys = [];

vi.mock('idb-keyval', () => ({
  get: vi.fn(async (key) => mockStore[key] || null),
  set: vi.fn(async (key, val) => { mockStore[key] = val; }),
  del: vi.fn(async (key) => { delete mockStore[key]; }),
  keys: vi.fn(async () => Object.keys(mockStore))
}));

vi.mock('../stores/sync.js', () => ({
  syncQueue: { enqueue: vi.fn() }
}));

vi.mock('../stores/auth.js', () => ({
  authStore: {
    farmerId: 'test-farmer',
    activeFarmId: 'F1',
    traceSyncEnabled: false,
    traceBaseUrl: 'https://ecosyntech-farmos.netlify.app/t/'
  }
}));

import { lotStore, materialsStore, inventoryStore, ACTIVITY_LABELS } from './trace.js';

function clearStore() {
  Object.keys(mockStore).forEach(k => delete mockStore[k]);
  mockKeys.length = 0;
}

describe('materialsStore', () => {
  beforeEach(() => { clearStore(); });

  it('should return default materials on first call', async () => {
    const list = await materialsStore.list();
    expect(list.length).toBeGreaterThanOrEqual(7);
    expect(list[0].name).toBe('NPK 16-16-8');
  });

  it('should add a new material', async () => {
    await materialsStore.add({ name: 'Test Phân', type: 'fertilizer', phiDays: 5, stockUnit: 'kg' });
    const list = await materialsStore.list();
    expect(list.find(m => m.name === 'Test Phân')).toBeTruthy();
  });

  it('should find material by id', async () => {
    const m = await materialsStore.byId('m_abamectin');
    expect(m).toBeTruthy();
    expect(m.name).toBe('Abamectin 3.6EC');
    expect(m.phiDays).toBe(7);
  });

  it('should remove a material', async () => {
    await materialsStore.remove('m_abamectin');
    const m = await materialsStore.byId('m_abamectin');
    expect(m).toBeNull();
  });

  it('should update a material', async () => {
    await materialsStore.update('m_abamectin', { phiDays: 10 });
    const m = await materialsStore.byId('m_abamectin');
    expect(m.phiDays).toBe(10);
  });
});

describe('lotStore', () => {
  beforeEach(() => { clearStore(); });

  it('should create a lot with unique code', async () => {
    const lot = await lotStore.create({ crop: 'Rau muống', zoneId: 'Z1' });
    expect(lot.code).toBeTruthy();
    expect(lot.code).toContain('EST-');
    expect(lot.crop).toBe('Rau muống');
    expect(lot.status).toBe('growing');
  });

  it('should list created lots', async () => {
    await lotStore.create({ crop: 'Cà chua', zoneId: 'Z2' });
    await lotStore.create({ crop: 'Dưa leo', zoneId: 'Z3' });
    const lots = await lotStore.list();
    expect(lots.length).toBe(2);
  });

  it('should find lot by id', async () => {
    const lot = await lotStore.create({ crop: 'Xoài', zoneId: 'Z4' });
    const found = await lotStore.byId(lot.id);
    expect(found).toBeTruthy();
    expect(found.crop).toBe('Xoài');
  });

  it('should record activity with PHI tracking', async () => {
    const lot = await lotStore.create({ crop: 'Cà chua', zoneId: 'Z1' });
    const { phiApplied } = await lotStore.recordActivity(lot.id, {
      type: 'pest', materialId: 'm_mancozeb', dose: '25', doseUnit: 'g/10L', note: 'Trị nấm'
    });
    expect(phiApplied).toBeTruthy();
    expect(phiApplied.phiDays).toBe(14);
    const updated = await lotStore.byId(lot.id);
    expect(updated.phiUntil).toBeGreaterThan(Date.now());
    expect(updated.phiSource).toBe('Mancozeb 80WP');
  });

  it('should block harvest when PHI is active', async () => {
    const lot = await lotStore.create({ crop: 'Rau muống', zoneId: 'Z1' });
    await lotStore.recordActivity(lot.id, { type: 'pest', materialId: 'm_mancozeb', dose: '25', doseUnit: 'g/10L' });
    await expect(lotStore.harvest(lot.id, { qty: 100, unit: 'kg' })).rejects.toThrow('PHI_LOCKED');
  });

  it('should allow harvest when PHI is not active', async () => {
    const lot = await lotStore.create({ crop: 'Rau muống', zoneId: 'Z1', plantedAt: '2026-06-01' });
    const harvested = await lotStore.harvest(lot.id, { qty: 50, unit: 'kg' });
    expect(harvested.status).toBe('harvested');
    expect(harvested.harvest.qty).toBe(50);
  });

  it('should allow manager to override PHI', async () => {
    const lot = await lotStore.create({ crop: 'Cà chua', zoneId: 'Z1' });
    await lotStore.recordActivity(lot.id, { type: 'pest', materialId: 'm_mancozeb', dose: '25', doseUnit: 'g/10L' });
    const harvested = await lotStore.harvest(lot.id, { qty: 80, unit: 'kg', overridePhi: true });
    expect(harvested.status).toBe('harvested');
    expect(harvested.harvest.phiOverridden).toBe(true);
  });

  it('should close a lot', async () => {
    const lot = await lotStore.create({ crop: 'Rau muống', zoneId: 'Z1' });
    const closed = await lotStore.close(lot.id);
    expect(closed.status).toBe('closed');
  });

  it('should prevent activity on closed lot', async () => {
    const lot = await lotStore.create({ crop: 'Rau muống', zoneId: 'Z1' });
    await lotStore.close(lot.id);
    await expect(lotStore.recordActivity(lot.id, { type: 'irrigation', note: 'Test' })).rejects.toThrow('đã đóng');
  });

  it('should generate different codes for different lots', async () => {
    const lot1 = await lotStore.create({ crop: 'Rau', zoneId: 'Z1' });
    const lot2 = await lotStore.create({ crop: 'Cà', zoneId: 'Z2' });
    expect(lot1.code).not.toBe(lot2.code);
  });
});

describe('inventoryStore', () => {
  beforeEach(() => { clearStore(); });

  it('should start with empty movements', async () => {
    const moves = await inventoryStore.movements();
    expect(moves.length).toBe(0);
  });

  it('should record a stock movement', async () => {
    await inventoryStore.post({ kind: 'raw', itemId: 'm_test', itemName: 'Test', type: 'import', qty: 100, unit: 'kg', note: 'Nhập test' });
    const moves = await inventoryStore.movements();
    expect(moves.length).toBe(1);
    expect(moves[0].qty).toBe(100);
  });

  it('should calculate balance correctly', async () => {
    await inventoryStore.post({ kind: 'raw', itemId: 'm_test', itemName: 'Test', type: 'open', qty: 100, unit: 'kg' });
    await inventoryStore.post({ kind: 'raw', itemId: 'm_test', itemName: 'Test', type: 'import', qty: 50, unit: 'kg' });
    await inventoryStore.post({ kind: 'raw', itemId: 'm_test', itemName: 'Test', type: 'export', qty: 30, unit: 'kg' });
    const bal = await inventoryStore.balanceOf('m_test');
    expect(bal).toBe(120);
  });

  it('should reject negative stock on export', async () => {
    await expect(inventoryStore.post({ kind: 'raw', itemId: 'm_test', itemName: 'Test', type: 'export', qty: 10, unit: 'kg' }))
      .rejects.toThrow('Không đủ tồn');
  });

  it('should allow export with allowNeg flag', async () => {
    const r = await inventoryStore.post({ kind: 'raw', itemId: 'm_test', itemName: 'Test', type: 'export', qty: 10, unit: 'kg', allowNeg: true });
    expect(r).toBeTruthy();
    expect(r.qty).toBe(10);
  });

  it('should reject zero or negative qty', async () => {
    await expect(inventoryStore.post({ kind: 'raw', itemId: 'm_test', itemName: 'Test', type: 'import', qty: 0, unit: 'kg' }))
      .rejects.toThrow('Số lượng phải lớn hơn 0');
    await expect(inventoryStore.post({ kind: 'raw', itemId: 'm_test', itemName: 'Test', type: 'import', qty: -5, unit: 'kg' }))
      .rejects.toThrow('Số lượng phải lớn hơn 0');
  });

  it('should set and get safe stock levels', async () => {
    await inventoryStore.setSafe('m_test', 50);
    const s = await inventoryStore.getSafe('m_test');
    expect(s).toBe(50);
  });

  it('should calculate balance map', async () => {
    await inventoryStore.post({ kind: 'raw', itemId: 'm_a', itemName: 'A', type: 'import', qty: 100, unit: 'kg' });
    await inventoryStore.post({ kind: 'raw', itemId: 'm_b', itemName: 'B', type: 'import', qty: 200, unit: 'kg' });
    await inventoryStore.post({ kind: 'raw', itemId: 'm_a', itemName: 'A', type: 'export', qty: 30, unit: 'kg' });
    const map = await inventoryStore.balanceMap();
    expect(map['m_a']).toBe(70);
    expect(map['m_b']).toBe(200);
  });

  it('should handle receiveFromHarvest', async () => {
    const lot = await lotStore.create({ crop: 'Rau muống', zoneId: 'Z1' });
    lot.harvest = { qty: 150, unit: 'kg', date: '2026-06-20' };
    const item = await inventoryStore.receiveFromHarvest(lot);
    expect(item.name).toContain('Rau muống');
    const fin = await inventoryStore.finishedList();
    expect(fin.length).toBe(1);
  });

  // ========== REAL-WORLD EDGE CASES ==========

  it('should handle harvest with zero quantity (no crash)', async () => {
    const lot = await lotStore.create({ crop: 'Ca chua', zoneId: 'Z1', plantedAt: '2026-01-01' });
    const r = await lotStore.harvest(lot.id, { qty: 0, unit: 'kg' });
    expect(r.status).toBe('harvested');
  });

  it('should handle harvest with negative quantity', async () => {
    const lot = await lotStore.create({ crop: 'Ca chua', zoneId: 'Z1', plantedAt: '2026-01-01' });
    const r = await lotStore.harvest(lot.id, { qty: -10, unit: 'kg' });
    expect(r.harvest.qty).toBe(-10);
  });

  it('should handle empty type as "other" activity', async () => {
    const lot = await lotStore.create({ crop: 'Lua', zoneId: 'Z1' });
    const { event } = await lotStore.recordActivity(lot.id, { type: '', note: 'test' });
    expect(event.type).toBe('other');
  });

  it('should reject activity on non-existent lot', async () => {
    await expect(lotStore.recordActivity('nonexistent-id', { type: 'irrigation', note: 'test' })).rejects.toThrow();
  });

  it('should reject harvest on non-existent lot', async () => {
    await expect(lotStore.harvest('fake-lot', { qty: 10, unit: 'kg' })).rejects.toThrow();
  });

  it('should create lot with auto-generated unique code', async () => {
    const lot1 = await lotStore.create({ crop: 'Rau', zoneId: 'Z1' });
    const lot2 = await lotStore.create({ crop: 'Rau', zoneId: 'Z1' });
    expect(lot1.code).not.toBe(lot2.code);
  });

  it('should handle lot with extremely long crop name', async () => {
    const longName = 'A'.repeat(500);
    const lot = await lotStore.create({ crop: longName, zoneId: 'Z1' });
    expect(lot.crop).toBe(longName);
  });

  it('should handle lot with special characters in note', async () => {
    const note = '<script>alert("xss")</script> & "quotes"';
    const lot = await lotStore.create({ crop: 'Lua', zoneId: 'Z1', note });
    expect(lot.note).toContain('script');
  });

  it('should allow PHI override by manager even on same-day spray', async () => {
    const lot = await lotStore.create({ crop: 'Rau muong', zoneId: 'Z1' });
    await lotStore.recordActivity(lot.id, { type: 'pest', materialId: 'm_mancozeb', dose: '25', doseUnit: 'g/10L' });
    const harvested = await lotStore.harvest(lot.id, { qty: 30, unit: 'kg', overridePhi: true });
    expect(harvested.status).toBe('harvested');
    expect(harvested.harvest.phiOverridden).toBe(true);
  });

  it('should list events after multiple activities', async () => {
    const lot = await lotStore.create({ crop: 'Ca', zoneId: 'Z1' });
    await lotStore.recordActivity(lot.id, { type: 'irrigation', note: 'Tuoi sang' });
    await lotStore.recordActivity(lot.id, { type: 'fertilizer', note: 'Bon NPK' });
    await lotStore.recordActivity(lot.id, { type: 'pest', materialId: 'm_abamectin', dose: '10', doseUnit: 'ml/10L' });
    const events = await lotStore.events(lot.id);
    expect(events.length).toBeGreaterThanOrEqual(3);
  });

  it('should handle events for non-existent lot', async () => {
    const events = await lotStore.events('nonexistent');
    expect(events).toBeTruthy();
  });

  it('should handle harvest with decimal quantity', async () => {
    const lot = await lotStore.create({ crop: 'Dau tay', zoneId: 'Z1', plantedAt: '2026-05-01' });
    const harvested = await lotStore.harvest(lot.id, { qty: 2.5, unit: 'kg' });
    expect(harvested.harvest.qty).toBe(2.5);
  });

  it('should track PHI source after pesticide application', async () => {
    const lot = await lotStore.create({ crop: 'Xa lach', zoneId: 'Z1' });
    await lotStore.recordActivity(lot.id, { type: 'pest', materialId: 'm_abamectin', dose: '5', doseUnit: 'ml/L' });
    const updated = await lotStore.byId(lot.id);
    expect(updated.phiSource).toBeTruthy();
    expect(updated.phiUntil).toBeGreaterThan(Date.now());
  });
});
