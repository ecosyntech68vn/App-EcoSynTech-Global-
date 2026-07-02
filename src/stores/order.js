import { get, set, del, keys } from 'idb-keyval';
import { authStore } from './auth.js';

const ORDER_PREFIX = 'order:';
const SEQ_KEY = 'order:seq';
const BANK_CFG_KEY = 'order:bank_config';
const CUSTOMER_PREFIX = 'order:customer:';
const ORDER_INDEX_KEY = 'order:index';

const BANK_LIST = [
  { id: 'vcb', bin: '970436', name: 'Vietcombank' },
  { id: 'tcb', bin: '970407', name: 'Techcombank' },
  { id: 'tpb', bin: '970418', name: 'TPBank' },
  { id: 'mbbank', bin: '970422', name: 'MB Bank' },
  { id: 'bidv', bin: '970488', name: 'BIDV' },
  { id: 'vietinbank', bin: '970415', name: 'VietinBank' },
  { id: 'agribank', bin: '970405', name: 'Agribank' },
  { id: 'vpbank', bin: '970432', name: 'VPBank' },
  { id: 'hdbank', bin: '970437', name: 'HDBank' },
  { id: 'acb', bin: '970416', name: 'ACB' },
  { id: 'sacombank', bin: '970403', name: 'Sacombank' },
  { id: 'shinhan', bin: '970424', name: 'Shinhan Bank' },
  { id: 'seabank', bin: '970440', name: 'SeABank' },
  { id: 'ocb', bin: '970448', name: 'OCB' },
  { id: 'msb', bin: '970426', name: 'MSB' },
  { id: 'pvcom', bin: '970412', name: 'PVcomBank' },
  { id: 'lpbank', bin: '970449', name: 'LienVietPostBank' },
  { id: 'vietcapital', bin: '970454', name: 'VietCapital Bank' }
];

function crc16(str) {
  let crc = 0xFFFF;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) crc = (crc << 1) ^ 0x1021;
      else crc <<= 1;
      crc &= 0xFFFF;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function generateVietQRContent(bin, accountNo, amount, note) {
  const amt = Math.round(amount).toString();
  const p00 = '000201';
  const p01 = '010212';
  const binLen = String(bin.length).padStart(2, '0');
  const accLen = String(accountNo.length).padStart(2, '0');
  const amtLen = String(amt.length).padStart(2, '0');
  const p38 = `38${binLen}${bin}01${accLen}${accountNo}`;
  const p54 = `54${amtLen}${amt}`;
  const noteEncoded = (note || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 .\-_]/g, '');
  const noteLen = String(noteEncoded.length).padStart(2, '0');
  const p62 = `62${noteLen}08${noteLen}${noteEncoded}`;
  const raw = `${p00}${p01}${p38}${p54}${p62}6304`;
  const crc = crc16(raw);
  return raw + crc;
}

export const bankConfigStore = {
  async save(cfg) {
    await set(BANK_CFG_KEY, cfg);
  },
  async load() {
    return (await get(BANK_CFG_KEY)) || { bankId: 'vcb', accountNo: '', accountName: '' };
  },
  getBankList() { return BANK_LIST; }
};

async function buildOrderIndex() {
  let idx = await get(ORDER_INDEX_KEY);
  if (idx && Array.isArray(idx) && idx.length > 0) return idx;
  const allKeys = await keys();
  const orderKeys = allKeys.filter(k => typeof k === 'string' && k.startsWith(ORDER_PREFIX) && k !== ORDER_INDEX_KEY);
  idx = [];
  for (const k of orderKeys) {
    const v = await get(k);
    if (v && v.id) idx.push(v.id);
  }
  if (idx.length > 0) await set(ORDER_INDEX_KEY, idx);
  return idx;
}

