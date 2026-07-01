import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockStore = {};

vi.mock('idb-keyval', () => ({
  get: vi.fn(async (key) => mockStore[key] || null),
  set: vi.fn(async (key, val) => { mockStore[key] = val; }),
  del: vi.fn(async (key) => { delete mockStore[key]; }),
  keys: vi.fn(async () => Object.keys(mockStore))
}));

vi.mock('../stores/auth.js', () => ({
  authStore: { farmerId: 'test-farmer', role: 'admin' }
}));

vi.mock('../stores/audit.js', () => ({
  auditStore: { log: vi.fn(), logConfig: vi.fn() }
}));

vi.mock('../db/trace.js', () => ({
  lotsStore: { list: vi.fn(async () => [{ id: 'LOT001', name: 'Ca chua', crop: 'Ca chua' }]) },
  validateGTIN: (g) => typeof g === 'string' && /^\d{13}$/.test(g),
  generateGTIN13: (b) => b && b.length === 12 ? b + '8' : '',
  gs1DigitalLink: (g, lot, s) => g ? `https://ecosyntech.com/trace/01/${g}/10/${lot || ''}` : '',
  formatGS1AIString: (g, lot, s) => g ? `01${g}10${lot || ''}${s ? '21' + s : ''}` : '',
  buildEPCISEvent: (p) => ({ isA: 'ObjectEvent', gtin: p.gtin, lot: p.lot })
}));

function clearStore() {
  Object.keys(mockStore).forEach(k => delete mockStore[k]);
}

// ============================================================
// Blockchain Store Tests
// ============================================================
describe('blockchainStore', () => {
  let mod;
  beforeEach(async () => {
    clearStore();
    mod = await import('../stores/blockchain.js');
  });

  it('should record batch creation', async () => {
    const tx = await mod.blockchainStore.recordBatch({
      batchId: 'LOT001', productName: 'Ca chua', gtin: '8938561601003', crop: 'Ca chua', quantity: 100, unit: 'kg'
    });
    expect(tx).not.toBeNull();
    expect(tx.type).toBe('batch_create');
    expect(tx.hash).toMatch(/^0x/);
    expect(tx.payload.batchId).toBe('LOT001');
  });

  it('should record stage', async () => {
    await mod.blockchainStore.recordBatch({ batchId: 'LOT001', productName: 'Test' });
    const tx = await mod.blockchainStore.recordStage({ batchId: 'LOT001', stage: 'growing', details: 'Bón phân lần 1' });
    expect(tx.type).toBe('stage_growing');
  });

  it('should record harvest', async () => {
    await mod.blockchainStore.recordBatch({ batchId: 'LOT001', productName: 'Test' });
    const tx = await mod.blockchainStore.recordHarvest({ batchId: 'LOT001', quantity: 500, unit: 'kg', grade: 'A' });
    expect(tx.type).toBe('harvest');
    expect(tx.payload.quantity).toBe(500);
  });

  it('should record export', async () => {
    await mod.blockchainStore.recordBatch({ batchId: 'LOT001', productName: 'Test' });
    const tx = await mod.blockchainStore.recordExport({
      batchId: 'LOT001', buyer: 'Công ty A', destination: 'Nhật Bản', quantity: 500, unit: 'kg'
    });
    expect(tx.type).toBe('export');
    expect(tx.payload.destination).toBe('Nhật Bản');
  });

  it('should record certification', async () => {
    await mod.blockchainStore.recordBatch({ batchId: 'LOT001', productName: 'Test' });
    const tx = await mod.blockchainStore.recordCertification({
      batchId: 'LOT001', certType: 'Organic', certBody: 'Control Union', certNumber: 'CU-2026-001'
    });
    expect(tx.type).toBe('certification');
    expect(tx.payload.certType).toBe('Organic');
  });

  it('should verify hash', async () => {
    await mod.blockchainStore.recordBatch({ batchId: 'LOT001', productName: 'Test' });
    const txs = await mod.blockchainStore.getBatchChain('LOT001');
    const result = await mod.blockchainStore.verifyHash('LOT001', txs[0].dataHash);
    expect(result.verified).toBe(true);
    expect(result.txCount).toBeGreaterThanOrEqual(1);
  });

  it('should verify batch integrity', async () => {
    await mod.blockchainStore.recordBatch({ batchId: 'LOT002', productName: 'Test 2' });
    await mod.blockchainStore.recordHarvest({ batchId: 'LOT002', quantity: 100, unit: 'kg', grade: 'A' });
    const integrity = await mod.blockchainStore.verifyBatchIntegrity('LOT002');
    expect(integrity.verified).toBe(true);
    expect(integrity.txCount).toBe(2);
  });

  it('should return not verified for missing batch', async () => {
    const integrity = await mod.blockchainStore.verifyBatchIntegrity('NONEXISTENT');
    expect(integrity.verified).toBe(false);
    expect(integrity.reason).toBe('NO_TRANSACTIONS');
  });

  it('should generate GS1 Digital Link', () => {
    const link = mod.blockchainStore.generateGS1DigitalLink({
      gtin: '8938561601003', batch: 'LOT001', serial: 'S001', prodDate: '2026-06-01'
    });
    expect(link).toContain('8938561601003');
    expect(link).toContain('LOT001');
  });

  it('should generate GS1 QR data string', () => {
    const data = mod.blockchainStore.generateGS1QRData('8938561601003', 'LOT001', 'S001');
    expect(data).toBe('01893856160100310LOT00121S001');
  });

  it('should return explorer URL', () => {
    const url = mod.blockchainStore.getExplorerUrl('0xabc123', 'testnet');
    expect(url).toContain('explorer.aptoslabs.com');
    expect(url).toContain('0xabc123');
  });

  it('should compute summary stats', async () => {
    await mod.blockchainStore.recordBatch({ batchId: 'LOT001', productName: 'A' });
    await mod.blockchainStore.recordStage({ batchId: 'LOT001', stage: 'growing' });
    await mod.blockchainStore.recordHarvest({ batchId: 'LOT001', quantity: 100, unit: 'kg' });
    const summary = await mod.blockchainStore.getSummary();
    expect(summary.totalTx).toBe(3);
    expect(summary.uniqueBatches).toBe(1);
  });

  it('should handle export to national system', async () => {
    await mod.blockchainStore.recordBatch({ batchId: 'LOT001', productName: 'Test' });
    const result = await mod.blockchainStore.exportToNationalSystem('LOT001');
    expect(result.batchId).toBe('LOT001');
    expect(result.status).toBe('pending_sync');
    const pending = await mod.blockchainStore.getPendingSync();
    expect(pending.length).toBe(1);
  });
});

