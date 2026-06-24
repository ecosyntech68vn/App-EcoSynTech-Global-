import { get, set } from 'idb-keyval';

const SOIL_KEY = 'soil:samples';

const TEXTURE_TYPES = [
  { id: 'sandy', label: 'Cát pha' },
  { id: 'loam', label: 'Thịt' },
  { id: 'clay', label: 'Sét' },
  { id: 'silt', label: 'Thịt pha sét' },
  { id: 'sandy_loam', label: 'Cát pha thịt' },
  { id: 'clay_loam', label: 'Sét pha thịt' }
];

function genId() { return `soil_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`; }

export const SOIL_TEXTURES = TEXTURE_TYPES;

export const soilStore = {
  async getAll() { return (await get(SOIL_KEY)) || []; },

  async add({ zoneId, depth, ph, n, p, k, organicMatter, moisture, texture, notes }) {
    if (!zoneId) return false;
    const list = await this.getAll();
    const sample = {
      id: genId(),
      zoneId: zoneId.trim(),
      depth: +(depth || 0),
      ph: ph != null ? +ph : null,
      n: n != null ? +n : null,
      p: p != null ? +p : null,
      k: k != null ? +k : null,
      organicMatter: organicMatter != null ? +organicMatter : null,
      moisture: moisture != null ? +moisture : null,
      texture: texture || '',
      notes: notes || '',
      date: new Date().toISOString().slice(0, 10),
      createdAt: Date.now()
    };
    list.unshift(sample);
    await set(SOIL_KEY, list.slice(0, 2000));
    return sample;
  },

  async getByZone(zoneId) {
    const all = await this.getAll();
    return all.filter(s => s.zoneId === zoneId);
  },

  async getHistory(zoneId) {
    const samples = await this.getByZone(zoneId);
    if (!samples.length) return null;
    const latest = samples[0];
    const avg = samples.reduce((acc, s) => {
      if (s.ph != null) acc.ph += s.ph;
      if (s.n != null) acc.n += s.n;
      if (s.p != null) acc.p += s.p;
      if (s.k != null) acc.k += s.k;
      if (s.organicMatter != null) acc.om += s.organicMatter;
      return acc;
    }, { ph: 0, n: 0, p: 0, k: 0, om: 0, count: 0 });
    avg.count = samples.length;
    const fields = ['ph', 'n', 'p', 'k', 'om'];
    for (const f of fields) {
      if (avg[f] !== undefined) {
        if (typeof avg[f] === 'number') {
          const key = f;
          avg[key] = Math.round(avg[key] / avg.count * 10) / 10;
        }
      }
    }
    return { samples, latest, average: avg };
  },

  async delete(id) {
    let list = await this.getAll();
    list = list.filter(s => s.id !== id);
    await set(SOIL_KEY, list);
    return true;
  },

  async getSummary() {
    const all = await this.getAll();
    const zoneCount = new Set(all.map(s => s.zoneId)).size;
    const avgPh = all.filter(s => s.ph != null).reduce((s, x) => s + x.ph, 0) / (all.filter(s => s.ph != null).length || 1);
    return { total: all.length, zoneCount, avgPh: Math.round(avgPh * 10) / 10 };
  }
};

if (typeof window !== 'undefined') window.soilStore = soilStore;
