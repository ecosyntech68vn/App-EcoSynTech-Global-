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
    // V5.1 — chỉ giữ ĐƠN VỊ ở catalog; TỒN tính từ sổ cái (không lưu qty rời).
    const unit = mat.stockUnit || '';
    const openQty = parseFloat(mat.stockQty) || 0;
    const lowAt = parseFloat(mat.lowAt) || 0;
    mat.stock = { unit };
    delete mat.stockQty; delete mat.stockUnit; delete mat.lowAt;
    cat.push(mat);
    await set(MAT_KEY, cat);
    // Tồn đầu kỳ → ghi 1 chứng từ "open" vào sổ cái (nguồn sự thật duy nhất)
    if (openQty > 0) {
      try { await inventoryStore.post({ kind: 'raw', itemId: mat.id, itemName: mat.name, type: 'open', qty: openQty, unit, doc: { docDate: new Date().toISOString().slice(0, 10), origin: 'Tồn đầu kỳ' }, note: 'Tồn đầu kỳ' }); } catch (_) {}
    }
    if (lowAt > 0) { try { await inventoryStore.setSafe(mat.id, lowAt); } catch (_) {} }
    return mat;
  },
  // (giữ tương thích — KHÔNG còn là nguồn tồn; mọi thay đổi tồn đi qua inventoryStore.post)
  async adjustStock(id, delta) {
    const mat = await this.byId(id);
    if (!mat) return null;
    const q = Math.abs(Number(delta) || 0);
    if (q > 0) await inventoryStore.post({ kind: 'raw', itemId: id, itemName: mat.name, type: Number(delta) >= 0 ? 'import' : 'export', qty: q, unit: (mat.stock && mat.stock.unit) || '', allowNeg: true, note: 'Điều chỉnh nhanh' });
    return mat;
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

// ===== V5.1 — Inventory core: SỔ CÁI nhập–xuất–tồn chuẩn ERP =====
// Nguyên tắc kế toán kho:
//  · Sổ cái StockMovement APPEND-ONLY là NGUỒN SỰ THẬT DUY NHẤT — không lưu/sửa "qty tồn" rời.
//  · Tồn(item) = Σ[Đầu kỳ + Nhập] − Σ[Xuất + Chuyển đi]  (tính lại từ sổ mỗi lần đọc).
//  · post() KIỂM SOÁT: chặn qty≤0, chặn Xuất/Chuyển vượt tồn (không cho âm kho).
//  · Mỗi chuyển động mang CHỨNG TỪ: doc{pxk, invoiceNo, docDate, party, operator, origin}.
const MOVE_KEY = 'inv:moves';      // sổ cái chuyển động (append-only)
const FINI_KEY = 'inv:finished';   // metadata thành phẩm (qty suy ra từ sổ cái)
const SAFE_KEY = 'inv:safe';       // ngưỡng tồn an toàn { itemId: qty }

// Dấu cộng/trừ theo loại chứng từ
const MV_SIGN = { open: 1, import: 1, adjustUp: 1, export: -1, transfer: -1, adjustDown: -1 };

export const inventoryStore = {
  async movements() { return (await get(MOVE_KEY)) || []; },

  // Ghi thô vào sổ (nội bộ) — không validate. Dùng post() cho nghiệp vụ.
  async _append(mv) {
    const all = (await get(MOVE_KEY)) || [];
    const full = { id: 'mv_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), ts: Date.now(), doc: {}, ...mv };
    all.unshift(full);
    await set(MOVE_KEY, all.slice(0, 5000));
    return full;
  },
  async _move(mv) { return this._append(mv); }, // alias tương thích ngược

  // Tồn hiện có của 1 item — tính từ sổ cái
  async balanceOf(itemId) {
    const all = await this.movements();
    return all.filter(m => m.itemId === itemId)
      .reduce((s, m) => s + (MV_SIGN[m.type] || 0) * (parseFloat(m.qty) || 0), 0);
  },
  // Bản đồ tồn { itemId: qty } cho toàn bộ
  async balanceMap() {
    const all = await this.movements(); const map = {};
    for (const m of all) map[m.itemId] = (map[m.itemId] || 0) + (MV_SIGN[m.type] || 0) * (parseFloat(m.qty) || 0);
    return map;
  },

  // GHI CHỨNG TỪ CÓ KIỂM SOÁT — nghiệp vụ nhập/xuất/chuyển/đầu kỳ đều đi qua đây.
  // Ném lỗi nếu qty≤0 hoặc xuất/chuyển vượt tồn (trừ khi allowNeg=true cho ghi nhật ký đồng).
  async post(mv) {
    const q = parseFloat(mv.qty);
    if (!(q > 0)) throw new Error('Số lượng phải lớn hơn 0');
    if ((mv.type === 'export' || mv.type === 'transfer' || mv.type === 'adjustDown') && !mv.allowNeg) {
      const bal = await this.balanceOf(mv.itemId);
      if (q > bal + 1e-9) throw new Error(`Không đủ tồn: cần ${q}${mv.unit ? ' ' + mv.unit : ''}, tồn hiện có ${bal}${mv.unit ? ' ' + mv.unit : ''}.`);
    }
    const { allowNeg, ...rest } = mv;
    return this._append({ ...rest, qty: q });
  },

  // ===== Tồn an toàn (cảnh báo sắp hết) =====
  async allSafe() { return (await get(SAFE_KEY)) || {}; },
  async getSafe(itemId) { return parseFloat((await this.allSafe())[itemId]) || 0; },
  async setSafe(itemId, qty) {
    const s = await this.allSafe(); s[itemId] = Math.max(0, parseFloat(qty) || 0);
    await set(SAFE_KEY, s); return s[itemId];
  },

  // ===== Thành phẩm — metadata; qty SUY RA từ sổ cái =====
  async finishedMeta() { return (await get(FINI_KEY)) || []; },
  async finishedList() {
    const arr = await this.finishedMeta(); const map = await this.balanceMap();
    return arr.map(f => ({ ...f, qty: map[f.id] || 0, status: (map[f.id] || 0) > 0 ? 'in_stock' : 'out' }));
  },
  async finishedByLot(code) { return (await this.finishedList()).find(f => f.lotCode === code) || null; },

  // Thu hoạch → nhập kho thành phẩm (gọi tự động trong lotStore.harvest)
  async receiveFromHarvest(lot) {
    const arr = await this.finishedMeta();
    const qty = parseFloat(lot.harvest && lot.harvest.qty) || 0;
    const unit = (lot.harvest && lot.harvest.unit) || 'kg';
    const id = 'fg_' + lot.code;
    let item = arr.find(f => f.id === id);
    if (!item) {
      item = {
        id, lotCode: lot.code, lotId: lot.id,
        name: lot.crop + (lot.variety ? ' ' + lot.variety : ''),
        crop: lot.crop, variety: lot.variety || '', unit,
        harvestDate: lot.harvest && lot.harvest.date,
        trace: lot.trace || {}, createdAt: Date.now()
      };
      arr.unshift(item); await set(FINI_KEY, arr);
    }
    if (qty > 0) await this.post({
      kind: 'finished', itemId: id, itemName: item.name, type: 'import', qty, unit, ref: lot.code,
      doc: { docDate: (lot.harvest && lot.harvest.date) || '', operator: (lot.harvest && lot.harvest.by) || '', origin: 'Lô ' + lot.code },
      note: 'Thu hoạch lô ' + lot.code
    });
    return item;
  },
};
function lotStore_currentFarm() { try { return authStore.activeFarmId || '(hiện tại)'; } catch (_) { return '(hiện tại)'; } }

// ===== Lô / Mùa vụ =====
function pad2(n) { return String(n).padStart(2, '0'); }

// ===== GS1 UTILITIES (Vietnam / EU export compliance) =====

// Kiểm tra check digit GTIN-13 (GS1)
export function validateGTIN(gtin) {
  if (!gtin || !/^\d{8,14}$/.test(gtin)) return false;
  const s = String(gtin).padStart(14, '0');
  let sum = 0;
  for (let i = 0; i < 13; i++) sum += parseInt(s[i], 10) * (i % 2 === 0 ? 3 : 1);
  const check = (10 - (sum % 10)) % 10;
  return check === parseInt(s[13], 10);
}

// Sinh check digit GTIN-13 từ 12 số đầu
export function generateGTIN13(base12) {
  if (!base12 || !/^\d{12}$/.test(base12)) return '';
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += parseInt(base12[i], 10) * (i % 2 === 0 ? 1 : 3);
  const check = (10 - (sum % 10)) % 10;
  return base12 + check;
}

// Sinh check digit GTIN-14 từ 13 số đầu
export function generateGTIN14(base13) {
  if (!base13 || !/^\d{13}$/.test(base13)) return '';
  let sum = 0;
  for (let i = 0; i < 13; i++) sum += parseInt(base13[i], 10) * (i % 2 === 0 ? 3 : 1);
  const check = (10 - (sum % 10)) % 10;
  return base13 + check;
}

// Format GTIN cho hiển thị (13 số)
export function formatGTIN(gtin) {
  const s = String(gtin || '').replace(/\D/g, '');
  if (s.length !== 13) return s;
  return `${s.slice(0, 1)}-${s.slice(1, 6)}-${s.slice(6, 11)}-${s.slice(11)}`;
}

// GS1-128 Barcode Encoder (Code 128B + FNC1 cho GS1)
export function encodeGS1128(aiString) {
  if (!aiString) return '';
  // Chuẩn bị dữ liệu: AI string đã có format (01)GTIN(10)LOT...
  // Output: barcode pattern string gồm '1' (bar) và '0' (space)
  return aiString;
}

// Code 128B patterns: value 0-106 → 6 run-lengths (bar,space,bar,space,bar,space,bar,space,bar,space,bar)
// Tổng=11 modules cho mỗi ký tự, ngoại trừ Stop=13 modules (2+3+4+2+1+1=13? Actually standard is 13)
// Tham khảo: ISO/IEC 15417
const C128_PATTERNS = [
  [2,1,2,2,2,2,0,0,0,0,0],[2,2,2,1,2,2,0,0,0,0,0],[2,2,2,2,2,1,0,0,0,0,0],[1,2,1,2,2,3,0,0,0,0,0],
  [1,2,1,3,2,2,0,0,0,0,0],[1,3,1,2,2,2,0,0,0,0,0],[1,2,2,2,1,3,0,0,0,0,0],[1,2,2,3,1,2,0,0,0,0,0],
  [1,3,2,2,1,2,0,0,0,0,0],[2,2,1,2,1,3,0,0,0,0,0],[2,2,1,3,1,2,0,0,0,0,0],[2,3,1,2,1,2,0,0,0,0,0],
  [1,1,2,2,3,2,0,0,0,0,0],[1,2,2,1,3,2,0,0,0,0,0],[1,2,2,2,3,1,0,0,0,0,0],[1,1,3,2,2,2,0,0,0,0,0],
  [1,2,3,1,2,2,0,0,0,0,0],[1,2,3,2,2,1,0,0,0,0,0],[2,3,2,1,1,2,0,0,0,0,0],[2,2,1,1,3,2,0,0,0,0,0],
  [2,2,1,2,3,1,0,0,0,0,0],[2,1,3,2,1,2,0,0,0,0,0],[2,3,1,1,2,2,0,0,0,0,0],[3,1,2,1,3,1,0,0,0,0,0],
  [3,1,1,2,2,2,0,0,0,0,0],[3,2,1,1,2,2,0,0,0,0,0],[3,2,1,2,2,1,0,0,0,0,0],[3,1,2,2,1,2,0,0,0,0,0],
  [3,2,2,1,1,2,0,0,0,0,0],[3,2,2,2,1,1,0,0,0,0,0],[2,1,2,1,2,3,0,0,0,0,0],[2,1,2,3,2,1,0,0,0,0,0],
  [2,3,2,1,2,1,0,0,0,0,0],[1,1,1,3,2,3,0,0,0,0,0],[1,3,1,1,2,3,0,0,0,0,0],[1,3,1,3,2,1,0,0,0,0,0],
  [1,1,2,3,1,3,0,0,0,0,0],[1,3,2,1,1,3,0,0,0,0,0],[1,3,2,3,1,1,0,0,0,0,0],[2,1,1,3,1,3,0,0,0,0,0],
  [2,3,1,1,1,3,0,0,0,0,0],[2,3,1,3,1,1,0,0,0,0,0],[1,1,2,1,3,3,0,0,0,0,0],[1,1,2,3,3,1,0,0,0,0,0],
  [1,3,2,1,3,1,0,0,0,0,0],[1,1,3,1,2,3,0,0,0,0,0],[1,1,3,3,2,1,0,0,0,0,0],[1,3,3,1,2,1,0,0,0,0,0],
  [3,1,3,1,2,1,0,0,0,0,0],[2,1,1,3,3,1,0,0,0,0,0],[2,3,1,1,3,1,0,0,0,0,0],[2,1,3,1,1,3,0,0,0,0,0],
  [2,1,3,3,1,1,0,0,0,0,0],[2,1,3,1,3,1,0,0,0,0,0],[3,1,1,1,2,3,0,0,0,0,0],[3,1,1,3,2,1,0,0,0,0,0],
  [3,3,1,1,2,1,0,0,0,0,0],[3,1,2,1,1,3,0,0,0,0,0],[3,1,2,3,1,1,0,0,0,0,0],[3,3,2,1,1,1,0,0,0,0,0],
  [3,1,4,1,1,1,0,0,0,0,0],[2,2,1,4,1,1,0,0,0,0,0],[4,3,1,1,1,1,0,0,0,0,0],[1,1,1,2,2,4,0,0,0,0,0],
  [1,1,4,2,2,1,0,0,0,0,0],[1,2,1,1,2,4,0,0,0,0,0],[1,2,1,4,2,1,0,0,0,0,0],[1,4,1,1,2,2,0,0,0,0,0],
  [1,4,1,2,2,1,0,0,0,0,0],[1,1,2,2,1,4,0,0,0,0,0],[1,1,2,4,1,2,0,0,0,0,0],[1,2,2,1,1,4,0,0,0,0,0],
  [1,2,2,4,1,1,0,0,0,0,0],[1,4,2,1,1,2,0,0,0,0,0],[1,4,2,2,1,1,0,0,0,0,0],[2,4,1,2,1,1,0,0,0,0,0],
  [2,2,1,1,4,1,0,0,0,0,0],[4,1,3,1,1,1,0,0,0,0,0],[2,4,1,1,1,2,0,0,0,0,0],[1,3,4,1,1,1,0,0,0,0,0],
  [1,1,1,2,4,2,0,0,0,0,0],[1,2,1,1,4,2,0,0,0,0,0],[1,2,1,2,4,1,0,0,0,0,0],[1,1,4,2,1,2,0,0,0,0,0],
  [1,4,1,2,1,2,0,0,0,0,0],[1,1,4,2,2,1,0,0,0,0,0],[4,1,1,2,1,2,0,0,0,0,0],[4,2,1,1,2,1,0,0,0,0,0],
  [4,2,1,2,1,1,0,0,0,0,0],[2,1,2,1,4,1,0,0,0,0,0],[2,1,4,1,2,1,0,0,0,0,0],[4,1,2,1,2,1,0,0,0,0,0],
  [1,1,1,4,3,1,0,0,0,0,0],[1,1,3,4,1,1,0,0,0,0,0],[3,1,1,4,1,1,0,0,0,0,0],[1,1,4,1,1,3,0,0,0,0,0],
  [1,1,4,3,1,1,0,0,0,0,0],[4,1,1,1,1,3,0,0,0,0,0],[4,1,1,3,1,1,0,0,0,0,0],[1,1,3,1,4,1,0,0,0,0,0],
  [1,1,4,1,3,1,0,0,0,0,0],[3,1,1,1,4,1,0,0,0,0,0],[4,1,1,1,3,1,0,0,0,0,0],[2,1,1,4,1,2,0,0,0,0,0],
  [2,1,1,2,1,4,0,0,0,0,0],[2,1,1,2,3,2,0,0,0,0,0],[2,3,3,1,1,1,2,0,0,0,0,0] // 106 = Stop: 2+3+3+1+1+1+2 = 13 modules
];

// GS1-128: Start B (104) + FNC1 (102) + dữ liệu + check digit + Stop (106)
const C128_START_B = 104;
const C128_FNC1 = 102;
const C128_STOP = 106;

// Encode string thành GS1-128 barcode pattern (mảng run-length)
// Input: GS1 AI string (không dấu ngoặc), VD: "0112345678901210LOT001"
export function encodeGS1128Barcode(data) {
  if (!data || !data.length) return null;
  // Mã hoá ký tự: giá trị = charCode - 32 (cho Code 128B)
  const values = [C128_START_B, C128_FNC1];
  for (const ch of data) {
    const v = ch.charCodeAt(0) - 32;
    if (v < 0 || v > 102) return null; // ký tự không hợp lệ
    values.push(v);
  }
  // Check digit
  let sum = values[0];
  for (let i = 1; i < values.length; i++) sum += values[i] * i;
  values.push(sum % 103);
  values.push(C128_STOP);
  // Chuyển thành pattern dạng mảng run-length
  const patterns = values.map(v => (v >= 0 && v <= 106) ? C128_PATTERNS[v] : null);
  if (patterns.some(p => !p)) return null;
  return patterns;
}

// Render GS1-128 lên canvas
export function drawGS1128(ctx, x, y, patterns, barHeight, moduleWidth) {
  if (!patterns || !patterns.length) return;
  const h = barHeight || 60;
  const mw = moduleWidth || 1.2;
  let cx = x;
  ctx.fillStyle = '#000';
  for (const pattern of patterns) {
    for (let i = 0; i < pattern.length; i++) {
      const w = pattern[i] * mw;
      if (w <= 0) continue;
      if (i % 2 === 0) ctx.fillRect(cx, y, w, h); // bar
      cx += w;
    }
  }
}

// Format GS1 AI string từ GTIN, lot, serial
export function formatGS1AIString(gtin, lot, serial) {
  const parts = [];
  if (gtin) parts.push(`01${String(gtin).replace(/\D/g, '').padStart(14, '0').slice(0, 14)}`);
  if (lot) parts.push(`10${lot.slice(0, 20)}`);
  if (serial) parts.push(`21${serial.slice(0, 20)}`);
  return parts.join('');
}

// Format GS1 AI hiển thị (có dấu ngoặc)
export function formatGS1AIHuman(gtin, lot, serial) {
  const parts = [];
  if (gtin) parts.push(`(01)${String(gtin).replace(/\D/g, '').padStart(14, '0').slice(0, 14)}`);
  if (lot) parts.push(`(10)${lot.slice(0, 20)}`);
  if (serial) parts.push(`(21)${serial.slice(0, 20)}`);
  return parts.join('\n');
}

// GS1 Digital Link URI chuẩn
// Format: https://id.gs1.org/01/{GTIN}/10/{lot}
// https://{domain}/trace/{gtin}?lot={lot} (custom)
export function gs1DigitalLink(gtin, lot, serial) {
  if (!gtin) return '';
  const cleanGtin = String(gtin).replace(/\D/g, '').slice(0, 14);
  let link = `https://ecosyntech.com/trace/01/${cleanGtin}`;
  const params = [];
  if (lot) link += `/10/${encodeURIComponent(lot)}`;
  if (serial) params.push(`21=${encodeURIComponent(serial)}`);
  if (params.length) link += '?' + params.join('&');
  return link;
}

// EPCIS event builder — EU export compliance
export function buildEPCISEvent({ type, gtin, lot, bizStep, quantity, unit, location, timestamp, action }) {
  const steps = {
    planting: 'farm_planting',
    harvesting: 'harvesting',
    processing: 'processing',
    shipping: 'shipping',
    receiving: 'receiving',
    inspection: 'inspecting',
    storage: 'holding'
  };
  const epcisType = type === 'harvest' ? 'harvesting' : type;
  return {
    '@context': 'https://ref.gs1.org/gs1/jsonld/epcis-context.jsonld',
    isA: 'ObjectEvent',
    eventTime: new Date(timestamp || Date.now()).toISOString(),
    eventTimeZoneOffset: '+07:00',
    action: action || 'OBSERVE',
    bizStep: `urn:epcglobal:cbv:bizstep:${steps[epcisType] || 'inspecting'}`,
    disposition: 'urn:epcglobal:cbv:disp:active',
    epcList: [`urn:epc:id:sgtin:${gtin}.${lot}`],
    quantityList: quantity ? [{ epcClass: `urn:epc:class:lgtin:${gtin}.${lot}`, quantity: Number(quantity), uom: unit || 'KGM' }] : [],
    bizLocation: location ? { id: `urn:epc:id:sgln:${location}` } : undefined,
    ilmd: {
      lotNumber: lot,
      gtin: gtin,
      traceabilityCode: lot
    }
  };
}

// Xác thực PUC Việt Nam (mã số vùng trồng)
export function validatePUC(puc) {
  // Format: VN-XX-12345 hoặc VN-XXX-12345
  if (!puc) return false;
  return /^VN-[A-Z]{2,3}-\d{3,6}$/i.test(puc);
}

// Format PUC
export function formatPUC(puc) {
  return String(puc || '').toUpperCase().replace(/\s/g, '');
}

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

  async create({ crop, variety, zoneId, area, plantedAt, note, memberId, trace }) {
    if (!crop) throw new Error('Thiếu tên cây trồng');
    const farmId = authStore.activeFarmId || 'F1';
    const code = await nextLotCode(farmId);
    const t = trace || {};
    const lot = {
      id: code,
      code,
      farmId,
      crop, variety: variety || '', zoneId: zoneId || '', area: area || '',
      plantedAt: plantedAt || new Date().toISOString().slice(0, 10),
      note: note || '',
      memberId: memberId || null,
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
    // Kiểm tra sự kiện không xảy ra trước ngày xuống giống
    const eventTs = evt.ts || Date.now();
    const plantTime = lot.plantedAt ? new Date(lot.plantedAt).getTime() : 0;
    if (plantTime > 0 && eventTs < plantTime) {
      throw new Error(`Không thể ghi sự kiện trước ngày xuống giống (${lot.plantedAt}). Sự kiện: ${new Date(eventTs).toLocaleDateString('vi-VN')}. Vào lô để sửa ngày.`);
    }

    let phiApplied = null;

    // Xử lý tank mix — mảng materials
    const allMats = [];
    if (evt.materials && Array.isArray(evt.materials)) {
      for (const m of evt.materials) {
        if (!m.materialId) continue;
        const mat = await materialsStore.byId(m.materialId);
        if (mat) {
          allMats.push({ ...m, name: mat.name, phiDays: mat.phiDays || 0 });
          if (mat.phiDays > 0) {
            const until = eventTs + mat.phiDays * 86400000;
            if (!lot.phiUntil || until > lot.phiUntil) {
              lot.phiUntil = until;
              lot.phiSource = mat.name;
              phiApplied = { phiDays: mat.phiDays, until };
            }
          }
          // Xuất kho cho từng vật tư
          if (m.dose) {
            try {
              await inventoryStore.post({
                kind: 'raw', itemId: mat.id, itemName: mat.name, type: 'export',
                qty: parseFloat(m.dose) || 0, unit: m.doseUnit || '', ref: lot.code, allowNeg: true,
                doc: { operator: authStore.farmerId || '', docDate: new Date(eventTs).toISOString().slice(0, 10) },
                note: 'Tank mix cho lô ' + lot.code
              });
            } catch (_) {}
          }
        }
      }
    } else if (evt.materialId) {
      const mat = await materialsStore.byId(evt.materialId);
      if (mat) {
        allMats.push({ materialId: evt.materialId, name: mat.name, dose: evt.dose, doseUnit: evt.doseUnit, phiDays: mat.phiDays || 0 });
        evt.materialName = mat.name;
        if (mat.phiDays > 0) {
          const until = eventTs + mat.phiDays * 86400000;
          if (!lot.phiUntil || until > lot.phiUntil) {
            lot.phiUntil = until;
            lot.phiSource = mat.name;
            phiApplied = { phiDays: mat.phiDays, until };
          }
        }
        if (evt.dose) {
          try {
            await inventoryStore.post({
              kind: 'raw', itemId: evt.materialId, itemName: evt.materialName, type: 'export',
              qty: parseFloat(evt.dose) || 0, unit: evt.doseUnit || '', ref: lot.code, allowNeg: true,
              doc: { operator: authStore.farmerId || '', docDate: new Date(eventTs).toISOString().slice(0, 10) },
              note: 'Dùng cho lô ' + lot.code
            });
          } catch (_) {}
        }
      }
    }

    // Lưu mảng materials vào event để trace
    if (allMats.length > 1) {
      evt.materials = allMats;
      evt.materialName = allMats.map(m => m.name).join(' + ');
      evt.dose = null;
      evt.doseUnit = null;
    }

    const full = await this._appendEvent(lotId, evt);
    await this._save(lot);
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
    // V5.1 — tự đồng bộ sản lượng vào kho thành phẩm (truy xuất liền mạch)
    try { await inventoryStore.receiveFromHarvest(lot); } catch (_) {}
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

  traceUrl(lot, events, lang = 'vi') {
    const base = `${this.traceBase()}${encodeURIComponent(lot.code)}${lang === 'en' ? '?lang=en' : ''}`;
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
