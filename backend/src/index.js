import express from 'express';
import cors from 'cors';
import { authRoutes } from './services/authentication/index.js';
import entityRoutes from './routes/entities.js';
import domainRoutes from './routes/domain.js';
import chatRoutes from './routes/chat.js';
import profileRoutes from './routes/profile.js';
import { seedDatabase } from './services/merchant/seedData.js';
import { runOrderTimeoutCheck } from './services/orders/orderEngine.js';
import { ensureDemoUsers } from './services/authentication/users.js';
import { subscribeToDbChanges } from './db/store.js';

const PORT = process.env.PORT || 3001;
const API_VERSION = process.env.API_VERSION || 'v1';
const app = express();

const ORIGINS = (process.env.CORS_ORIGINS ||
  'http://localhost:5173,http://localhost:5174,http://localhost:5175,http://localhost:5176'
).split(',').map((s) => s.trim());

app.use(cors({ origin: ORIGINS, credentials: true }));
app.use(express.json({ limit: '2mb' }));

// Security headers placeholder
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  next();
});

// Request logging placeholder — swap for pino/winston in production
app.use((req, _res, next) => {
  if (process.env.LOG_REQUESTS === '1') {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  }
  next();
});

function healthHandler(_req, res) {
  res.json({
    ok: true,
    service: 'dashzw-api',
    version: API_VERSION,
    // TODO(redis): include cache status
    // TODO(monitoring): include uptime / metrics
    uptime_s: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
}

app.get('/api/health', healthHandler);
app.get(`/api/${API_VERSION}/health`, healthHandler);

// API versioning — mount under /api and /api/v1
function mountApi(routerBase) {
  app.use(`${routerBase}/auth`, authRoutes);
  app.use(`${routerBase}/entities`, entityRoutes);
  app.use(`${routerBase}/domain`, domainRoutes);
  app.use(`${routerBase}/chat`, chatRoutes);
  app.use(`${routerBase}/profile`, profileRoutes);
}

mountApi('/api');
mountApi(`/api/${API_VERSION}`);

const sseClients = new Set();
subscribeToDbChanges((collection) => {
  const payload = `data: ${JSON.stringify({ collection })}\n\n`;
  sseClients.forEach((res) => {
    try {
      res.write(payload);
    } catch {}
  });
});

app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();
  res.write(': connected\n\n');
  sseClients.add(res);
  req.on('close', () => sseClients.delete(res));
});

app.get(`/api/${API_VERSION}/events`, (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();
  res.write(': connected\n\n');
  sseClients.add(res);
  req.on('close', () => sseClients.delete(res));
});

ensureDemoUsers();
seedDatabase();
setInterval(runOrderTimeoutCheck, 60_000);
runOrderTimeoutCheck();

app.listen(PORT, () => {
  console.log(`[DashZW API] http://localhost:${PORT}`);
  console.log(`[DashZW API] health: /api/health · /api/${API_VERSION}/health`);
  // TODO(redis): connect cache
  // TODO(monitoring): register metrics exporter
});
