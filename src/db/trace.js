// trace.js — V3.1 Truy xuất nguồn gốc: Lô/Mùa vụ + Vật tư (PHI) + Event log append-only
// Thiết kế:
//  · LOCAL-FIRST: toàn bộ dữ liệu sống trong IndexedDB, không phụ thuộc server.
//  · Event log APPEND-ONLY — không sửa/xoá event đã ghi (chuỗi bằng chứng truy xuất).
//  · PHI (Pre-Harvest Interval): phun thuốc có phiDays → khoá thu hoạch tới hết thời gian cách ly.
//  · Mã lô theo format EST-{farm}-{YYMMDD}-{seq} — tương thích nâng cấp GS1 (GTIN+Lot) sau này.
//  · Sync server: queue về /api/lots* khi traceSyncEnabled (backend WLC bổ sung endpoint sau,
//    không chặn việc dùng ngay hôm nay).
import { get, set, keys } from 'idb-keyval';
import { syncQueue } from '../stores/sync.js';
import { authStore } from '../stores/auth.js';

const LOT_PREFIX = 'lot:';
const EVT_PREFIX = 'traceevt:';
const MAT_KEY = 'materials:catalog';
const SEQ_KEY = 'lot:seq';

export const ACTIVITY_LABELS = {
  planting: '🌱 Xuống giống',
  irrigation: '💧 Tưới nước',
  fertilizer: '🧪 Bón phân',
  pest: '🐛 Xử lý sâu/bệnh (BVTV)',
  weeding: '🌿 Làm cỏ/chăm sóc',
  inspection: '🔍 Kiểm tra/đánh giá',
  harvest: '🌾 Thu hoạch',
  other: '📝 Khác'
};

// ===== Vật tư (catalog mặc định — chỉnh trong app) =====
const DEFAULT_MATERIALS = [
  { id: 'm_npk', name: 'NPK 16-16-8', type: 'fertilizer', phiDays: 0, note: 'Phân vô cơ tổng hợp' },
  { id: 'm_organic', name: 'Phân hữu cơ vi sinh', type: 'fertilizer', phiDays: 0, note: '' },
  { id: 'm_urea', name: 'Đạm Urê', type: 'fertilizer', phiDays: 0, note: '' },
  { id: 'm_abamectin', name: 'Abamectin 3.6EC', type: 'pesticide', phiDays: 7, note: 'Trừ sâu sinh học — PHI 7 ngày' },
  { id: 'm_emamectin', name: 'Emamectin benzoate 5WG', type: 'pesticide', phiDays: 7, note: 'PHI 7 ngày' },
  { id: 'm_mancozeb', name: 'Mancozeb 80WP', type: 'pesticide', phiDays: 14, note: 'Trừ nấm — PHI 14 ngày' },
  { id: 'm_neem', name: 'Dầu Neem', type: 'pesticide', phiDays: 1, note: 'Hữu cơ — PHI 1 ngày' }
];