// ============================================================
// Logistics Store Tests
// ============================================================
describe('logisticsStore', () => {
  let mod;
  beforeEach(async () => {
    clearStore();
    mod = await import('../stores/logistics.js');
  });

  it('should create shipment', async () => {
    const s = await mod.logisticsStore.createShipment({
      carrierId: 'vnpost',
      receiverName: 'Nguyễn Văn A',
      receiverPhone: '0909123456',
      receiverAddr: 'Hà Nội',
      weight: 10, cod: 500000
    });
    expect(s).not.toBeNull();
    expect(s.status).toBe('pending');
    expect(s.receiverName).toBe('Nguyễn Văn A');
  });

  it('should update tracking code', async () => {
    await mod.logisticsStore.createShipment({ carrierId: 'vnpost', receiverName: 'A', receiverAddr: 'HN' });
    const list = await mod.logisticsStore.getAll();
    await mod.logisticsStore.updateTracking(list[0].id, 'VN123456');
    const updated = await mod.logisticsStore.getAll();
    expect(updated[0].trackingCode).toBe('VN123456');
    expect(updated[0].status).toBe('created');
  });

  it('should update status', async () => {
    await mod.logisticsStore.createShipment({ carrierId: 'vnpost', receiverName: 'A', receiverAddr: 'HN' });
    const list = await mod.logisticsStore.getAll();
    await mod.logisticsStore.updateStatus(list[0].id, 'delivered', 'Giao thành công');
    const updated = await mod.logisticsStore.getAll();
    expect(updated[0].status).toBe('delivered');
    expect(updated[0].statusHistory.length).toBe(2); // pending + delivered
  });

  it('should get by contract', async () => {
    await mod.logisticsStore.createShipment({ carrierId: 'vnpost', contractId: 'CTR001', receiverName: 'A', receiverAddr: 'HN' });
    await mod.logisticsStore.createShipment({ carrierId: 'vnpost', contractId: 'CTR002', receiverName: 'B', receiverAddr: 'HCM' });
    const byCtr = await mod.logisticsStore.getByContract('CTR001');
    expect(byCtr.length).toBe(1);
  });

  it('should lookup tracking', async () => {
    const result = await mod.logisticsStore.lookupTracking('VN123', 'vnpost');
    expect(result).not.toBeNull();
    expect(result.carrier).toContain('VNPost');
    expect(result.events.length).toBeGreaterThanOrEqual(1);
  });

  it('should compute summary', async () => {
    await mod.logisticsStore.createShipment({ carrierId: 'vnpost', receiverName: 'A', receiverAddr: 'HN', cod: 100000 });
    await mod.logisticsStore.createShipment({ carrierId: 'vnpost', receiverName: 'B', receiverAddr: 'HCM', cod: 200000 });
    const summary = await mod.logisticsStore.getSummary();
    expect(summary.total).toBe(2);
    expect(summary.totalCod).toBe(300000);
  });

  it('should delete shipment', async () => {
    await mod.logisticsStore.createShipment({ carrierId: 'vnpost', receiverName: 'A', receiverAddr: 'HN' });
    const list = await mod.logisticsStore.getAll();
    await mod.logisticsStore.delete(list[0].id);
    const after = await mod.logisticsStore.getAll();
    expect(after.length).toBe(0);
  });

  it('should reject without receiverName', async () => {
    const s = await mod.logisticsStore.createShipment({ carrierId: 'vnpost', receiverName: '' });
    expect(s).toBeNull();
  });
});
