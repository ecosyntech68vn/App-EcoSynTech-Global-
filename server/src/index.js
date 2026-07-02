import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createRouter } from './routes/index.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  maxAge: 86400
}));

app.use(express.json({ limit: '10mb' }));

const limiter = rateLimit({
  windowMs: 60_000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Quá nhiều request — thử lại sau 60 giây' }
});
app.use('/api', limiter);

app.use('/api', createRouter());

app.get('/health', (_, res) => res.json({ status: 'ok', version: '1.0.0', timestamp: new Date().toISOString() }));

app.listen(PORT, () => {
  console.log(`FarmOS Server running on http://localhost:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
});
