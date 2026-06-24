import { get, set } from 'idb-keyval';

const EQUIP_KEY = 'equip:registry';
const MAINT_KEY = 'equip:maintenance';
const FUEL_KEY = 'equip:fuel';

const EQ_TYPES = [
  { id: 'pump', label: 'Máy bơm', icon: '🔄' },
  { id: 'tractor', label: 'Máy kéo', icon: '🚜' },
  { id: 'sprayer', label: 'Máy phun', icon: '💨' },
  { id: 'generator', label: 'Máy phát điện', icon: '⚡' },
  { id: 'filter', label: 'Bộ lọc', icon: '🔧' },
  { id: 'sensor', label: 'Cảm biến', icon: '📡' },
  { id: 'valve', label: 'Van điện từ', icon: '🚰' },
  { id: 'controller', label: 'Bộ điều khiển', icon: '🖥' },
  { id: 'other', label: 'Khác', icon: '📦' }
];

const MAINT_TYPES = [
  { id: 'oil_change', label: 'Thay dầu' },
  { id: 'filter_clean', label: 'Vệ sinh lọc' },
  { id: 'inspection', label: 'Kiểm tra' },
  { id: 'repair', label: 'Sửa chữa' },
  { id: 'replacement', label: 'Thay thế phụ tùng' },
  { id: 'general', label: 'Bảo dưỡng chung' }
];

function genId() { return `eq_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`; }

export const EQUIPMENT_TYPES = EQ_TYPES;
export const MAINTENANCE_TYPES = MAINT_TYPES;

export const equipmentStore = {
  async getAll() { return (await get(EQUIP_KEY)) || []; },

  async getById(id) {
    const list = await this.getAll();
    return list.find(e => e.id === id) || null;
  },

  async add({ name, type, brand, model, purchaseDate, status, notes, zoneId }) {
    if (!name || !type) return false;
    const list = await this.getAll();
    const item = {
      id: genId(),
      name: name.trim(),
      type,
      brand: (brand || '').trim(),
      model: (model || '').trim(),
      purchaseDate: purchaseDate || '',
      status: status || 'active',
      zoneId: zoneId || '',
      notes: notes || '',
      createdAt: Date.now()
    };
    list.unshift(item);
    await set(EQUIP_KEY, list);
    return item;
  },

  async update(id, data) {
    const list = await this.getAll();
    const idx = list.findIndex(e => e.id === id);
    if (idx === -1) return false;
    list[idx] = { ...list[idx], ...data, id };
    await set(EQUIP_KEY, list);
    return list[idx];
  },

  async delete(id) {
    let list = await this.getAll();
    list = list.filter(e => e.id !== id);
    await set(EQUIP_KEY, list);
    return true;
  },

  async getMaintenance(equipId, limit = 100) {
    const all = (await get(MAINT_KEY)) || [];
    const filtered = equipId ? all.filter(m => m.equipId === equipId) : all;
    return filtered.slice(0, limit);
  },

  async addMaintenance({ equipId, type, cost, notes, date, nextDue }) {
    if (!equipId || !type) return false;
    const all = (await get(MAINT_KEY)) || [];
    const entry = {
      id: `mnt_${Date.now()}_${Math.random().toString(36).slice(2, 4)}`,
      equipId,
      type,
      cost: +(cost || 0),
      notes: notes || '',
      date: date || new Date().toISOString().slice(0, 10),
      nextDue: nextDue || '',
      createdAt: Date.now()
    };
    all.unshift(entry);
    await set(MAINT_KEY, all.slice(0, 1000));
    return entry;
  },

  async getFuel(equipId, limit = 100) {
    const all = (await get(FUEL_KEY)) || [];
    const filtered = equipId ? all.filter(f => f.equipId === equipId) : all;
    return filtered.slice(0, limit);
  },

  async addFuel({ equipId, liters, cost, date, notes }) {
    if (!equipId || !liters || liters <= 0) return false;
    const all = (await get(FUEL_KEY)) || [];
    const entry = {
      id: `fuel_${Date.now()}_${Math.random().toString(36).slice(2, 4)}`,
      equipId,
      liters: +liters,
      cost: +(cost || 0),
      date: date || new Date().toISOString().slice(0, 10),
      notes: notes || '',
      createdAt: Date.now()
    };
    all.unshift(entry);
    await set(FUEL_KEY, all.slice(0, 1000));
    return entry;
  },

  async getSummary() {
    const list = await this.getAll();
    const total = list.length;
    const active = list.filter(e => e.status === 'active').length;
    const maintenance = list.filter(e => e.status === 'maintenance').length;
    const broken = list.filter(e => e.status === 'broken').length;
    const byType = {};
    for (const e of list) {
      byType[e.type] = (byType[e.type] || 0) + 1;
    }
    return { total, active, maintenance, broken, byType };
  }
};

if (typeof window !== 'undefined') window.equipmentStore = equipmentStore;
