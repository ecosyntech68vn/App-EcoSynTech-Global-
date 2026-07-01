// Carbon Credits — tính giảm phát thải từ lúa AWD (Alternate Wetting & Drying)
import { lotStore } from '../db/trace.js';
import { get, set } from 'idb-keyval';

const CARBON_KEY = 'carbon:projects';

// Hệ số mặc định (IPCC / CGIAR / Vietnam NH₃)
const EMISSION_FACTORS = {
  // Baseline: lúa ngập nước liên tục
  baseline_CH4_kg_per_ha_per_day: 4.2,
  baseline_N2O_kg_per_ha_per_day: 0.05,
  // AWD: giảm CH4 ~50%, tăng N2O ~30%
  awd_CH4_reduction_pct: 0.50,
  awd_N2O_increase_pct: 0.30,
  // Quy đổi CO2e: CH4 = 28, N2O = 265 (IPCC AR5)
  ch4_gwp: 28,
  n2o_gwp: 265,
  // Giá carbon tham khảo (VND/tCO2e) — thị trường tự nguyện VN
  carbon_price_vnd_per_ton: 150000,
};

export const carbonStore = {
  // Tính phát thải baseline (ngập liên tục) vs AWD
  async calculate(lotId) {
    const lot = await lotStore.byId(lotId);
    if (!lot) throw new Error('Không tìm thấy lô');
    if (!lot.crop || !lot.plantedAt) throw new Error('Lô thiếu thông tin cây trồng/ngày xuống giống');

    const events = await lotStore.events(lotId);
    const irrigationEvents = events.filter(e => e.type === 'irrigation');

    // Tính số ngày canh tác
    const plantDate = new Date(lot.plantedAt).getTime();
    const endDate = lot.harvest ? new Date(lot.harvest.date).getTime() : Date.now();
    const growingDays = Math.max(1, Math.round((endDate - plantDate) / 86400000));

    // Diện tích
    const areaHa = parseFloat(lot.area) || 1;
    const areaInHa = areaHa < 10 ? areaHa : areaHa / 10000;

    // Detect AWD từ nhật ký tưới: AWD = tưới ngập → khô → ngập (có chu kỳ)
    const hasAwd = this.detectAWD(irrigationEvents);

    // Tính phát thải
    const F = EMISSION_FACTORS;

    // Baseline (ngập liên tục)
    const baseline_CH4_kg = F.baseline_CH4_kg_per_ha_per_day * growingDays * areaInHa;
    const baseline_N2O_kg = F.baseline_N2O_kg_per_ha_per_day * growingDays * areaInHa;
    const baseline_CO2e = (baseline_CH4_kg * F.ch4_gwp + baseline_N2O_kg * F.n2o_gwp) / 1000; // tấn

    // AWD scenario
    let awd_CO2e = baseline_CO2e;
    if (hasAwd) {
      const awd_CH4_kg = baseline_CH4_kg * (1 - F.awd_CH4_reduction_pct);
      const awd_N2O_kg = baseline_N2O_kg * (1 + F.awd_N2O_increase_pct);
      awd_CO2e = (awd_CH4_kg * F.ch4_gwp + awd_N2O_kg * F.n2o_gwp) / 1000;
    }

    const reduction = baseline_CO2e - awd_CO2e;
    const revenue = reduction * F.carbon_price_vnd_per_ton;

    return {
      lotCode: lot.code,
      crop: lot.crop,
      areaHa: areaInHa,
      growingDays,
      hasAwd,
      baseline: {
        ch4_kg: Math.round(baseline_CH4_kg),
        n2o_kg: Math.round(baseline_N2O_kg),
        co2e_tons: Math.round(baseline_CO2e * 100) / 100
      },
      awd: {
        ch4_kg: Math.round(awd_CO2e === baseline_CO2e ? baseline_CH4_kg : baseline_CH4_kg * (1 - F.awd_CH4_reduction_pct)),
        n2o_kg: Math.round(awd_CO2e === baseline_CO2e ? baseline_N2O_kg : baseline_N2O_kg * (1 + F.awd_N2O_increase_pct)),
        co2e_tons: Math.round(awd_CO2e * 100) / 100
      },
      reduction_tons: Math.round(reduction * 100) / 100,
      revenue_vnd: Math.round(revenue),
      note: hasAwd ? '✅ Áp dụng AWD — đủ điều kiện tín chỉ carbon' : '⚠ Chưa phát hiện AWD. Cần ghi nhật ký tưới ngập-khô luân phiên.'
    };
  },

  // Detect AWD: kiểm tra xem có chu kỳ ngập-khô trong nhật ký tưới không
  detectAWD(irrigationEvents) {
    if (irrigationEvents.length < 3) return false;
    // Sắp xếp theo thời gian
    const sorted = [...irrigationEvents].sort((a, b) => a.ts - b.ts);
    // Tính khoảng cách giữa các lần tưới
    const intervals = [];
    for (let i = 1; i < sorted.length; i++) {
      intervals.push((sorted[i].ts - sorted[i - 1].ts) / 86400000);
    }
    // AWD = có ít nhất 3 khoảng cách 5-15 ngày (ngập → khô → ngập lại)
    const awdCycles = intervals.filter(d => d >= 5 && d <= 15);
    return awdCycles.length >= 2;
  },

  // Lưu dự án carbon
  async saveProject(lotId) {
    const calc = await this.calculate(lotId);
    const projects = await this.listProjects();
    const existing = projects.find(p => p.lotCode === calc.lotCode);
    if (existing) {
      Object.assign(existing, { ...calc, updatedAt: Date.now() });
    } else {
      projects.push({ ...calc, lotId, createdAt: Date.now(), updatedAt: Date.now() });
    }
    await set(CARBON_KEY, projects);
    return calc;
  },

  async listProjects() {
    return (await get(CARBON_KEY)) || [];
  },

  async totalReduction() {
    const projects = await this.listProjects();
    return {
      totalReduction: projects.reduce((s, p) => s + (p.reduction_tons || 0), 0),
      totalRevenue: projects.reduce((s, p) => s + (p.revenue_vnd || 0), 0),
      projectCount: projects.length,
      awdCount: projects.filter(p => p.hasAwd).length
    };
  }
};