export const materialsStore = {
  async list() {
    let cat = await get(MAT_KEY);
    if (!cat || !Array.isArray(cat) || cat.length === 0) {
      cat = DEFAULT_MATERIALS;
      await set(MAT_KEY, cat);
    }
    return cat;
  },
  async add(mat) {
    const cat = await this.list();
    mat.id = 'm_' + Date.now().toString(36);
    mat.phiDays = Math.max(0, parseInt(mat.phiDays, 10) || 0);
    // V5 — tồn kho (qty hiện có, đơn vị, ngưỡng cảnh báo sắp hết)
    mat.stock = { qty: parseFloat(mat.stockQty) || 0, unit: mat.stockUnit || '', lowAt: parseFloat(mat.lowAt) || 0 };
    delete mat.stockQty; delete mat.stockUnit; delete mat.lowAt;
    cat.push(mat);
    await set(MAT_KEY, cat);
    return mat;
  },
  // V5 — nhập/xuất kho (delta < 0 = xuất dùng). Không âm. Trả mat sau cập nhật.
  async adjustStock(id, delta) {
    const cat = await this.list();
    const i = cat.findIndex(m => m.id === id);
    if (i < 0) return null;
    if (!cat[i].stock) cat[i].stock = { qty: 0, unit: '', lowAt: 0 };
    cat[i].stock.qty = Math.max(0, (parseFloat(cat[i].stock.qty) || 0) + Number(delta || 0));
    await set(MAT_KEY, cat);
    return cat[i];
  },
  async update(id, patch) {
    const cat = await this.list();
    const i = cat.findIndex(m => m.id === id);
    if (i < 0) throw new Error('Không tìm thấy vật tư');
    if (patch.phiDays != null) patch.phiDays = Math.max(0, parseInt(patch.phiDays, 10) || 0);
    cat[i] = { ...cat[i], ...patch };
    await set(MAT_KEY, cat);
    return cat[i];
  },
  async remove(id) {
    const cat = await this.list();
    await set(MAT_KEY, cat.filter(m => m.id !== id));
  },
  async byId(id) {
    return (await this.list()).find(m => m.id === id) || null;
  }
};

// ===== Lô / Mùa vụ =====
function pad2(n) { return String(n).padStart(2, '0'); }

async function nextLotCode(farmId) {
  const d = new Date();
  const ymd = String(d.getFullYear()).slice(2) + pad2(d.getMonth() + 1) + pad2(d.getDate());
  const seqMap = (await get(SEQ_KEY)) || {};
  const key = `${farmId}_${ymd}`;
  seqMap[key] = (seqMap[key] || 0) + 1;
  await set(SEQ_KEY, seqMap);
  const farm = String(farmId || 'F1').replace(/[^A-Za-z0-9]/g, '').toUpperCase() || 'F1';
  return `EST-${farm}-${ymd}-${pad2(seqMap[key])}`;
}

