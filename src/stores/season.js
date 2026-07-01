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

// ===== Vùng miền & lịch thời vụ thông minh =====

// Mùa vụ theo vùng miền (Nam Bộ, Trung Bộ, Bắc Bộ)
const REGION_SEASONS = {
  'nam-bo': {
    label: 'Nam Bộ',
    provinces: ['An Giang','Bạc Liêu','Bến Tre','Bình Dương','Bình Phước','Bình Thuận','Cà Mau','Cần Thơ','Đồng Nai','Đồng Tháp','Hậu Giang','TP.HCM','Kiên Giang','Long An','Ninh Thuận','Sóc Trăng','Tây Ninh','Tiền Giang','Trà Vinh','Vĩnh Long','Bà Rịa-Vũng Tàu'],
    cropCalendar: {
      'Lúa': [
        { season: 'Đông Xuân', startMonth: 11, endMonth: 2, note: 'Vụ chính, năng suất cao nhất' },
        { season: 'Hè Thu', startMonth: 4, endMonth: 7, note: 'Vụ ngắn ngày, né lũ' },
        { season: 'Thu Đông', startMonth: 7, endMonth: 10, note: 'Vùng có đê bao' }
      ],
      'Rau muống': [
        { season: 'Chính vụ', startMonth: 2, endMonth: 10, note: 'Trồng quanh năm, tốt nhất T2-T10' }
      ],
      'Cà chua': [
        { season: 'Thu Đông', startMonth: 9, endMonth: 12, note: 'Né mưa, ít sâu bệnh' },
        { season: 'Xuân Hè', startMonth: 1, endMonth: 4, note: 'Cần che mưa' }
      ],
      'Dưa hấu': [
        { season: 'Tết', startMonth: 10, endMonth: 12, note: 'Phục vụ Tết Nguyên Đán' }
      ],
      'Sầu riêng': [
        { season: 'Chính vụ', startMonth: 4, endMonth: 8, note: 'Mùa nghịch: T11-T2 (kích thích)' }
      ],
      'Xoài': [
        { season: 'Chính vụ', startMonth: 2, endMonth: 5, note: 'Có thể xử lý ra hoa nghịch vụ' }
      ],
    }
  },
  'trung-bo': {
    label: 'Trung Bộ',
    provinces: ['Đà Nẵng','Quảng Nam','Quảng Ngãi','Bình Định','Phú Yên','Khánh Hòa','Thừa Thiên-Huế','Quảng Trị','Quảng Bình','Hà Tĩnh','Nghệ An','Thanh Hóa'],
    cropCalendar: {
      'Lúa': [
        { season: 'Đông Xuân', startMonth: 10, endMonth: 1, note: 'Vụ chính, né lũ' },
        { season: 'Hè Thu', startMonth: 4, endMonth: 7, note: 'Chủ động nước tưới' }
      ],
      'Rau muống': [
        { season: 'Xuân Hè', startMonth: 3, endMonth: 8, note: 'Trồng sau rét' }
      ],
      'Cà chua': [
        { season: 'Thu Đông', startMonth: 8, endMonth: 11, note: 'Né lũ' }
      ],
      'Dưa hấu': [
        { season: 'Xuân Hè', startMonth: 2, endMonth: 5, note: 'Né mưa bão' }
      ],
    }
  },
  'bac-bo': {
    label: 'Bắc Bộ',
    provinces: ['Hà Nội','Hải Phòng','Hải Dương','Hưng Yên','Thái Bình','Nam Định','Ninh Bình','Hà Nam','Vĩnh Phúc','Bắc Ninh','Bắc Giang','Thái Nguyên','Lạng Sơn','Quảng Ninh','Phú Thọ','Tuyên Quang','Hòa Bình','Sơn La','Điện Biên','Lai Châu','Lào Cai','Yên Bái','Hà Giang','Cao Bằng'],
    cropCalendar: {
      'Lúa': [
        { season: 'Xuân', startMonth: 2, endMonth: 6, note: 'Vụ chính miền Bắc' },
        { season: 'Mùa', startMonth: 6, endMonth: 10, note: 'Vụ mùa, ứng phó rét cuối vụ' }
      ],
      'Rau muống': [
        { season: 'Hè', startMonth: 4, endMonth: 9, note: 'Sau rét' }
      ],
      'Cà chua': [
        { season: 'Vụ đông', startMonth: 8, endMonth: 12, note: 'Cây vụ đông đặc sản' }
      ],
      'Ngô': [
        { season: 'Xuân', startMonth: 2, endMonth: 6, note: 'Vụ chính' },
        { season: 'Đông', startMonth: 9, endMonth: 12, note: 'Ngô đông' }
      ],
    }
  }
};

export function getRegionRegion(province) {
  if (!province) return null;
  for (const [key, reg] of Object.entries(REGION_SEASONS)) {
    if (reg.provinces.some(p => province.toLowerCase().includes(p.toLowerCase()))) {
      return key;
    }
  }
  return null;
}

export function getRegionSeasons(regionKey) {
  return REGION_SEASONS[regionKey] || null;
}

export function getCropAdviceForRegion(regionKey, crop) {
  const region = REGION_SEASONS[regionKey];
  if (!region) return [];
  const now = new Date().getMonth() + 1; // 1-12
  const calendar = region.cropCalendar;
  if (!calendar) return [];

  // Find matching crop
  const lower = crop.toLowerCase().trim();
  const entry = Object.entries(calendar).find(([k]) => lower.includes(k.toLowerCase()));
  if (!entry) return { current: null, all: entry?.[1] || null };

  const [cropName, seasons] = entry;
  const current = seasons.find(s => {
    if (s.startMonth <= s.endMonth) {
      return now >= s.startMonth && now <= s.endMonth;
    } else {
      return now >= s.startMonth || now <= s.endMonth;
    }
  });

  return { current: current || null, all: seasons, cropName };
}

export function listAllRegions() {
  return Object.entries(REGION_SEASONS).map(([key, r]) => ({
    key,
    label: r.label,
    provinceCount: r.provinces.length
  }));
}
