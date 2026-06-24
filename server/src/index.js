/*
  FarmOS Server — Node.js + Express + SQLite/PocketBase
  ======================================================
  Mục đích: Đồng bộ dữ liệu từ app mobile lên server,
  quản lý người dùng, phân quyền, API cho Zalo Mini App.

  Cách chạy:
    1. cd server && npm install
    2. cp .env.example .env  # điền JWT_SECRET, PORT
    3. npm start

  API endpoints (thiết kế):
    POST   /api/auth/login       → JWT login
    POST   /api/auth/register    → Tạo user mới
    GET    /api/sync/pull        → Kéo dữ liệu từ server
    POST   /api/sync/push        → Đẩy dữ liệu lên server
    GET    /api/lots             → Danh sách lô
    POST   /api/lots             → Tạo lô mới
    GET    /api/lots/:id         → Chi tiết lô
    GET    /api/orders           → Danh sách đơn hàng
    POST   /api/orders           → Tạo đơn hàng
    GET    /api/orders/:id       → Chi tiết đơn hàng
    GET    /api/finance          → Báo cáo tài chính
    GET    /api/forecast         → Dự báo doanh thu
    POST   /api/ai/diagnose      → Chẩn đoán AI (ảnh → kết quả)

  Database: SQLite (better-sqlite3) — file farmos.db
  Có thể thay bằng PocketBase bằng cách cấu hình .env
*/

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createRouter } from './routes/index.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use('/api', createRouter());

app.get('/health', (_, res) => res.json({ status: 'ok', version: '1.0.0', timestamp: new Date().toISOString() }));

app.listen(PORT, () => {
  console.log(`🌐 FarmOS Server running on http://localhost:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
});
