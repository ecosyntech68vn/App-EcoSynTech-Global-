import { get, set } from 'idb-keyval';
import { financeStore } from './finance.js';

const BUDGET_KEY = 'budget:plans';

const DEFAULT_BUDGET_LINES = [
  { id: 'seed', label: '💰 Giống / Cây giống', unit: 'VND' },
  { id: 'fertilizer', label: '🧪 Phân bón', unit: 'VND' },
  { id: 'pesticide', label: '🐛 Thuốc BVTV', unit: 'VND' },
  { id: 'labor_plant', label: '👷 Công xuống giống', unit: 'VND' },
  { id: 'labor_care', label: '👷 Công chăm sóc', unit: 'VND' },
  { id: 'labor_harvest', label: '👷 Công thu hoạch', unit: 'VND' },
  { id: 'irrigation', label: '💧 Nước tưới / điện', unit: 'VND' },
  { id: 'equipment', label: '🔧 Máy móc / thiết bị', unit: 'VND' },
  { id: 'packaging', label: '📦 Bao bì / nhãn mác', unit: 'VND' },
  { id: 'logistics', label: '🚚 Vận chuyển', unit: 'VND' },
  { id: 'certification', label: '📋 Chứng nhận / kiểm định', unit: 'VND' },
  { id: 'other', label: '📝 Khác', unit: 'VND' },
];

export const budgetStore = {
  async getPlan(lotId) {
    const all = await get(BUDGET_KEY) || {};
    return all[lotId] || { lines: DEFAULT_BUDGET_LINES.map(l => ({ ...l, estimated: 0, actual: 0 })) };
  },

  async savePlan(lotId, lines) {
    const all = await get(BUDGET_KEY) || {};
    all[lotId] = { lines };
    await set(BUDGET_KEY, all);
  },

  async updateLine(lotId, lineId, field, value) {
    const plan = await this.getPlan(lotId);
    const line = plan.lines.find(l => l.id === lineId);
    if (!line) return plan;
    line[field] = Math.max(0, parseFloat(value) || 0);
    await this.savePlan(lotId, plan.lines);
    return plan;
  },

  async resetPlan(lotId) {
    const plan = DEFAULT_BUDGET_LINES.map(l => ({ ...l, estimated: 0, actual: 0 }));
    await this.savePlan(lotId, plan);
    return { lines: plan };
  },

  async summary(lotId) {
    const plan = await this.getPlan(lotId);
    const totalEst = plan.lines.reduce((s, l) => s + (l.estimated || 0), 0);
    const totalActual = plan.lines.reduce((s, l) => s + (l.actual || 0), 0);

    // Actual từ finance store
    try {
      const transactions = await financeStore.list();
      const lotTx = transactions.filter(t => t.lotCode === lotId);
      const finActual = lotTx.reduce((s, t) => s + (t.amount || 0), 0);
      return {
        lines: plan.lines,
        totalEstimate: totalEst,
        totalActual: finActual || totalActual,
        variance: totalEst > 0 ? ((finActual || totalActual) / totalEst - 1) * 100 : 0,
        count: plan.lines.length
      };
    } catch (_) {
      return {
        lines: plan.lines,
        totalEstimate: totalEst,
        totalActual: totalActual,
        variance: totalEst > 0 ? (totalActual / totalEst - 1) * 100 : 0,
        count: plan.lines.length
      };
    }
  }
};
