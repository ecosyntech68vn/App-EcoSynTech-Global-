import { get, set } from 'idb-keyval';

const SEASON_PREFIX = 'season:plan:';
const SEASON_IDX_KEY = 'season:index';

// Ma trận luân canh: crop family → danh sách family có thể trồng tiếp theo
const CROP_FAMILIES = {
  'lúa': 'poaceae_rice',
  'lúa nước': 'poaceae_rice',
  'lúa cạn': 'poaceae_rice',
  'ngô': 'poaceae_corn',
  'bắp': 'poaceae_corn',
  'lúa mì': 'poaceae_wheat',
  'rau muống': 'convolvulaceae',
  'rau cải': 'brassicaceae',
  'cải bẹ': 'brassicaceae',
  'cải thảo': 'brassicaceae',
  'bông cải': 'brassicaceae',
  'su hào': 'brassicaceae',
  'cà chua': 'solanaceae',
  'cà tím': 'solanaceae',
  'ớt': 'solanaceae',
  'khoai tây': 'solanaceae',
  'thuốc lá': 'solanaceae',
  'dưa leo': 'cucurbitaceae',
  'dưa hấu': 'cucurbitaceae',
  'bí': 'cucurbitaceae',
  'mướp': 'cucurbitaceae',
  'bầu': 'cucurbitaceae',
  'khổ qua': 'cucurbitaceae',
  'đậu xanh': 'fabaceae',
  'đậu nành': 'fabaceae',
  'đậu phộng': 'fabaceae',
  'đậu đen': 'fabaceae',
  'lạc': 'fabaceae',
  'hành': 'alliaceae',
  'tỏi': 'alliaceae',
  'kiệu': 'alliaceae',
  'xoài': 'anacardiaceae',
  'điều': 'anacardiaceae',
  'sầu riêng': 'malvaceae_durio',
  'cà phê': 'rubiaceae',
  'tiêu': 'piperaceae',
  'hồ tiêu': 'piperaceae',
  'thanh long': 'cactaceae',
  'chuối': 'musaceae',
  'cam': 'rutaceae',
  'quýt': 'rutaceae',
  'chanh': 'rutaceae',
  'bưởi': 'rutaceae',
  'nhãn': 'sapindaceae',
  'vải': 'sapindaceae',
  'chôm chôm': 'sapindaceae',
};

const ROTATION_ADVICE = {
  'poaceae_rice': ['fabaceae', 'brassicaceae', 'cucurbitaceae', 'convolvulaceae'],
  'poaceae_corn': ['fabaceae', 'brassicaceae', 'solanaceae', 'cucurbitaceae'],
  'brassicaceae': ['solanaceae', 'cucurbitaceae', 'alliaceae', 'fabaceae'],
  'solanaceae': ['fabaceae', 'brassicaceae', 'alliaceae', 'poaceae_corn'],
  'cucurbitaceae': ['fabaceae', 'brassicaceae', 'alliaceae', 'poaceae_corn'],
  'fabaceae': ['poaceae_rice', 'poaceae_corn', 'brassicaceae', 'solanaceae', 'cucurbitaceae'],
  'alliaceae': ['solanaceae', 'cucurbitaceae', 'fabaceae', 'brassicaceae'],
  'convolvulaceae': ['fabaceae', 'brassicaceae', 'solanaceae'],
};

function detectFamily(crop) {
  const key = crop.toLowerCase().trim();
  return CROP_FAMILIES[key] || null;
}

export function suggestRotation(previousCrop) {
  const family = detectFamily(previousCrop);
  if (!family) return [];
  const follow = ROTATION_ADVICE[family] || [];
  const suggestions = [];
  for (const [name, fam] of Object.entries(CROP_FAMILIES)) {
    if (follow.includes(fam) && !suggestions.some(s => s.family === fam)) {
      suggestions.push({ crop: name, family: fam });
    }
  }
  suggestions.sort((a, b) => a.crop.localeCompare(b.crop, 'vi'));
  return suggestions;
}

export function getCropFamily(crop) {
  return detectFamily(crop);
}

export const seasonStore = {
  async list() {
    const idx = await get(SEASON_IDX_KEY);
    if (!idx || !Array.isArray(idx)) return [];
    const out = [];
    for (const id of idx) {
      const v = await get(SEASON_PREFIX + id);
      if (v) out.push(v);
    }
    return out.sort((a, b) => (b.plannedAt || '').localeCompare(a.plannedAt || ''));
  },

  async byId(id) {
    return (await get(SEASON_PREFIX + id)) || null;
  },

  async create({ name, crop, variety, zoneId, area, plannedAt, expectedYield, expectedRevenue, note }) {
    if (!crop) throw new Error('Thiếu tên cây trồng');
    if (!zoneId) throw new Error('Thiếu zone');
    const id = 's_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const plan = {
      id, name: name || '',
      crop, variety: variety || '',
      zoneId, area: area || '',
      plannedAt: plannedAt || new Date().toISOString().slice(0, 7),
      expectedYield: expectedYield || '',
      expectedRevenue: expectedRevenue || '',
      note: note || '',
      status: 'planned',
      createdAt: Date.now()
    };
    await set(SEASON_PREFIX + id, plan);
    const idx = (await get(SEASON_IDX_KEY)) || [];
    idx.push(id);
    await set(SEASON_IDX_KEY, idx);
    return plan;
  },

  async update(id, patch) {
    const plan = await this.byId(id);
    if (!plan) throw new Error('Không tìm thấy kế hoạch');
    Object.assign(plan, patch);
    await set(SEASON_PREFIX + id, plan);
    return plan;
  },

  async remove(id) {
    const idx = (await get(SEASON_IDX_KEY)) || [];
    await set(SEASON_IDX_KEY, idx.filter(i => i !== id));
  },

  async rotateAdviceForZone(zoneId) {
    const all = await this.list();
    const zonePlans = all.filter(p => p.zoneId === zoneId && p.status !== 'cancelled');
    if (zonePlans.length === 0) return { lastCrop: null, suggestions: [] };
    const last = zonePlans.sort((a, b) => (b.plannedAt || '').localeCompare(a.plannedAt || ''))[0];
    return {
      lastCrop: last.crop,
      suggestions: suggestRotation(last.crop)
    };
  }
};
