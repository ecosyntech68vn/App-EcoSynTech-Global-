import { Router } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Thiếu token xác thực' });
  }
  try {
    const decoded = jwt.verify(auth.slice(7), JWT_SECRET);
    req.farmer = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Token không hợp lệ hoặc hết hạn' });
  }
}

export function createRouter() {
  const router = Router();

  router.post('/auth/login', (req, res) => {
    const { pin } = req.body;
    if (!pin || String(pin).length < 4) {
      return res.status(400).json({ error: 'PIN phải có ít nhất 4 ký tự' });
    }
    const token = jwt.sign(
      { farmerId: 'FARM001', role: 'owner', pin: String(pin) },
      JWT_SECRET,
      { expiresIn: '30d' }
    );
    res.json({ token, farmerId: 'FARM001', role: 'owner' });
  });

  router.post('/auth/register', (req, res) => {
    const { pin } = req.body;
    if (!pin || String(pin).length < 4) {
      return res.status(400).json({ error: 'PIN phải có ít nhất 4 ký tự' });
    }
    res.json({ success: true, farmerId: 'FARM_' + Date.now() });
  });

  router.get('/sync/pull', authMiddleware, (req, res) => {
    res.json({ lots: [], orders: [], finance: [], timestamp: new Date().toISOString() });
  });

  router.post('/sync/push', authMiddleware, (req, res) => {
    const { lots, orders, finance } = req.body;
    if (!lots && !orders && !finance) {
      return res.status(400).json({ error: 'Thiếu dữ liệu đồng bộ' });
    }
    res.json({ success: true, received: { lots: lots?.length || 0, orders: orders?.length || 0, finance: finance?.length || 0 } });
  });

  router.get('/lots', authMiddleware, (_, res) => res.json([]));

  router.post('/lots', authMiddleware, (req, res) => {
    const { crop } = req.body;
    if (!crop) {
      return res.status(400).json({ error: 'Thiếu tên cây trồng' });
    }
    res.json({ success: true, id: 'LOT_' + Date.now() });
  });

  router.get('/lots/:id', authMiddleware, (req, res) => {
    res.json({ id: req.params.id, name: 'Sample Lot', crop: 'Lúa' });
  });

  router.get('/orders', authMiddleware, (_, res) => res.json([]));

  router.post('/orders', authMiddleware, (req, res) => {
    const { customerName, totalAmount } = req.body;
    if (!customerName) {
      return res.status(400).json({ error: 'Thiếu tên khách hàng' });
    }
    if (totalAmount != null && (typeof totalAmount !== 'number' || totalAmount < 0)) {
      return res.status(400).json({ error: 'Số tiền không hợp lệ' });
    }
    res.json({ success: true, id: 'ORD_' + Date.now() });
  });

  router.get('/orders/:id', authMiddleware, (req, res) => {
    res.json({ id: req.params.id, code: 'ORD-001', totalAmount: 100000 });
  });

  router.get('/finance', authMiddleware, (_, res) => {
    res.json({ revenue: 0, cost: 0, profit: 0, byMonth: [] });
  });

  router.get('/forecast', authMiddleware, (_, res) => {
    res.json({ revenue: { dailyAvg: 0, monthlyAvg: 0, projectedRevenue: 0, trend: 0 }, yield: { totalHarvested: 0, avgPerLot: 0 } });
  });

  router.post('/ai/diagnose', authMiddleware, (req, res) => {
    const { image } = req.body;
    if (!image || typeof image !== 'string') {
      return res.status(400).json({ error: 'Thiếu ảnh chẩn đoán' });
    }
    if (image.length > 5_000_000) {
      return res.status(400).json({ error: 'Ảnh quá lớn (tối đa 5MB)' });
    }
    res.json({ disease: 'Mock Disease', confidence: 0.85, treatment: 'Xử lý với Mancozeb 80WP', organic: 'Dầu Neem' });
  });

  return router;
}