export const lotStore = {
  async list() {
    const all = await keys();
    const ids = all.filter(k => typeof k === 'string' && k.startsWith(LOT_PREFIX) && k !== SEQ_KEY && !k.startsWith('lot:seq'));
    const lots = [];
    for (const id of ids) {
      const v = await get(id);
      if (v && v.code) lots.push(v);
    }
    return lots.sort((a, b) => b.createdAt - a.createdAt);
  },

  async byId(lotId) { return (await get(LOT_PREFIX + lotId)) || null; },

  async create({ crop, variety, zoneId, area, plantedAt, note, trace }) {
    if (!crop) throw new Error('Thiếu tên cây trồng');
    const farmId = authStore.activeFarmId || 'F1';
    const code = await nextLotCode(farmId);
    const t = trace || {};
    const lot = {
      id: code, // code là duy nhất → dùng làm id
      code,
      farmId,
      crop, variety: variety || '', zoneId: zoneId || '', area: area || '',
      plantedAt: plantedAt || new Date().toISOString().slice(0, 10),
      note: note || '',
      // V5 — Hồ sơ chuẩn truy xuất (GS1 / VietGAP / EU / Nhật). Tuỳ chọn, append vào lô.
      trace: {
        puc: t.puc || '',            // Mã số vùng trồng (VietGAP/Cục BVTV) — KEY xuất khẩu
        gtin: t.gtin || '',          // GS1 GTIN (mã sản phẩm toàn cầu)
        gln: t.gln || '',            // GS1 GLN (mã địa điểm cơ sở)
        producer: t.producer || '',  // Tên cơ sở sản xuất
        address: t.address || '',    // Địa chỉ vùng trồng
        standards: Array.isArray(t.standards) ? t.standards : [], // ['VietGAP','GlobalGAP','EU-Organic','JGAP']
        certNo: t.certNo || '',      // Số giấy chứng nhận GAP
        certBody: t.certBody || '',  // Tổ chức chứng nhận
        certExpiry: t.certExpiry || '', // Ngày hết hạn chứng nhận
        market: t.market || '',      // Thị trường đích: noi-dia|EU|JP|US|CN
        seedSource: t.seedSource || '', // Nguồn giống (truy xuất ngược 1 bước — EU 178/2002)
      },
      status: 'growing',          // growing | harvested | closed
      phiUntil: null,             // ts — khoá thu hoạch (an toàn thực phẩm)
      phiSource: null,            // tên thuốc gây khoá
      harvest: null,              // { qty, unit, date, by }
      createdBy: authStore.farmerId || 'local-farmer',
      createdAt: Date.now()
    };
    await set(LOT_PREFIX + lot.id, lot);
    await this._appendEvent(lot.id, { type: 'planting', note: `Tạo lô ${code} — ${crop}${variety ? ' (' + variety + ')' : ''}` });
    this._syncLot(lot, 'create');
    return lot;
  },

  async _save(lot) { await set(LOT_PREFIX + lot.id, lot); },

  // Append-only event. KHÔNG có API sửa/xoá event — chuỗi bằng chứng.
  async _appendEvent(lotId, evt) {
    const id = `${EVT_PREFIX}${lotId}:${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const full = {
      lotId,
      type: evt.type || 'other',
      materialId: evt.materialId || null,
      materialName: evt.materialName || null,
      dose: evt.dose || null,
      doseUnit: evt.doseUnit || null,
      note: evt.note || '',
      gps: evt.gps || null,
      photoPath: evt.photoPath || null,
      actor: authStore.farmerId || 'local-farmer',
      ts: evt.ts || Date.now()
    };
    await set(id, full);
    return full;
  },

  async events(lotId) {
    const all = await keys();
    const prefix = `${EVT_PREFIX}${lotId}:`;
    const ids = all.filter(k => typeof k === 'string' && k.startsWith(prefix));
    const out = [];
    for (const id of ids) {
      const v = await get(id);
      if (v) out.push(v);
    }
    return out.sort((a, b) => a.ts - b.ts);
  },

  // Ghi hoạt động vào lô + cập nhật PHI nếu dùng thuốc BVTV
  async recordActivity(lotId, evt) {
    const lot = await this.byId(lotId);
    if (!lot) throw new Error('Không tìm thấy lô');
    if (lot.status === 'closed') throw new Error('Lô đã đóng — không ghi thêm được');

    let phiApplied = null;
    if (evt.materialId) {
      const mat = await materialsStore.byId(evt.materialId);
      if (mat) {
        evt.materialName = mat.name;
        if (mat.phiDays > 0) {
          const until = (evt.ts || Date.now()) + mat.phiDays * 86400000;
          if (!lot.phiUntil || until > lot.phiUntil) {
            lot.phiUntil = until;
            lot.phiSource = mat.name;
            phiApplied = { phiDays: mat.phiDays, until };
          }
        }
      }
    }
    const full = await this._appendEvent(lotId, evt);
    await this._save(lot);
    // Đồng bộ về journal hiện có của WLC (endpoint đã tồn tại) — lotId là field mở rộng
    syncQueue.enqueue({
      path: '/api/journal/manual',
      method: 'POST',
      body: JSON.stringify({
        activity: full.type, zoneId: lot.zoneId, note: full.note,
        lotId: lot.id, lotCode: lot.code,
        material: full.materialName, dose: full.dose, doseUnit: full.doseUnit,
        gps: full.gps, photoPath: full.photoPath, ts: full.ts
      })
    });
    return { event: full, phiApplied, lot };
  },

  // Kiểm tra khoá PHI — trả {locked, until, source, daysLeft}
  phiStatus(lot) {
    if (!lot.phiUntil || Date.now() >= lot.phiUntil) return { locked: false };
    return {
      locked: true,
      until: lot.phiUntil,
      source: lot.phiSource,
      daysLeft: Math.ceil((lot.phiUntil - Date.now()) / 86400000)
    };
  },

  // Thu hoạch — chặn nếu còn PHI (manager có thể override, được ghi vào event log)
  async harvest(lotId, { qty, unit, date, overridePhi }) {
    const lot = await this.byId(lotId);
    if (!lot) throw new Error('Không tìm thấy lô');
    if (lot.status !== 'growing') throw new Error('Lô không ở trạng thái đang canh tác');
    const phi = this.phiStatus(lot);
    if (phi.locked && !overridePhi) {
      throw new Error(`PHI_LOCKED:Còn ${phi.daysLeft} ngày cách ly (${phi.source}). Thu hoạch lúc này vi phạm an toàn thực phẩm.`);
    }
    lot.status = 'harvested';
    lot.harvest = {
      qty: qty || '', unit: unit || 'kg',
      date: date || new Date().toISOString().slice(0, 10),
      by: authStore.farmerId || 'local-farmer',
      phiOverridden: !!(phi.locked && overridePhi)
    };
    await this._appendEvent(lotId, {
      type: 'harvest',
      note: `Thu hoạch ${qty || '?'} ${unit || 'kg'}` + (phi.locked && overridePhi ? ` ⚠ OVERRIDE PHI bởi ${authStore.role} (còn ${phi.daysLeft} ngày cách ly — ${phi.source})` : '')
    });
    await this._save(lot);
    this._syncLot(lot, 'harvest');
    return lot;
  },

  async close(lotId) {
    const lot = await this.byId(lotId);
    if (!lot) throw new Error('Không tìm thấy lô');
    lot.status = 'closed';
    await this._appendEvent(lotId, { type: 'other', note: 'Đóng lô' });
    await this._save(lot);
    return lot;
  },

  // URL truy xuất công khai — V3.2: kèm payload nén trong hash (#d=) để landing page
  // hiển thị được NGAY cả khi lô chưa sync lên cloud. Base URL đổi được qua authStore.
  // ROADMAP: GS1 Digital Link /01/{GTIN}/10/{lot}
  traceBase() {
    // Default: Netlify (domain .vn/.com đang chờ KYC — khi mở khoá chỉ đổi dòng này hoặc set authStore.traceBaseUrl)
    return (authStore.traceBaseUrl || 'https://ecosyntech-farmos.netlify.app/t/').replace(/\/?$/, '/');
  },

  traceUrl(lot, events) {
    const base = `${this.traceBase()}${encodeURIComponent(lot.code)}`;
    if (!events || !events.length) return base;
    try {
      const payload = this.tracePayload(lot, events);
      const json = JSON.stringify(payload);
      // base64url, không padding — an toàn trong URL/QR
      const b64 = btoa(unescape(encodeURIComponent(json)))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      // QR giới hạn dung lượng — payload quá 1800 ký tự thì bỏ hash, chỉ giữ URL
      if (b64.length > 1800) return base;
      return `${base}#d=${b64}`;
    } catch (_) { return base; }
  },

  // Payload QR offline-verifiable (nhúng trong QR + phiếu PDF) — events rút gọn, tối đa 30
  tracePayload(lot, events) {
    return {
      v: 1, code: lot.code, farm: lot.farmId, crop: lot.crop, variety: lot.variety,
      zone: lot.zoneId, planted: lot.plantedAt, harvest: lot.harvest,
      events: (events || []).slice(-30).map(e => ({
        t: e.type, ts: e.ts,
        m: e.materialName || undefined, d: e.dose ? `${e.dose} ${e.doseUnit || ''}`.trim() : undefined,
        n: e.note ? String(e.note).slice(0, 80) : undefined
      }))
    };
  },

  _syncLot(lot, action) {
    // Backend WLC chưa có /api/lots — chỉ queue khi bật cờ (Settings tương lai / backend V6.1)
    if (!authStore.traceSyncEnabled) return;
    syncQueue.enqueue({ path: '/api/lots', method: 'POST', body: JSON.stringify({ action, lot }) });
  }
};

if (typeof window !== 'undefined') { window.lotStore = lotStore; window.materialsStore = materialsStore; }