export const orderStore = {
  async nextCode() {
    const d = new Date();
    const yy = String(d.getFullYear()).slice(2);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const seq = ((await get(SEQ_KEY)) || 1000) + 1;
    return { code: `ORD-${yy}${mm}${dd}-${seq}`, seq };
  },

  async create({ code, customer, items, totalAmount, note, paymentMethod }) {
    let orderCode = code;
    let _seq;
    if (!orderCode) {
      const r = await this.nextCode();
      orderCode = r.code;
      _seq = r.seq;
    }
    const order = {
      id: 'ord_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      code: orderCode,
      createdAt: new Date().toISOString(),
      status: 'pending',
      customer: customer || { name: '', phone: '', address: '' },
      items: items || [],
      totalAmount: totalAmount || 0,
      paymentMethod: paymentMethod || 'bank_transfer',
      paymentStatus: 'unpaid',
      paidAt: null,
      note: note || '',
      shipping: null,
      history: [{ ts: new Date().toISOString(), status: 'pending', note: 'Đơn hàng được tạo' }]
    };

    const bankCfg = await bankConfigStore.load();
    if (bankCfg.accountNo && order.paymentMethod === 'bank_transfer') {
      const bank = BANK_LIST.find(b => b.id === bankCfg.bankId);
      if (bank) {
        order.paymentQR = generateVietQRContent(
          bank.bin,
          bankCfg.accountNo,
          order.totalAmount,
          `TT ${order.code}`
        );
      }
    }

    await set(ORDER_PREFIX + order.id, order);
    if (_seq) await set(SEQ_KEY, _seq);
    const idx = await buildOrderIndex();
    if (!idx.includes(order.id)) {
      idx.push(order.id);
      await set(ORDER_INDEX_KEY, idx);
    }
    return order;
  },

  async list() {
    const idx = await buildOrderIndex();
    const orders = [];
    for (const id of idx) {
      const v = await get(ORDER_PREFIX + id);
      if (v) orders.push(v);
    }
    orders.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    return orders;
  },

  async get(id) {
    return await get(ORDER_PREFIX + id);
  },

  async updateStatus(id, status, note) {
    const order = await this.get(id);
    if (!order) throw new Error('Không tìm thấy đơn hàng');
    order.status = status;
    if (!order.history) order.history = [];
    order.history.push({ ts: new Date().toISOString(), status, note: note || '' });
    if (status === 'paid') {
      order.paymentStatus = 'paid';
      order.paidAt = new Date().toISOString();
    }
    if (order.shipping && status === 'shipped') {
      order.shipping.shippedAt = new Date().toISOString();
    }
    await set(ORDER_PREFIX + id, order);
    return order;
  },

  async updateShipping(id, shipping) {
    const order = await this.get(id);
    if (!order) throw new Error('Không tìm thấy đơn hàng');
    order.shipping = { ...(order.shipping || {}), ...shipping };
    await set(ORDER_PREFIX + id, order);
    return order;
  },

  async delete(id) {
    await del(ORDER_PREFIX + id);
    const idx = await buildOrderIndex();
    await set(ORDER_INDEX_KEY, idx.filter(i => i !== id));
  },

  async saveCustomer(customer) {
    const list = await this.listCustomers();
    const idx = list.findIndex(c => c.phone === customer.phone);
    if (idx >= 0) list[idx] = { ...list[idx], ...customer, lastOrderAt: new Date().toISOString() };
    else list.push({ ...customer, lastOrderAt: new Date().toISOString() });
    await set(CUSTOMER_PREFIX + 'list', list);
    return list;
  },

  async listCustomers() {
    return (await get(CUSTOMER_PREFIX + 'list')) || [];
  },

  async getStats() {
    const orders = await this.list();
    const total = orders.length;
    const totalRevenue = orders
      .filter(o => o.paymentStatus === 'paid')
      .reduce((s, o) => s + (o.totalAmount || 0), 0);
    const pendingPayment = orders
      .filter(o => o.paymentStatus === 'unpaid' && o.status !== 'cancelled')
      .reduce((s, o) => s + (o.totalAmount || 0), 0);
    const paidCount = orders.filter(o => o.paymentStatus === 'paid').length;
    const cancelledCount = orders.filter(o => o.status === 'cancelled').length;
    return { total, totalRevenue, pendingPayment, paidCount, cancelledCount };
  },

  async getRevenueByPeriod(days) {
    const orders = await this.list();
    const cutoff = new Date(Date.now() - days * 86400000);
    const paid = orders.filter(o => o.paymentStatus === 'paid' && new Date(o.paidAt) >= cutoff);
    const daily = {};
    for (const o of paid) {
      const day = (o.paidAt || o.createdAt).slice(0, 10);
      daily[day] = (daily[day] || 0) + (o.totalAmount || 0);
    }
    return Object.entries(daily).sort((a, b) => a[0].localeCompare(b[0]));
  }
};
