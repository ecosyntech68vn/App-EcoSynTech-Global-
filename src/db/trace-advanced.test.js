import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockStore = {};

vi.mock('idb-keyval', () => ({
  get: vi.fn(async (key) => mockStore[key] || null),
  set: vi.fn(async (key, val) => { mockStore[key] = val; }),
  del: vi.fn(async (key) => { delete mockStore[key]; }),
  keys: vi.fn(async () => Object.keys(mockStore))
}));

vi.mock('../stores/auth.js', () => ({
  authStore: { farmerId: 'test-farmer', role: 'admin', activeFarmId: 'F1' }
}));

vi.mock('../stores/audit.js', () => ({
  auditStore: {
    log: vi.fn(async () => {}),
    logConfig: vi.fn(async () => {})
  }
}));

function clearStore() {
  Object.keys(mockStore).forEach(k => delete mockStore[k]);
}

// ============================================================
// genealogyStore tests
// ============================================================
describe('genealogyStore', () => {
  let mod;
  beforeEach(async () => {
    clearStore();
    mod = await import('../stores/trace-advanced.js');
  });

  it('should add split records', async () => {
    await mod.genealogyStore.addSplit({ sourceLotId: 'LOT001', targetLotIds: ['LOTA', 'LOTB'], quantities: [30, 20] });
    const all = await mod.genealogyStore.getAll();
    expect(all.length).toBe(2);
    expect(all[0].sourceLotId).toBe('LOT001');
    expect(all[0].type).toBe('split');
  });

  it('should add merge records', async () => {
    await mod.genealogyStore.addMerge({ targetLotId: 'LOTX', sourceLotIds: ['LOT001', 'LOT002'] });
    const all = await mod.genealogyStore.getAll();
    expect(all.length).toBe(2);
    expect(all[0].type).toBe('merge');
  });

  it('should return empty tree for independent lot', async () => {
    const tree = await mod.genealogyStore.getTree('LOT_INDEPENDENT');
    expect(tree.parents).toEqual([]);
    expect(tree.children).toEqual([]);
  });

  it('should trace parent-child relationships', async () => {
    await mod.genealogyStore.addSplit({ sourceLotId: 'ROOT', targetLotIds: ['CHILD1', 'CHILD2'] });
    const childTree = await mod.genealogyStore.getTree('CHILD1');
    expect(childTree.parents.length).toBe(1);
    expect(childTree.parents[0].lotId).toBe('ROOT');
    const rootTree = await mod.genealogyStore.getTree('ROOT');
    expect(rootTree.children.length).toBe(2);
  });

  it('should reject empty split', async () => {
    const result = await mod.genealogyStore.addSplit({ sourceLotId: 'LOT001', targetLotIds: [] });
    expect(result).toBe(false);
  });
});

// ============================================================
// inspectionStore tests
// ============================================================
describe('inspectionStore', () => {
  let mod;
  beforeEach(async () => {
    clearStore();
    mod = await import('../stores/trace-advanced.js');
  });

  it('should add inspection records', async () => {
    await mod.inspectionStore.add({ lotId: 'LOT001', type: 'harvest', result: 'pass', ph: 6.5, brix: 12 });
    const all = await mod.inspectionStore.getAll();
    expect(all.length).toBe(1);
    expect(all[0].lotId).toBe('LOT001');
    expect(all[0].ph).toBe(6.5);
  });

  it('should get inspections by lot', async () => {
    await mod.inspectionStore.add({ lotId: 'LOTA', type: 'harvest', result: 'pass' });
    await mod.inspectionStore.add({ lotId: 'LOTB', type: 'harvest', result: 'pass' });
    await mod.inspectionStore.add({ lotId: 'LOTA', type: 'pre_shipment', result: 'pass' });
    const lotA = await mod.inspectionStore.getByLot('LOTA');
    expect(lotA.length).toBe(2);
  });

  it('should calculate summary stats', async () => {
    await mod.inspectionStore.add({ lotId: 'LOT001', type: 'harvest', result: 'pass' });
    await mod.inspectionStore.add({ lotId: 'LOT001', type: 'pre_shipment', result: 'pass' });
    await mod.inspectionStore.add({ lotId: 'LOT001', type: 'storage', result: 'fail' });
    const summary = await mod.inspectionStore.getSummary('LOT001');
    expect(summary.total).toBe(3);
    expect(summary.pass).toBe(2);
    expect(summary.fail).toBe(1);
    expect(summary.passRate).toBe(67);
  });

  it('should reject without lotId', async () => {
    const result = await mod.inspectionStore.add({ type: 'harvest' });
    expect(result).toBe(false);
  });
});

