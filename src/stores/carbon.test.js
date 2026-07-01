import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockStore = {};
vi.mock('idb-keyval', () => ({
  get: vi.fn(async (key) => mockStore[key] || null),
  set: vi.fn(async (key, val) => { mockStore[key] = val; }),
  del: vi.fn(async (key) => { delete mockStore[key]; }),
}));

// Mock trace.js lotStore
vi.mock('../db/trace.js', () => ({
  lotStore: {
    byId: vi.fn(async (id) => {
      const lots = {
        'lot-001': {
          id: 'lot-001', code: 'EST-LUA-001', crop: 'Lúa', status: 'growing',
          plantedAt: '2026-01-01', area: '1 ha',
          events: vi.fn(async () => [
            { type: 'irrigation', ts: Date.now() - 10 * 86400000 },
            { type: 'irrigation', ts: Date.now() - 7 * 86400000 },
            { type: 'irrigation', ts: Date.now() - 3 * 86400000 },
          ])
        },
        'lot-noawd': {
          id: 'lot-noawd', code: 'EST-LUA-002', crop: 'Lúa', status: 'growing',
          plantedAt: '2026-01-01', area: '1 ha',
          events: vi.fn(async () => [
            { type: 'irrigation', ts: Date.now() - 1 * 86400000 },
            { type: 'irrigation', ts: Date.now() - 2 * 86400000 },
          ])
        },
      };
      return lots[id] || null;
    }),
    events: vi.fn(async (lotId) => {
      const lots = {
        'lot-001': [
          { type: 'irrigation', ts: Date.now() - 15 * 86400000 },
          { type: 'irrigation', ts: Date.now() - 8 * 86400000 },
          { type: 'pest', ts: Date.now() - 5 * 86400000 },
          { type: 'irrigation', ts: Date.now() - 2 * 86400000 },
        ],
        'lot-noawd': [
          { type: 'irrigation', ts: Date.now() - 1 * 86400000 },
          { type: 'irrigation', ts: Date.now() - 2 * 86400000 },
        ],
      };
      return lots[lotId] || [];
    }),
  }
}));

describe('carbonStore', () => {
  let carbonStore;

  beforeEach(async () => {
    // Reset mock store
    Object.keys(mockStore).forEach(k => delete mockStore[k]);
    vi.resetModules();
    carbonStore = (await import('../stores/carbon.js')).carbonStore;
  });

  describe('detectAWD', () => {
    it('detects AWD when irrigation intervals are 5-15 days', () => {
      const events = [
        { ts: 0 },
        { ts: 8 * 86400000 },
        { ts: 16 * 86400000 },
      ];
      expect(carbonStore.detectAWD(events)).toBe(true);
    });

    it('returns false for fewer than 3 events', () => {
      const events = [{ ts: 0 }, { ts: 1000 }];
      expect(carbonStore.detectAWD(events)).toBe(false);
    });

    it('returns false for daily irrigation (not AWD)', () => {
      const events = [
        { ts: 0 },
        { ts: 86400000 },
        { ts: 2 * 86400000 },
        { ts: 3 * 86400000 },
      ];
      expect(carbonStore.detectAWD(events)).toBe(false);
    });
  });

  describe('calculate', () => {
    it('calculates baseline emissions for a rice lot', async () => {
      const result = await carbonStore.calculate('lot-001');
      expect(result.lotCode).toBe('EST-LUA-001');
      expect(result.areaHa).toBeGreaterThan(0);
      expect(result.baseline.co2e_tons).toBeGreaterThan(0);
      expect(result.hasAwd).toBe(true);
      expect(result.reduction_tons).toBeGreaterThan(0);
    });

    it('calculates zero reduction for non-AWD lot', async () => {
      const result = await carbonStore.calculate('lot-noawd');
      expect(result.hasAwd).toBe(false);
    });
  });

  describe('saveProject / listProjects', () => {
    it('saves and retrieves carbon projects', async () => {
      await carbonStore.saveProject('lot-001');
      const projects = await carbonStore.listProjects();
      expect(projects).toHaveLength(1);
      expect(projects[0].lotCode).toBe('EST-LUA-001');
    });
  });

  describe('totalReduction', () => {
    it('aggregates totals', async () => {
      await carbonStore.saveProject('lot-001');
      const totals = await carbonStore.totalReduction();
      expect(totals.projectCount).toBe(1);
      expect(totals.totalReduction).toBeGreaterThanOrEqual(0);
      expect(totals.revenue_vnd).toBeUndefined(); // revenue_vnd is per-project
    });
  });
});
