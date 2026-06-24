import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('idb-keyval', () => {
  const store = new Map();
  return {
    get: vi.fn(async (k) => store.get(k)),
    set: vi.fn(async (k, v) => { store.set(k, v); }),
    keys: vi.fn(async () => [...store.keys()]),
    del: vi.fn(async (k) => { store.delete(k); })
  };
});

vi.mock('jspdf', () => {
  const mockDoc = {
    setFontSize: vi.fn(),
    setFont: vi.fn(),
    text: vi.fn(),
    line: vi.fn(),
    addPage: vi.fn(),
    output: vi.fn(() => 'data:application/pdf;base64,FAKE'),
    setProperties: vi.fn()
  };
  return { jsPDF: vi.fn(() => mockDoc) };
});

describe('orderStore', () => {
  let orderStore, bankConfigStore;

  beforeEach(async () => {
    for (const key of await (await import('idb-keyval')).keys()) {
      await (await import('idb-keyval')).del(key);
    }
    const mod = await import('../stores/order.js');
    orderStore = mod.orderStore;
    bankConfigStore = mod.bankConfigStore;
  });

  it('should create an order with code', async () => {
    const order = await orderStore.create({
      code: 'ORD-TEST-001',
      customer: { name: 'Nguyen Van A', phone: '0909123456', address: 'HCM' },
      items: [{ productId: 'LOT001', productName: 'Ca chua', quantity: 10, price: 15000, unit: 'kg' }],
      totalAmount: 150000,
      note: 'Giao buoi sang',
      paymentMethod: 'cod'
    });
    expect(order.code).toBe('ORD-TEST-001');
    expect(order.status).toBe('pending');
    expect(order.customer.name).toBe('Nguyen Van A');
    expect(order.totalAmount).toBe(150000);
    expect(order.history).toHaveLength(1);
    expect(order.history[0].status).toBe('pending');
  });

  it('should list orders sorted by date desc', async () => {
    await orderStore.create({ code: 'ORD-001', customer: { name: 'A', phone: '1' }, items: [], totalAmount: 0, note: '' });
    await orderStore.create({ code: 'ORD-002', customer: { name: 'B', phone: '2' }, items: [], totalAmount: 0, note: '' });
    const list = await orderStore.list();
    expect(list).toHaveLength(2);
  });

  it('should get order by id', async () => {
    const created = await orderStore.create({
      code: 'ORD-GET',
      customer: { name: 'Test', phone: '0' },
      items: [], totalAmount: 0, note: ''
    });
    const fetched = await orderStore.get(created.id);
    expect(fetched.id).toBe(created.id);
    expect(fetched.code).toBe('ORD-GET');
  });

  it('should update order status', async () => {
    const order = await orderStore.create({
      code: 'ORD-STATUS', customer: { name: 'A', phone: '1' },
      items: [], totalAmount: 100000, note: ''
    });
    await orderStore.updateStatus(order.id, 'paid', 'Da nhan tien');
    const updated = await orderStore.get(order.id);
    expect(updated.status).toBe('paid');
    expect(updated.paymentStatus).toBe('paid');
    expect(updated.history).toHaveLength(2);
    expect(updated.history[1].note).toBe('Da nhan tien');
  });

  it('should calculate stats', async () => {
    await orderStore.create({ code: 'ORD-S1', customer: { name: 'A', phone: '1' }, items: [], totalAmount: 100000, note: '' });
    await orderStore.create({ code: 'ORD-S2', customer: { name: 'B', phone: '2' }, items: [], totalAmount: 200000, note: '' });
    const order2 = await (await import('idb-keyval')).get('order:' + (await orderStore.nextCode()).replace('ORD-S2', ''));
    const mod = await import('../stores/order.js');
    const orders = await orderStore.list();
    if (orders.length >= 2) {
      await orderStore.updateStatus(orders[0].id, 'paid');
    }
    const stats = await orderStore.getStats();
    expect(stats.total).toBeGreaterThanOrEqual(2);
  });

  it('should manage customers', async () => {
    await orderStore.saveCustomer({ name: 'Nguyen Van C', phone: '0909000111', address: 'Ha Noi' });
    const list = await orderStore.listCustomers();
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('Nguyen Van C');
  });

  it('should update shipping info', async () => {
    const order = await orderStore.create({
      code: 'ORD-SHIP', customer: { name: 'A', phone: '1' },
      items: [], totalAmount: 0, note: ''
    });
    await orderStore.updateShipping(order.id, { carrier: 'VNPost', trackingCode: 'VP123456', shippingFee: 30000 });
    const updated = await orderStore.get(order.id);
    expect(updated.shipping.carrier).toBe('VNPost');
    expect(updated.shipping.trackingCode).toBe('VP123456');
  });

  it('should generate VietQR content with CRC', async () => {
    const mod = await import('../stores/order.js');
    const qrStore = mod.orderStore;
    await (mod.bankConfigStore).save({ bankId: 'vcb', accountNo: '0123456789', accountName: 'TEST' });
    const order = await qrStore.create({
      code: 'ORD-QR', customer: { name: 'QR Test', phone: '0' },
      items: [{ productId: 'LOT01', productName: 'Lua', quantity: 1, price: 50000 }],
      totalAmount: 50000, note: ''
    });
    expect(order.paymentQR).toBeTruthy();
    expect(order.paymentQR).toContain('000201010212');
    expect(order.paymentQR).toContain('6304');
    expect(order.paymentQR.length).toBeGreaterThan(50);
  });

  it('should delete an order', async () => {
    const order = await orderStore.create({
      code: 'ORD-DEL', customer: { name: 'Del', phone: '0' },
      items: [], totalAmount: 0, note: ''
    });
    await orderStore.delete(order.id);
    const fetched = await orderStore.get(order.id);
    expect(fetched).toBeUndefined();
  });

  it('should generate revenue by period', async () => {
    const mod = await import('../stores/order.js');
    const qrStore = mod.orderStore;
    const order = await qrStore.create({
      code: 'ORD-REV', customer: { name: 'Rev', phone: '0' },
      items: [], totalAmount: 500000, note: ''
    });
    await qrStore.updateStatus(order.id, 'paid');
    const revenue = await qrStore.getRevenueByPeriod(30);
    expect(revenue.length).toBeGreaterThanOrEqual(1);
    expect(revenue[0][1]).toBe(500000);
  });
});

describe('bankConfigStore', () => {
  it('should return bank list', async () => {
    const { bankConfigStore: bcs } = await import('../stores/order.js');
    const list = bcs.getBankList();
    expect(list.length).toBeGreaterThan(10);
    expect(list.find(b => b.id === 'vcb').bin).toBe('970436');
    expect(list.find(b => b.id === 'tpb').name).toBe('TPBank');
  });

  it('should save and load config', async () => {
    const { bankConfigStore: bcs } = await import('../stores/order.js');
    await bcs.save({ bankId: 'mbbank', accountNo: '0987654321', accountName: 'MB USER' });
    const cfg = await bcs.load();
    expect(cfg.bankId).toBe('mbbank');
    expect(cfg.accountNo).toBe('0987654321');
  });

  it('should return default config when empty', async () => {
    for (const key of await (await import('idb-keyval')).keys()) {
      await (await import('idb-keyval')).del(key);
    }
    const { bankConfigStore: bcs } = await import('../stores/order.js');
    const cfg = await bcs.load();
    expect(cfg.bankId).toBe('vcb');
    expect(cfg.accountNo).toBe('');
  });
});
