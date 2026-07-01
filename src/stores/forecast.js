import { orderStore } from './order.js';
import { financeStore } from './finance.js';
import { lotStore } from '../db/trace.js';

export const forecastStore = {
  async revenueForecast(days = 90) {
    const orders = await orderStore.list();
    const paid = orders.filter(o => o.paymentStatus === 'paid');
    const recent = paid.filter(o => {
      const d = new Date(o.paidAt || o.createdAt);
      return Date.now() - d.getTime() < days * 86400000;
    });
    const totalRev = recent.reduce((s, o) => s + (o.totalAmount || 0), 0);
    const dailyAvg = recent.length > 0 ? totalRev / Math.max(1, days) : 0;

    const byMonth = {};
    for (const o of recent) {
      const m = (o.paidAt || o.createdAt).slice(0, 7);
      byMonth[m] = (byMonth[m] || 0) + (o.totalAmount || 0);
    }

    const months = Object.entries(byMonth).sort((a, b) => a[0].localeCompare(b[0]));
    const trend = months.length >= 2 && months[0][1] !== 0
      ? (months[months.length - 1][1] / months[0][1] - 1) * 100
      : 0;

    return {
      dailyAvg,
      monthlyAvg: dailyAvg * 30,
      projectedRevenue: dailyAvg * days,
      trend: Math.round(trend * 10) / 10,
      byMonth: months,
      totalOrders: recent.length,
      confidence: recent.length >= 10 ? 'high' : recent.length >= 5 ? 'medium' : 'low'
    };
  },

  async yieldForecast(days = 180) {
    const lots = await lotStore.list();
    const harvestLots = lots.filter(l => l.harvest && l.harvest.qty > 0);
    const totalYield = harvestLots.reduce((s, l) => s + (l.harvest.qty || 0), 0);
    const avgYield = harvestLots.length > 0 ? totalYield / harvestLots.length : 0;

    const activeLots = lots.filter(l => !l.harvest);
    const DEFAULT_YIELD_PER_LOT = 50; // kg — fallback khi chưa có dữ liệu
    const estYield = activeLots.length * (avgYield > 0 ? avgYield : DEFAULT_YIELD_PER_LOT);

    const byCrop = {};
    for (const l of harvestLots) {
      const crop = l.crop || 'Khác';
      byCrop[crop] = (byCrop[crop] || 0) + (l.harvest.qty || 0);
    }

    return {
      totalHarvested: totalYield,
      avgPerLot: avgYield,
      estimatedFuture: estYield,
      activeLots: activeLots.length,
      byCrop: Object.entries(byCrop).sort((a, b) => b[1] - a[1]),
      activeByCrop: {},
      confidence: harvestLots.length >= 5 ? 'medium' : harvestLots.length >= 2 ? 'low' : 'very_low'
    };
  },

  async getDashboardForecast() {
    const [revenue, yieldF] = await Promise.all([
      this.revenueForecast(90),
      this.yieldForecast(180)
    ]);
    return { revenue, yield: yieldF, generatedAt: new Date().toISOString() };
  }
};