// ============================================================
// processingStore tests
// ============================================================
describe('processingStore', () => {
  let mod;
  beforeEach(async () => {
    clearStore();
    mod = await import('../stores/trace-advanced.js');
  });

  it('should add processing records', async () => {
    const result = await mod.processingStore.add({
      name: 'Sấy cà phê',
      inputLots: [{ lotId: 'CAFE001', quantity: 100, unit: 'kg' }],
      outputProduct: 'Cà phê nhân',
      outputQuantity: 60, unit: 'kg', cost: 500000
    });
    expect(result).not.toBe(false);
    const all = await mod.processingStore.getAll();
    expect(all.length).toBe(1);
    expect(all[0].outputProduct).toBe('Cà phê nhân');
  });

  it('should reject without required fields', async () => {
    const r1 = await mod.processingStore.add({ name: 'Test', inputLots: [], outputProduct: 'X' });
    expect(r1).toBe(false);
    const r2 = await mod.processingStore.add({ name: '', inputLots: [{ lotId: 'A' }], outputProduct: 'X' });
    expect(r2).toBe(false);
  });
});

// ============================================================
// coldChainStore tests
// ============================================================
describe('coldChainStore', () => {
  let mod;
  beforeEach(async () => {
    clearStore();
    mod = await import('../stores/trace-advanced.js');
  });

  it('should add temperature logs', async () => {
    await mod.coldChainStore.add({ lotId: 'LOT001', temp: 4.5, humidity: 85, location: 'Kho A' });
    const all = await mod.coldChainStore.getAll();
    expect(all.length).toBe(1);
    expect(all[0].temp).toBe(4.5);
  });

  it('should detect temperature breaches', async () => {
    await mod.coldChainStore.add({ lotId: 'LOT001', temp: 4.0, location: 'Kho A' });
    await mod.coldChainStore.add({ lotId: 'LOT001', temp: 12.0, location: 'Kho A' });
    await mod.coldChainStore.add({ lotId: 'LOT001', temp: 1.0, location: 'Kho A' });
    const result = await mod.coldChainStore.getBreaches('LOT001', 2, 8);
    expect(result.count).toBe(2);
  });

  it('should calculate temperature summary', async () => {
    await mod.coldChainStore.add({ lotId: 'LOT001', temp: 4, humidity: 80 });
    await mod.coldChainStore.add({ lotId: 'LOT001', temp: 6, humidity: 82 });
    await mod.coldChainStore.add({ lotId: 'LOT001', temp: 5, humidity: 78 });
    const summary = await mod.coldChainStore.getSummary('LOT001');
    expect(summary.avgTemp).toBe(5);
    expect(summary.minTemp).toBe(4);
    expect(summary.maxTemp).toBe(6);
    expect(summary.count).toBe(3);
  });
});

