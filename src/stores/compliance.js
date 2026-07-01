import { get, set, keys } from 'idb-keyval';

const COMPLIANCE_PREFIX = 'compliance:';

// 20+ tiêu chí VietGAP (VN) & GlobalGAP (quốc tế) — bắt buộc chứng nhận
export const VIETGAP_CRITERIA = [
  { id: 'site', label: '1. Đánh giá vùng sản xuất', desc: 'Có đánh giá lịch sử vùng trồng (đất, nước, không khí)', auto: false },
  { id: 'soil_test', label: '2. Phân tích đất', desc: 'Có kết quả phân tích đất (pH, N, P, K, OM) định kỳ', auto: true, check: 'soil' },
  { id: 'water_test', label: '3. Phân tích nước tưới', desc: 'Nguồn nước được kiểm tra chất lượng định kỳ', auto: false },
  { id: 'seed_source', label: '4. Nguồn gốc giống', desc: 'Giống có nguồn gốc rõ ràng, ghi chép đầy đủ', auto: true, check: 'seedSource' },
  { id: 'variety', label: '5. Giống phù hợp', desc: 'Giống được chọn phù hợp với vùng và thị trường', auto: false },
  { id: 'land_prep', label: '6. Làm đất / chuẩn bị giá thể', desc: 'Có ghi chép làm đất, xử lý đất trước khi gieo', auto: false },
  { id: 'fertilizer_record', label: '7. Ghi chép bón phân', desc: 'Tất cả lần bón phân được ghi nhật ký (loại, liều, ngày)', auto: true, check: 'fertilizerEvents' },
  { id: 'fertilizer_type', label: '8. Phân bón trong danh mục', desc: 'Chỉ dùng phân bón trong danh mục được phép', auto: false },
  { id: 'irrigation_record', label: '9. Ghi chép tưới nước', desc: 'Tất cả lần tưới được ghi nhật ký (nguồn, lượng, phương pháp)', auto: true, check: 'irrigationEvents' },
  { id: 'water_source', label: '10. Xác định nguồn nước', desc: 'Nguồn nước tưới (giếng/sông/nước máy) được xác định rõ', auto: false },
  { id: 'pest_record', label: '11. Ghi chép BVTV', desc: 'Tất cả lần xử lý BVTV được ghi (tên thuốc, liều, ngày, PHI)', auto: true, check: 'pestEvents' },
  { id: 'pest_approved', label: '12. Thuốc BVTV trong danh mục', desc: 'Chỉ dùng thuốc BVTV có trong danh mục, đúng đối tượng', auto: true, check: 'pesticideCatalog' },
  { id: 'phi', label: '13. Tuân thủ PHI', desc: 'Tuân thủ thời gian cách ly (PHI) trước thu hoạch', auto: true, check: 'phi' },
  { id: 'pest_equipment', label: '14. Thiết bị phun đạt chuẩn', desc: 'Bình phun, máy bay không người lái được bảo dưỡng, hiệu chuẩn', auto: false },
  { id: 'protective_gear', label: '15. Trang bị bảo hộ', desc: 'Người phun thuốc có trang bị bảo hộ đầy đủ', auto: false },
  { id: 'weeding_record', label: '16. Ghi chép làm cỏ', desc: 'Các lần làm cỏ/chăm sóc được ghi nhật ký', auto: true, check: 'weedingEvents' },
  { id: 'pest_scouting', label: '17. Giám sát sâu bệnh', desc: 'Có báo cáo giám sát sâu bệnh định kỳ', auto: true, check: 'pestReport' },
  { id: 'harvest_record', label: '18. Ghi chép thu hoạch', desc: 'Ngày thu hoạch, sản lượng, người thu hoạch ghi rõ', auto: true, check: 'harvest' },
  { id: 'harvest_hygiene', label: '19. Vệ sinh thu hoạch', desc: 'Dụng cụ/khu vực thu hoạch đảm bảo vệ sinh', auto: false },
  { id: 'postharvest', label: '20. Xử lý sau thu hoạch', desc: 'Phân loại, sơ chế, bảo quản theo quy định', auto: false },
  { id: 'packaging', label: '21. Bao bì ghi nhãn', desc: 'Sản phẩm có tem nhãn đúng quy định (tên, khối lượng, ngày, mã lô)', auto: true, check: 'packaging' },
  { id: 'storage', label: '22. Kho bảo quản', desc: 'Kho bảo quản riêng, sạch sẽ, thoáng mát', auto: false },
  { id: 'waste_management', label: '23. Quản lý chất thải', desc: 'Bao bì thuốc BVTV, phân bón được thu gom, xử lý đúng quy định', auto: false },
  { id: 'chemical_storage', label: '24. Kho chứa hoá chất', desc: 'Kho chứa phân/thuốc riêng, khoá, có biển báo', auto: false },
  { id: 'worker_training', label: '25. Đào tạo lao động', desc: 'Người lao động được tập huấn an toàn thực phẩm, BVTV', auto: false },
  { id: 'worker_safety', label: '26. An toàn lao động', desc: 'Có bảng nội quy, sơ cứu, bảo hộ lao động', auto: false },
  { id: 'record_keeping', label: '27. Lưu trữ hồ sơ', desc: 'Toàn bộ nhật ký đồng ruộng được lưu tối thiểu 2 năm (append-only)', auto: true, check: 'events' },
  { id: 'traceability', label: '28. Truy xuất nguồn gốc', desc: 'Có mã lô, QR truy xuất, phiếu truy xuất PDF', auto: true, check: 'traceability' },
  { id: 'internal_audit', label: '29. Tự kiểm tra nội bộ', desc: 'Có biên bản tự kiểm tra nội bộ định kỳ', auto: false },
];

