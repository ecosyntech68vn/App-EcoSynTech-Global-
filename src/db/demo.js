// demo.js — V4.0 Dữ liệu mẫu 1-chạm cho DEMO BÁN HÀNG (Settings → Demo)
// Tạo 2 lô kể đúng câu chuyện bán hàng:
//   Lô 1: ĐÃ THU HOẠCH, tuân thủ PHI → demo QR + phiếu truy xuất + landing page.
//   Lô 2: ĐANG BỊ KHOÁ PHI (vừa phun Mancozeb) → demo tính năng an toàn thực phẩm.
// Xoá sạch được bằng 1 nút — không lẫn với dữ liệu thật.
import { get, set, del, keys } from 'idb-keyval';
import { lotStore } from './trace.js';

const DEMO_KEY = 'demo:lots';
const DAY = 86400000;

export const demoData = {
  async isSeeded() {
    const ids = await get(DEMO_KEY);
    return Array.isArray(ids) && ids.length > 0;
  },

  async seed() {
    if (await this.isSeeded()) throw new Error('Dữ liệu mẫu đã tồn tại — xoá trước khi tạo lại');
    const now = Date.now();
    const created = [];

    // ===== LÔ 1 — Rau muống, đã thu hoạch, hồ sơ đẹp =====
    const lot1 = await lotStore.create({
      crop: 'Rau muống', variety: 'Cao sản VN', zoneId: 'Z1', area: '500 m²',
      plantedAt: new Date(now - 30 * DAY).toISOString().slice(0, 10),
      note: '(Dữ liệu mẫu demo) Nguồn giống: Cty Giống Miền Nam'
    });
    created.push(lot1.id);
    const ev1 = [
      { type: 'irrigation', note: 'Tưới tự động theo cảm biến độ ẩm đất', ts: now - 28 * DAY },
      { type: 'fertilizer', materialId: 'm_organic', dose: '10', doseUnit: 'kg/sào', ts: now - 24 * DAY },
      { type: 'irrigation', note: 'Tưới định kỳ sáng', ts: now - 20 * DAY },
      { type: 'pest', materialId: 'm_neem', dose: '15', doseUnit: 'ml/10L', note: 'Phòng rầy — hữu cơ, cách ly 1 ngày', ts: now - 12 * DAY },
      { type: 'inspection', note: 'Kiểm tra trước thu hoạch: đạt, không sâu bệnh', ts: now - 3 * DAY }
    ];
    for (const e of ev1) await lotStore.recordActivity(lot1.id, e);
    // PHI neem 1 ngày đã qua từ lâu → thu hoạch hợp lệ
    const l1 = await lotStore.byId(lot1.id);
    l1.phiUntil = null; l1.phiSource = null; // chắc chắn sạch PHI cho demo
    await lotStore._save(l1);
    await lotStore.harvest(lot1.id, { qty: 150, unit: 'kg', date: new Date(now - 1 * DAY).toISOString().slice(0, 10) });

    // ===== LÔ 2 — Cà chua, ĐANG KHOÁ PHI (demo an toàn thực phẩm) =====
    const lot2 = await lotStore.create({
      crop: 'Cà chua', variety: 'Beef F1', zoneId: 'Z2', area: '300 m²',
      plantedAt: new Date(now - 45 * DAY).toISOString().slice(0, 10),
      note: '(Dữ liệu mẫu demo) Nhà màng số 2'
    });
    created.push(lot2.id);
    const ev2 = [
      { type: 'irrigation', note: 'Tưới nhỏ giọt theo lịch', ts: now - 40 * DAY },
      { type: 'fertilizer', materialId: 'm_npk', dose: '5', doseUnit: 'kg/sào', ts: now - 30 * DAY },
      { type: 'weeding', note: 'Tỉa cành, buộc dây leo', ts: now - 15 * DAY },
      // Phun Mancozeb (PHI 14 ngày) cách đây 2 ngày → còn khoá ~12 ngày
      { type: 'pest', materialId: 'm_mancozeb', dose: '25', doseUnit: 'g/10L', note: 'Trị nấm sương mai', ts: now - 2 * DAY }
    ];
    for (const e of ev2) await lotStore.recordActivity(lot2.id, e);

    await set(DEMO_KEY, created);
    return { lots: created.length, harvested: 1, phiLocked: 1 };
  },

  async clear() {
    const ids = (await get(DEMO_KEY)) || [];
    if (!ids.length) return 0;
    const all = await keys();
    let removed = 0;
    for (const lotId of ids) {
      await del('lot:' + lotId);
      removed++;
      // Xoá event của lô demo (chấp nhận xoá vì là dữ liệu mẫu, có cờ riêng)
      const prefix = `traceevt:${lotId}:`;
      for (const k of all) {
        if (typeof k === 'string' && k.startsWith(prefix)) await del(k);
      }
    }
    await del(DEMO_KEY);
    return removed;
  }
};

if (typeof window !== 'undefined') window.demoData = demoData;
