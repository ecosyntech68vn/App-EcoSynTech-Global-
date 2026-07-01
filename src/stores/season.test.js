import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockStore = {};

vi.mock('idb-keyval', () => ({
  get: vi.fn(async (key) => mockStore[key] || null),
  set: vi.fn(async (key, val) => { mockStore[key] = val; }),
  del: vi.fn(async (key) => { delete mockStore[key]; }),
  keys: vi.fn(async () => Object.keys(mockStore))
}));

import { seasonStore, suggestRotation, getCropFamily } from '../stores/season.js';

function clearStore() {
  Object.keys(mockStore).forEach(k => delete mockStore[k]);
}

describe('seasonStore', () => {
  beforeEach(() => { clearStore(); });

  it('should create a season plan', async () => {
    const p = await seasonStore.create({ crop: 'Lúa', zoneId: 'Z1', area: '0.5 ha', plannedAt: '2026-07' });
    expect(p.id).toBeTruthy();
    expect(p.crop).toBe('Lúa');
    expect(p.status).toBe('planned');
  });

  it('should list plans sorted by plannedAt desc', async () => {
    await seasonStore.create({ crop: 'Lúa', zoneId: 'Z1', plannedAt: '2026-07' });
    await seasonStore.create({ crop: 'Rau muống', zoneId: 'Z2', plannedAt: '2026-05' });
    const list = await seasonStore.list();
    expect(list.length).toBe(2);
    expect(list[0].crop).toBe('Lúa');
  });

  it('should find plan by id', async () => {
    const p = await seasonStore.create({ crop: 'Cà chua', zoneId: 'Z3' });
    const found = await seasonStore.byId(p.id);
    expect(found).toBeTruthy();
    expect(found.crop).toBe('Cà chua');
  });

  it('should update a plan', async () => {
    const p = await seasonStore.create({ crop: 'Dưa leo', zoneId: 'Z1' });
    await seasonStore.update(p.id, { status: 'active', area: '300 m²' });
    const updated = await seasonStore.byId(p.id);
    expect(updated.status).toBe('active');
    expect(updated.area).toBe('300 m²');
  });

  it('should remove a plan', async () => {
    const p = await seasonStore.create({ crop: 'Ngô', zoneId: 'Z1' });
    await seasonStore.remove(p.id);
    const list = await seasonStore.list();
    expect(list.length).toBe(0);
  });

  it('should reject create without crop', async () => {
    await expect(seasonStore.create({ zoneId: 'Z1' })).rejects.toThrow('Thiếu tên cây trồng');
  });

  it('should reject create without zone', async () => {
    await expect(seasonStore.create({ crop: 'Lúa' })).rejects.toThrow('Thiếu zone');
  });

  it('should suggest rotation from last crop in zone', async () => {
    await seasonStore.create({ crop: 'Cà chua', zoneId: 'Z1', plannedAt: '2026-06' });
    await seasonStore.create({ crop: 'Rau muống', zoneId: 'Z1', plannedAt: '2026-05' });
    const advice = await seasonStore.rotateAdviceForZone('Z1');
    expect(advice.lastCrop).toBe('Cà chua');
    expect(advice.suggestions.length).toBeGreaterThan(0);
  });

  it('should return empty advice for unknown zone', async () => {
    const advice = await seasonStore.rotateAdviceForZone('Z999');
    expect(advice.lastCrop).toBeNull();
  });
});

describe('suggestRotation', () => {
  it('should suggest crops after solanaceae', () => {
    const sug = suggestRotation('cà chua');
    expect(sug.length).toBeGreaterThan(0);
    const names = sug.map(s => s.crop);
    expect(names.some(n => n.includes('đậu'))).toBe(true);
  });

  it('should suggest after lúa', () => {
    const sug = suggestRotation('lúa');
    expect(sug.length).toBeGreaterThan(0);
    const names = sug.map(s => s.crop);
    expect(names.some(n => n.includes('đậu'))).toBe(true);
  });

  it('should return empty for unknown crop', () => {
    const sug = suggestRotation('cây lạ');
    expect(sug.length).toBe(0);
  });
});

describe('getCropFamily', () => {
  it('should identify rice family', () => {
    expect(getCropFamily('lúa')).toBe('poaceae_rice');
    expect(getCropFamily('Lúa nước')).toBe('poaceae_rice');
  });

  it('should identify tomato family', () => {
    expect(getCropFamily('cà chua')).toBe('solanaceae');
  });

  it('should return null for unknown', () => {
    expect(getCropFamily('cây lạ')).toBeNull();
  });
});
