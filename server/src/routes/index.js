import { Router } from 'express';

export function createRouter() {
  const router = Router();

  // Auth
  router.post('/auth/login', (req, res) => {
    const { pin, deviceId } = req.body;
    res.json({ token: 'mock-jwt-token', farmerId: 'FARM001', role: 'owner' });
  });

  router.post('/auth/register', (req, res) => {
    res.json({ success: true, farmerId: 'FARM_' + Date.now() });
  });

  // Sync
  router.get('/sync/pull', (req, res) => {
    res.json({ lots: [], orders: [], finance: [], timestamp: new Date().toISOString() });
  });

  router.post('/sync/push', (req, res) => {
    const { lots, orders, finance } = req.body;
    res.json({ success: true, received: { lots: lots?.length || 0, orders: orders?.length || 0, finance: finance?.length || 0 } });
  });

  // Lots
  router.get('/lots', (_, res) => res.json([]));
  router.post('/lots', (req, res) => {
    res.json({ success: true, id: 'LOT_' + Date.now(), ...req.body });
  });
  router.get('/lots/:id', (req, res) => {
    res.json({ id: req.params.id, name: 'Sample Lot', crop: 'Lúa' });
  });

  // Orders
  router.get('/orders', (_, res) => res.json([]));
  router.post('/orders', (req, res) => {
    res.json({ success: true, id: 'ORD_' + Date.now(), ...req.body });
  });
  router.get('/orders/:id', (req, res) => {
    res.json({ id: req.params.id, code: 'ORD-001', totalAmount: 100000 });
  });

  // Finance
  router.get('/finance', (_, res) => {
    res.json({ revenue: 0, cost: 0, profit: 0, byMonth: [] });
  });

  // Forecast
  router.get('/forecast', (_, res) => {
    res.json({ revenue: { dailyAvg: 0, monthlyAvg: 0, projectedRevenue: 0, trend: 0 }, yield: { totalHarvested: 0, avgPerLot: 0 } });
  });

  // AI Diagnosis
  router.post('/ai/diagnose', (req, res) => {
    const { image } = req.body;
    res.json({ disease: 'Mock Disease', confidence: 0.85, treatment: 'Xử lý với Mancozeb 80WP', organic: 'Dầu Neem' });
  });

  return router;
}
