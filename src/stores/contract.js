import { get, set } from 'idb-keyval';
import { authStore } from './auth.js';

const CONTRACT_KEY = 'contract:registry';
const DELIVERY_PREFIX = 'contract:delivery:';

const CONTRACT_TYPES = [
  { id: 'htx', label: 'HTX — Hợp đồng liên kết', icon: '🤝' },
  { id: 'forward', label: 'Bao tiêu đầu ra', icon: '📝' },
  { id: 'wholesale', label: 'Bán sỉ', icon: '🏪' },
  { id: 'retail', label: 'Bán lẻ', icon: '🛒' },
  { id: 'export', label: 'Xuất khẩu', icon: '🌐' }
];

const CONTRACT_STATUSES = [
  { id: 'active', label: 'Đang hiệu lực', color: '#2E7D32' },
  { id: 'completed', label: 'Đã hoàn thành', color: '#1565C0' },
  { id: 'cancelled', label: 'Đã hủy', color: '#999' },
  { id: 'pending', label: 'Chờ ký', color: '#F57F17' }
];

function genId() { return `ctr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`; }

export const CONTRACT_TYPES_LIST = CONTRACT_TYPES;
export const CONTRACT_STATUSES_LIST = CONTRACT_STATUSES;

export const contractStore = {
  async getAll() { return (await get(CONTRACT_KEY)) || []; },

  async getById(id) {
    const list = await this.getAll();
    return list.find(c => c.id === id) || null;
  },

  async add({ partnerName, partnerPhone, partnerAddress, type, crop, lotId, quantity, unit, price, startDate, endDate, notes }) {
    if (!partnerName) return false;
    const list = await this.getAll();
    const contract = {
      id: genId(),
      partnerName: partnerName.trim(),
      partnerPhone: (partnerPhone || '').trim(),
      partnerAddress: (partnerAddress || '').trim(),
      type: type || 'htx',
      crop: (crop || '').trim(),
      lotId: lotId || '',
      quantity: +(quantity || 0),
      unit: unit || 'kg',
      price: +(price || 0),
      totalValue: +(quantity || 0) * +(price || 0),
      startDate: startDate || new Date().toISOString().slice(0, 10),
      endDate: endDate || '',
      status: 'active',
      notes: notes || '',
      delivered: 0,
      paid: 0,
      createdAt: Date.now(),
      farmerId: authStore.farmerId || 'local'
    };
    list.unshift(contract);
    await set(CONTRACT_KEY, list);
    return contract;
  },

  async update(id, data) {
    const list = await this.getAll();
    const idx = list.findIndex(c => c.id === id);
    if (idx === -1) return false;
    if (data.quantity != null || data.price != null) {
      const q = data.quantity ?? list[idx].quantity;
      const p = data.price ?? list[idx].price;
      data.totalValue = +(q || 0) * +(p || 0);
    }
    list[idx] = { ...list[idx], ...data, id };
    await set(CONTRACT_KEY, list);
    return list[idx];
  },

  async delete(id) {
    let list = await this.getAll();
    list = list.filter(c => c.id !== id);
    await set(CONTRACT_KEY, list);
    return true;
  },

  async getDeliveries(contractId) {
    if (!contractId) return [];
    return (await get(DELIVERY_PREFIX + contractId)) || [];
  },

  async addDelivery({ contractId, date, quantity, quality, notes }) {
    if (!contractId || !quantity) return false;
    const contract = await this.getById(contractId);
    if (!contract) return false;
    const deliveries = await this.getDeliveries(contractId);
    const delivery = {
      id: `del_${Date.now()}_${Math.random().toString(36).slice(2, 4)}`,
      contractId,
      date: date || new Date().toISOString().slice(0, 10),
      quantity: +quantity,
      quality: quality || '',
      notes: notes || '',
      createdAt: Date.now()
    };
    deliveries.unshift(delivery);
    await set(DELIVERY_PREFIX + contractId, deliveries.slice(0, 500));
    const totalDelivered = deliveries.reduce((s, d) => s + d.quantity, 0);
    await this.update(contractId, { delivered: totalDelivered });
    return delivery;
  },

  async getSummary() {
    const list = await this.getAll();
    const active = list.filter(c => c.status === 'active').length;
    const completed = list.filter(c => c.status === 'completed').length;
    const totalValue = list.reduce((s, c) => s + (c.totalValue || 0), 0);
    const totalDelivered = list.reduce((s, c) => s + (c.delivered || 0), 0);
    return { total: list.length, active, completed, totalValue, totalDelivered };
  }
};

if (typeof window !== 'undefined') window.contractStore = contractStore;