// ============================================================
// recallStore tests
// ============================================================
describe('recallStore', () => {
  let mod;
  beforeEach(async () => {
    clearStore();
    mod = await import('../stores/trace-advanced.js');
  });

  it('should create recall', async () => {
    await mod.recallStore.add({ lotId: 'LOT001', reason: 'Nhiễm khuẩn', severity: 'critical', affectedQuantity: 500 });
    const all = await mod.recallStore.getAll();
    expect(all.length).toBe(1);
    expect(all[0].status).toBe('open');
  });

  it('should update recall status', async () => {
    await mod.recallStore.add({ lotId: 'LOT001', reason: 'Test' });
    const all = await mod.recallStore.getAll();
    await mod.recallStore.update(all[0].id, { status: 'resolved' });
    const updated = await mod.recallStore.getAll();
    expect(updated[0].status).toBe('resolved');
    expect(updated[0].resolvedAt).not.toBeNull();
  });

  it('should trace forward from a lot', async () => {
    await mod.genealogyStore.addSplit({ sourceLotId: 'ROOT', targetLotIds: ['A', 'B'] });
    await mod.genealogyStore.addSplit({ sourceLotId: 'A', targetLotIds: ['A1', 'A2'] });
    const forward = await mod.recallStore.traceForward('ROOT');
    expect(forward.length).toBe(4);
    const lotIds = forward.map(f => f.lotId);
    expect(lotIds).toContain('A');
    expect(lotIds).toContain('A1');
  });

  it('should trace backward to origin', async () => {
    await mod.genealogyStore.addSplit({ sourceLotId: 'ROOT', targetLotIds: ['CHILD'] });
    await mod.genealogyStore.addSplit({ sourceLotId: 'CHILD', targetLotIds: ['GRANDCHILD'] });
    const backward = await mod.recallStore.traceBackward('GRANDCHILD');
    expect(backward.length).toBe(2);
    expect(backward[0].lotId).toBe('CHILD');
    expect(backward[1].lotId).toBe('ROOT');
  });

  it('should return summary with counts', async () => {
    await mod.recallStore.add({ lotId: 'LOTA', reason: 'A', severity: 'critical' });
    await mod.recallStore.add({ lotId: 'LOTB', reason: 'B', severity: 'medium' });
    const sum = await mod.recallStore.getSummary();
    expect(sum.total).toBe(2);
    expect(sum.open).toBe(2);
    expect(sum.critical).toBe(1);
  });
});

// ============================================================
// consolidatedStore tests
// ============================================================
describe('consolidatedStore', () => {
  let mod;
  beforeEach(async () => {
    clearStore();
    mod = await import('../stores/consolidated.js');
  });

  it('should compute total assets with equipment', async () => {
    const equip = await import('../stores/equipment.js');
    await equip.equipmentStore.add({ name: 'Pump A', type: 'pump', status: 'active' });
    const assets = await mod.consolidatedStore.getTotalAssets();
    expect(assets.equipment.total).toBe(1);
    expect(assets.equipment.active).toBe(1);
  });

  it('should compute integrated P&L', async () => {
    const fin = await import('../stores/finance.js');
    await fin.financeStore.addExpense({ category: 'seed', amount: 1000000, note: 'test' });
    await fin.financeStore.addRevenue({ category: 'harvest', amount: 5000000, note: 'test' });
    const pandl = await mod.consolidatedStore.getIntegratedPandL();
    expect(pandl.totalExpense).toBe(1000000);
    expect(pandl.totalRevenue).toBe(5000000);
    expect(pandl.grossProfit).toBe(4000000);
    expect(pandl.margin).toBe(80);
  });

  it('should compute master KPI with all sections', async () => {
    const kpi = await mod.consolidatedStore.getMasterKPI();
    expect(kpi).toHaveProperty('assets');
    expect(kpi).toHaveProperty('finance');
    expect(kpi).toHaveProperty('inventory');
    expect(kpi).toHaveProperty('equipment');
    expect(kpi).toHaveProperty('contracts');
    expect(kpi).toHaveProperty('recalls');
    expect(kpi).toHaveProperty('inspections');
    expect(kpi).toHaveProperty('soils');
    expect(kpi.timestamp).toBeGreaterThan(0);
  });

  it('should return null for missing lot report', async () => {
    const report = await mod.consolidatedStore.getLotReport(null);
    expect(report).toBeNull();
  });
});