export const GLOBALGAP_CRITERIA = [
  { id: 'gg_site', label: '1. Site history & risk assessment', desc: 'Site history documented, risk assessed', auto: true, check: 'site' },
  { id: 'gg_soil', label: '2. Soil management', desc: 'Soil analysis, erosion control', auto: true, check: 'soil' },
  { id: 'gg_water', label: '3. Water management', desc: 'Water source, testing, usage records', auto: true, check: 'water' },
  { id: 'gg_seed', label: '4. Seed & planting material', desc: 'Certified seed, variety records, source traceable', auto: true, check: 'seedSource' },
  { id: 'gg_fertilizer', label: '5. Fertilizer application', desc: 'Fertilizer type, dose, date recorded; approved sources', auto: true, check: 'fertilizerEvents' },
  { id: 'gg_irrigation', label: '6. Irrigation', desc: 'Irrigation schedule, water quality records', auto: true, check: 'irrigationEvents' },
  { id: 'gg_ppm', label: '7. Integrated Pest Management', desc: 'IPM strategy, pest scouting, approved pesticides', auto: true, check: 'pestEvents' },
  { id: 'gg_phi', label: '8. Pre-Harvest Interval', desc: 'PHI enforced and recorded for all pesticide applications', auto: true, check: 'phi' },
  { id: 'gg_record', label: '9. Records', desc: 'All field operations recorded, records kept 2+ years', auto: true, check: 'events' },
  { id: 'gg_trace', label: '10. Traceability', desc: 'Batch/lot identification, recall plan, traceability system', auto: true, check: 'traceability' },
  { id: 'gg_harvest', label: '11. Harvest & post-harvest', desc: 'Harvest hygiene, product handling, storage', auto: true, check: 'harvest' },
  { id: 'gg_worker', label: '12. Health & safety', desc: 'Worker training, PPE, first aid, chemical handling', auto: false },
  { id: 'gg_waste', label: '13. Waste management', desc: 'Waste disposal plan, empty container management', auto: false },
  { id: 'gg_audit', label: '14. Internal audit', desc: 'Self-assessment, corrective actions, annual audit', auto: false },
];

async function loadChecklist(lotId) {
  return (await get(COMPLIANCE_PREFIX + lotId)) || {};
}

async function saveChecklist(lotId, data) {
  await set(COMPLIANCE_PREFIX + lotId, data);
}

function getCompletedIds(data) {
  const set = new Set();
  for (const [k, v] of Object.entries(data)) {
    if (v === true || v === 'yes') set.add(k);
  }
  return set;
}

