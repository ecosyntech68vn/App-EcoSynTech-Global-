import { get, set, keys } from 'idb-keyval';
import { authStore } from './auth.js';

const FIN_PREFIX = 'finance:';
const EXPENSE_CATS = [
  { id: 'seed', label: 'Giống', icon: '🌱' },
  { id: 'fertilizer', label: 'Phân bón', icon: '🧪' },
  { id: 'pesticide', label: 'Thuốc BVTV', icon: '🧴' },
  { id: 'labor', label: 'Nhân công', icon: '👷' },
  { id: 'water', label: 'Nước tưới', icon: '💧' },
  { id: 'electricity', label: 'Điện', icon: '⚡' },
  { id: 'fuel', label: 'Nhiên liệu', icon: '⛽' },
  { id: 'maintenance', label: 'Bảo trì', icon: '🔧' },
  { id: 'transport', label: 'Vận chuyển', icon: '🚛' },
  { id: 'rent', label: 'Thuê đất/máy', icon: '🏠' },
  { id: 'packaging', label: 'Bao bì', icon: '📦' },
  { id: 'other', label: 'Khác', icon: '📋' }
];
const REVENUE_CATS = [
  { id: 'harvest', label: 'Bán thu hoạch', icon: '💰' },
  { id: 'other', label: 'Khác', icon: '📋' }
];

function genId() { return `fin_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`; }

export const CATEGORIES = { expense: EXPENSE_CATS, revenue: REVENUE_CATS };

export const financeStore = {
  async getAll() {
    const all = [];
    const ks = await keys();
    for (const k of ks) {
      if (typeof k === 'string' && k.startsWith(FIN_PREFIX)) {
        const entries = await get(k);
        if (Array.isArray(entries)) all.push(...entries);
      }
    }
    all.sort((a, b) => (b.date || b.createdAt || 0) - (a.date || a.createdAt || 0));
    return all;
  },

  async getByLot(lotId) {
    const all = await this.getAll();
    return all.filter(e => e.lotId === lotId);
  },

  async getByDateRange(from, to) {
    const all = await this.getAll();
    const f = new Date(from).getTime();
    const t = new Date(to).getTime();
    return all.filter(e => {
      const d = new Date(e.date || e.createdAt).getTime();
      return d >= f && d <= t;
    });
  },

  async addExpense({ lotId, category, amount, note, date }) {
    if (!amount || amount <= 0) return false;
    if (!EXPENSE_CATS.find(c => c.id === category)) return false;
    const entry = {
      id: genId(),
      type: 'expense',
      lotId: lotId || '',
      category,
      amount: +amount,
      note: note || '',
      date: date || new Date().toISOString().slice(0, 10),
      createdAt: Date.now(),
      farmerId: authStore.farmerId || 'local'
    };
    const key = FIN_PREFIX + (lotId || 'general');
    const existing = (await get(key)) || [];
    existing.unshift(entry);
    await set(key, existing.slice(0, 2000));
    return entry;
  },

  async addRevenue({ lotId, category, amount, note, date, buyer }) {
    if (!amount || amount <= 0) return false;
    const entry = {
      id: genId(),
      type: 'revenue',
      lotId: lotId || '',
      category: category || 'harvest',
      amount: +amount,
      note: note || '',
      buyer: buyer || '',
      date: date || new Date().toISOString().slice(0, 10),
      createdAt: Date.now(),
      farmerId: authStore.farmerId || 'local'
    };
    const key = FIN_PREFIX + 'rev_' + (lotId || 'general');
    const existing = (await get(key)) || [];
    existing.unshift(entry);
    await set(key, existing.slice(0, 2000));
    return entry;
  },

  async deleteEntry(id) {
    const all = await this.getAll();
    const entry = all.find(e => e.id === id);
    if (!entry) return false;
    const key = entry.type === 'expense'
      ? FIN_PREFIX + (entry.lotId || 'general')
      : FIN_PREFIX + 'rev_' + (entry.lotId || 'general');
    const existing = (await get(key)) || [];
    await set(key, existing.filter(e => e.id !== id));
    return true;
  },

  async getSummary(lotId) {
    const entries = lotId ? await this.getByLot(lotId) : await this.getAll();
    const expenses = entries.filter(e => e.type === 'expense');
    const revenues = entries.filter(e => e.type === 'revenue');
    const totalExpense = expenses.reduce((s, e) => s + e.amount, 0);
    const totalRevenue = revenues.reduce((s, e) => s + e.amount, 0);
    const byCategory = {};
    for (const e of expenses) {
      byCategory[e.category] = (byCategory[e.category] || 0) + e.amount;
    }
    return {
      totalExpense,
      totalRevenue,
      profit: totalRevenue - totalExpense,
      expenseCount: expenses.length,
      revenueCount: revenues.length,
      byCategory
    };
  },

  async exportCsv(lotId) {
    const entries = lotId ? await this.getByLot(lotId) : await this.getAll();
    if (!entries.length) return '';
    const header = 'ID,Loại,Danh mục,Lô,Ngày,Số tiền,Ghi chú,Người mua,Ngày tạo';
    const rows = entries.map(e => {
      const catList = CATEGORIES[e.type] || [];
      const catLabel = catList.find(c => c.id === e.category)?.label || e.category;
      return [
        e.id, e.type === 'expense' ? 'Chi' : 'Thu', catLabel,
        e.lotId || '', e.date || '', e.amount, (e.note || '').replace(/,/g, ';'),
        e.buyer || '', new Date(e.createdAt).toISOString().slice(0, 10)
      ].join(',');
    });
    return header + '\n' + rows.join('\n');
  }
};

if (typeof window !== 'undefined') window.financeStore = financeStore;
