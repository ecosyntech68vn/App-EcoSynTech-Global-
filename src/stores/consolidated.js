import { financeStore } from './finance.js';
import { equipmentStore } from './equipment.js';
import { contractStore } from './contract.js';
import { soilStore } from './soil.js';
import { recallStore, inspectionStore, processingStore, coldChainStore, genealogyStore } from './trace-advanced.js';
import { get } from 'idb-keyval';

function safe(fn, fallback) { try { return fn(); } catch { return fallback; } }

export const consolidatedStore = {

  // ============================================================
  // TỔNG TÀI SẢN (Total Assets)
  // ============================================================
  async getTotalAssets() {
    const equip = await equipmentStore.getAll();
    const equipmentValue = equip.reduce((s, e) => {
      const val = e.purchasePrice || 0;
      return e.status === 'retired' ? s : s + val;
    }, 0);
    const activeEquip = equip.filter(e => e.status === 'active').length;
    const totalEquip = equip.length;

    const fin = await financeStore.getSummary();
    const cashFlow = fin.totalRevenue - fin.totalExpense;

    const contracts = await contractStore.getAll();
    const contractValue = contracts
      .filter(c => c.status === 'active')
      .reduce((s, c) => s + (c.totalValue || 0) - (c.delivered || 0) * (c.price || 0), 0);

    const recalls = await recallStore.getSummary();
    const recallRisk = recalls.urgent || 0;

    return {
      equipment: { total: totalEquip, active: activeEquip, estimatedValue: equipmentValue },
      contractValue: Math.max(0, contractValue),
      netCashFlow: cashFlow,
      recallRisk,
      timestamp: Date.now()
    };
  },

  // ============================================================
  // P&L TÍCH HỢP (Integrated Profit & Loss)
  // ============================================================
  async getIntegratedPandL(dateFrom, dateTo) {
    const fin = dateFrom ? await financeStore.getByDateRange(dateFrom, dateTo) : await financeStore.getAll();
    const expenses = fin.filter(e => e.type === 'expense');
    const revenues = fin.filter(e => e.type === 'revenue');
    const totalExpense = expenses.reduce((s, e) => s + e.amount, 0);
    const totalRevenue = revenues.reduce((s, e) => s + e.amount, 0);

    const processSummary = await processingStore.getCostSummary(dateFrom, dateTo);

    const breakdown = { expenses: {}, revenues: {} };
    for (const e of expenses) {
      breakdown.expenses[e.category] = (breakdown.expenses[e.category] || 0) + e.amount;
    }
    for (const r of revenues) {
      breakdown.revenues[r.category] = (breakdown.revenues[r.category] || 0) + r.amount;
    }

    const laborCost = breakdown.expenses['labor'] || 0;
    const materialCost = (breakdown.expenses['fertilizer'] || 0) + (breakdown.expenses['pesticide'] || 0) + (breakdown.expenses['seed'] || 0);

    return {
      period: { from: dateFrom || 'all', to: dateTo || 'all' },
      totalRevenue,
      totalExpense,
      grossProfit: totalRevenue - totalExpense,
      margin: totalRevenue ? Math.round((totalRevenue - totalExpense) / totalRevenue * 100) : 0,
      laborCost,
      materialCost,
      processingCost: processSummary.totalCost,
      expenseCount: expenses.length,
      revenueCount: revenues.length,
      breakdown
    };
  },

  // ============================================================
  // TỒN KHO THEO GIÁ TRỊ (Inventory Valuation)
  // ============================================================
  async getInventoryValuation() {
    const matVal = await get('inventory:valuation');
    const lots = await get('lots:all');
    const lotArray = Array.isArray(lots) ? lots : [];
    const harvestedLots = lotArray.filter(l => l.status === 'harvested');
    const activeLots = lotArray.filter(l => l.status === 'active' || !l.status);

    let totalMaterialValue = 0;
    if (matVal) totalMaterialValue = matVal;
    else {
      try {
        const inv = await get('inventory:ledger');
        if (Array.isArray(inv)) {
          totalMaterialValue = inv.filter(m => m.type === 'import').reduce((s, m) => s + (m.totalCost || m.price * m.quantity || 0), 0)
            - inv.filter(m => m.type === 'export' || m.type === 'adjust').reduce((s, m) => s + (m.totalCost || m.price * m.quantity || 0), 0);
        }
      } catch (_) {}
    }

    return {
      totalMaterialValue: Math.max(0, totalMaterialValue),
      harvestedLots: harvestedLots.length,
      activeLots: activeLots.length,
      totalLots: lotArray.length,
      timestamp: Date.now()
    };
  },

  // ============================================================
  // KPI TỔNG HỢP (Master KPI Dashboard)
  // ============================================================
  async getMasterKPI() {
    const [assets, pandl, inventory, equip, contracts, recalls, inspections, soils] = await Promise.all([
      safe(() => this.getTotalAssets(), null),
      safe(() => this.getIntegratedPandL(), null),
      safe(() => this.getInventoryValuation(), null),
      safe(() => equipmentStore.getSummary(), { total: 0, active: 0, maintenance: 0, broken: 0 }),
      safe(() => contractStore.getSummary(), { total: 0, active: 0, completed: 0, totalValue: 0, totalDelivered: 0 }),
      safe(() => recallStore.getSummary(), { total: 0, open: 0, resolved: 0, urgent: 0 }),
      safe(() => inspectionStore.getSummary(), { total: 0, pass: 0, fail: 0, passRate: 100 }),
      safe(() => soilStore.getSummary(), { total: 0, zoneCount: 0, avgPh: 0 })
    ]);

    return {
      assets: assets || { equipment: { total: 0, estimatedValue: 0 }, netCashFlow: 0, contractValue: 0, recallRisk: 0 },
      finance: pandl || { totalRevenue: 0, totalExpense: 0, grossProfit: 0, margin: 0 },
      inventory: inventory || { totalMaterialValue: 0, harvestedLots: 0, activeLots: 0 },
      equipment: equip,
      contracts,
      recalls,
      inspections,
      soils,
      timestamp: Date.now()
    };
  },

  // ============================================================
  // TỔNG HỢP THEO LÔ (Per-Lot Consolidated Report)
  // ============================================================
  async getLotReport(lotId) {
    if (!lotId) return null;
    const [financeEntries, inspections, genealogy, processing, coldChain, recalls] = await Promise.all([
      safe(() => financeStore.getByLot(lotId), []),
      safe(() => inspectionStore.getByLot(lotId), []),
      safe(() => genealogyStore.getTree(lotId), { parents: [], children: [] }),
      safe(() => processingStore.getByLot(lotId), []),
      safe(() => coldChainStore.getByLot(lotId), []),
      safe(() => recallStore.getByLot(lotId), [])
    ]);

    const totalCost = financeEntries.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0);
    const totalRevenue = financeEntries.filter(e => e.type === 'revenue').reduce((s, e) => s + e.amount, 0);
    const inspSummary = await safe(() => inspectionStore.getSummary(lotId), null);

    return {
      lotId,
      finance: { totalCost, totalRevenue, profit: totalRevenue - totalCost },
      inspections: inspections,
      inspSummary,
      genealogy,
      processing: processing.length,
      coldChainLogs: coldChain.length,
      recalls: recalls.length,
      coldChainSummary: coldChain.length ? {
        avgTemp: Math.round(coldChain.reduce((s, c) => s + c.temp, 0) / coldChain.length * 10) / 10,
        minTemp: Math.min(...coldChain.map(c => c.temp)),
        maxTemp: Math.max(...coldChain.map(c => c.temp))
      } : null,
      timestamp: Date.now()
    };
  }
};

if (typeof window !== 'undefined') window.consolidatedStore = consolidatedStore;