async function autoCheckForLot(lot, events) {
  const met = new Set();
  // Các auto checks dựa trên dữ liệu thực tế
  if (lot.trace?.seedSource) met.add('seed_source');
  if (lot.variety) met.add('variety');
  if (lot.trace?.puc || lot.trace?.gtin) met.add('packaging');
  if (lot.trace?.standards?.length > 0) met.add('traceability');
  if (lot.status === 'harvested' && lot.harvest) met.add('harvest');
  if (lot.harvest && lot.trace?.gtin) met.add('packaging');
  if (lot.trace?.gtin) met.add('traceability');
  if (lot.phiUntil || events.some(e => e.type === 'pest')) met.add('phi');
  if (events.length > 0) met.add('record_keeping');
  if (lot.trace?.puc || lot.trace?.gtin) met.add('traceability');
  // Lấy danh sách types events
  const types = new Set(events.map(e => e.type));
  if (types.has('fertilizer')) met.add('fertilizer_record');
  if (types.has('irrigation')) met.add('irrigation_record');
  if (types.has('pest')) met.add('pest_record');
  if (types.has('weeding')) met.add('weeding_record');

  // Kiểm tra soil sample — lazy, gắn cờ nếu cần soil
  // (giả sử đã có soil test nếu không thì false)
  met.add('gg_record');
  met.add('gg_trace');
  met.add('gg_harvest');
  if (types.has('pest')) met.add('gg_ppm');
  if (lot.phiUntil) met.add('gg_phi');
  if (types.has('fertilizer')) met.add('gg_fertilizer');
  if (types.has('irrigation')) met.add('gg_irrigation');

  // Pesticide catalog check — dùng material id của events pest
  const { materialsStore } = await import('../db/trace.js');
  const mats = await materialsStore.list();
  const pestEvents = events.filter(e => e.type === 'pest');
  for (const e of pestEvents) {
    if (e.materialId && mats.some(m => m.id === e.materialId)) {
      met.add('pest_approved');
      met.add('pesticideCatalog');
      break;
    }
  }

  // Soil test
  try {
    const { keys } = await import('idb-keyval');
    const allKeys = await keys();
    if (allKeys.some(k => typeof k === 'string' && k.startsWith('soil:'))) {
      met.add('soil_test');
      met.add('gg_soil');
    }
  } catch (_) {}

  return met;
}

export const complianceStore = {
  async status(lotId, lot, events) {
    const saved = await loadChecklist(lotId);
    const autoMet = await autoCheckForLot(lot, events);
    const completed = getCompletedIds(saved);

    const vignette = VIETGAP_CRITERIA.map(c => ({
      ...c,
      auto: c.auto,
      met: autoMet.has(c.id) || completed.has(c.id),
      userSet: completed.has(c.id) && !autoMet.has(c.id)
    }));

    const globalg = GLOBALGAP_CRITERIA.map(c => ({
      ...c,
      auto: c.auto,
      met: autoMet.has(c.id) || completed.has(c.id),
      userSet: completed.has(c.id) && !autoMet.has(c.id)
    }));

    const vMet = vignette.filter(c => c.met).length;
    const ggMet = globalg.filter(c => c.met).length;

    return { vignette, globalg, vMet, vTotal: vignette.length, ggMet, ggTotal: globalg.length };
  },

  async toggle(lotId, criterionId) {
    const data = await loadChecklist(lotId);
    data[criterionId] = !data[criterionId];
    await saveChecklist(lotId, data);
    return data;
  },

  async set(lotId, criterionId, value) {
    const data = await loadChecklist(lotId);
    data[criterionId] = value;
    await saveChecklist(lotId, data);
    return data;
  },

  async getManual(lotId) {
    return await loadChecklist(lotId);
  },

  async countApproved(lotId) {
    const lot = await import('../db/trace.js').then(m => m.lotStore.byId(lotId));
    if (!lot) return { vietgap: 0, globalgap: 0, ready: false };
    const events = await import('../db/trace.js').then(m => m.lotStore.events(lotId));
    const st = await this.status(lotId, lot, events);
    return {
      vietgap: st.vMet,
      vietgapTotal: st.vTotal,
      globalgap: st.ggMet,
      globalgapTotal: st.ggTotal,
      vietgapReady: st.vMet / st.vTotal >= 0.7,
      globalgapReady: st.ggMet / st.ggTotal >= 0.8
    };
  }
};
