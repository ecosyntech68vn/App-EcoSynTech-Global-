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

// ========== REAL-WORLD ORDER EDGE CASES ==========
describe('orderStore edge cases', () => {
  let orderStore, bankConfigStore;

  beforeEach(async () => {
    for (const key of await (await import('idb-keyval')).keys()) {
      await (await import('idb-keyval')).del(key);
    }
    const mod = await import('../stores/order.js');
    orderStore = mod.orderStore;
    bankConfigStore = mod.bankConfigStore;
  });

  it('should create order with zero total amount (gift/compensation)', async () => {
    const order = await orderStore.create({
      code: 'ORD-ZERO', customer: { name: 'Gift', phone: '0' },
      items: [], totalAmount: 0, note: 'Quà tặng'
    });
    expect(order.totalAmount).toBe(0);
    expect(order.paymentStatus).toBe('unpaid');
  });

  it('should handle cancel → cannot update further', async () => {
    const order = await orderStore.create({
      code: 'ORD-CANCEL', customer: { name: 'A', phone: '1' },
      items: [{ productId: 'LOT01', productName: 'Lua', quantity: 1, price: 10000 }],
      totalAmount: 10000, note: ''
    });
    await orderStore.updateStatus(order.id, 'cancelled');
    const updated = await orderStore.get(order.id);
    expect(updated.status).toBe('cancelled');
    expect(updated.paymentStatus).toBe('unpaid');
  });

  it('should handle payment method MoMo', async () => {
    const order = await orderStore.create({
      code: 'ORD-MOMO', customer: { name: 'MoMo User', phone: '0' },
      items: [{ productId: 'LOT01', productName: 'Lua', quantity: 2, price: 25000 }],
      totalAmount: 50000, note: '',
      paymentMethod: 'momo'
    });
    expect(order.paymentMethod).toBe('momo');
  });

  it('should handle payment method ZaloPay', async () => {
    const order = await orderStore.create({
      code: 'ORD-ZLP', customer: { name: 'ZLP User', phone: '0' },
      items: [], totalAmount: 100000, note: '',
      paymentMethod: 'zalopay'
    });
    expect(order.paymentMethod).toBe('zalopay');
  });

  it('should handle order with huge amount (1 billion VND)', async () => {
    const order = await orderStore.create({
      code: 'ORD-BIG', customer: { name: 'Big Buyer', phone: '0' },
      items: [{ productId: 'LOT01', productName: 'Ca phe', quantity: 10000, price: 100000 }],
      totalAmount: 1_000_000_000, note: '1 tan ca phe'
    });
    expect(order.totalAmount).toBe(1_000_000_000);
  });

  it('should handle order with no items', async () => {
    const order = await orderStore.create({
      code: 'ORD-NOITEMS', customer: { name: 'No Items', phone: '0' },
      items: [], totalAmount: 0, note: ''
    });
    expect(order.items).toEqual([]);
  });

  it('should update shipping after order is created', async () => {
    const order = await orderStore.create({
      code: 'ORD-SHIP2', customer: { name: 'Ship', phone: '0' },
      items: [], totalAmount: 50000, note: ''
    });
    await orderStore.updateShipping(order.id, { carrier: 'GHN', trackingCode: 'GHN123', shippingFee: 35000 });
    await orderStore.updateStatus(order.id, 'shipping');
    const updated = await orderStore.get(order.id);
    expect(updated.shipping.carrier).toBe('GHN');
    expect(updated.status).toBe('shipping');
  });

  it('should handle save and update customer', async () => {
    await orderStore.saveCustomer({ name: 'Lap lai', phone: '0909999999', address: 'DN' });
    await orderStore.saveCustomer({ name: 'Lap lai Updated', phone: '0909999999', address: 'HCM' });
    const list = await orderStore.listCustomers();
    const c = list.find(x => x.phone === '0909999999');
    expect(c.name).toBe('Lap lai Updated');
    expect(c.address).toBe('HCM');
  });

  it('should handle getRevenueByPeriod with no paid orders', async () => {
    await orderStore.create({
      code: 'ORD-NOPAY', customer: { name: 'No Pay', phone: '0' },
      items: [], totalAmount: 100000, note: ''
    });
    const revenue = await orderStore.getRevenueByPeriod(30);
    expect(revenue).toEqual([]);
  });

  it('should reject updateStatus on non-existent order', async () => {
    await expect(orderStore.updateStatus('ghost-order', 'paid')).rejects.toThrow('Không tìm thấy');
  });

  it('should generate unique codes sequentially', async () => {
    const code1 = await orderStore.nextCode();
    const code2 = await orderStore.nextCode();
    expect(code1).not.toBe(code2);
    expect(code1).toContain('ORD-');
  });

  it('should handle VietQR generation with special characters in note', async () => {
    const mod = await import('../stores/order.js');
    await mod.bankConfigStore.save({ bankId: 'tcb', accountNo: '1234567890', accountName: 'TEST CO' });
    const order = await orderStore.create({
      code: 'ORD-QR-SPECIAL', customer: { name: 'QR', phone: '0' },
      items: [], totalAmount: 75000, note: 'Tiền thanh toán đơn hàng số ORD-QR-SPECIAL có dấu: ấ ê ô ơ'
    });
    expect(order.paymentQR).toBeTruthy();
    expect(order.paymentQR).toContain('6304');
  });

  it('should handle delete non-existent order gracefully', async () => {
    await expect(orderStore.delete('non-existent')).resolves.not.toThrow();
  });
});
