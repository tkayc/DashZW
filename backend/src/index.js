import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Load backend/.env even when npm is run from monorepo root
dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config(); // also allow root .env as fallback
import cors from 'cors';
import { authRoutes } from './services/authentication/index.js';
import entityRoutes from './routes/entities.js';
import domainRoutes from './routes/domain.js';
import chatRoutes from './routes/chat.js';
import profileRoutes from './routes/profile.js';
import uploadRoutes from './routes/uploads.js';
import locationRoutes from './routes/location.js';
import { UPLOADS_ROOT } from './services/storage/storage.js';
import { seedDatabase } from './services/merchant/seedData.js';
import { runOrderTimeoutCheck } from './services/orders/orderEngine.js';
import { ensureDemoUsers } from './services/authentication/users.js';
import { subscribeToDbChanges } from './db/store.js';
import { checkPostgres, isPostgresEnabled, ensureSchemaPatches } from './db/pg.js';
import { assertJwtConfigured } from './services/authentication/middleware.js';

assertJwtConfigured();

// Last-resort safety net. Route handlers and background jobs should already
// catch their own errors (see routes/entities.js, orderEngine job below) —
// this only guards against anything missed, so one bad request or a DB blip
// can't take down the API for every app. Logged loudly so it still gets fixed
// at the source; not a substitute for proper error handling upstream.
process.on('unhandledRejection', (reason) => {
  console.error('[DashZW] UNHANDLED REJECTION (process kept alive):', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[DashZW] UNCAUGHT EXCEPTION (process kept alive):', err);
});

if (!isPostgresEnabled()) {
  console.warn(
    '[DashZW] WARNING: PostgreSQL is OFF — JSON-file auth stores passwords in PLAINTEXT. ' +
      'Use only for local demo/dev. Never store real user data in this mode.'
  );
}

const PORT = process.env.PORT || 3001;
const API_VERSION = process.env.API_VERSION || 'v1';
const app = express();

const ORIGINS = (process.env.CORS_ORIGINS ||
  'http://localhost:5173,http://localhost:5174,http://localhost:5175,http://localhost:5176,' +
  'http://127.0.0.1:5173,http://127.0.0.1:5174,http://127.0.0.1:5175,http://127.0.0.1:5176'
).split(',').map((s) => s.trim()).filter(Boolean);

const isDev = process.env.NODE_ENV !== 'production';

app.use(cors({
  origin(origin, callback) {
    if (!origin || ORIGINS.includes(origin)) {
      return callback(null, true);
    }
    if (isDev && /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+)(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }
    callback(null, false);
  },
  credentials: true,
}));
app.use(express.json({ limit: '8mb' }));
app.use('/uploads', express.static(UPLOADS_ROOT));

app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  next();
});

app.use((req, _res, next) => {
  if (process.env.LOG_REQUESTS === '1') {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  }
  next();
});

async function healthHandler(_req, res) {
  const postgres = await checkPostgres();
  res.json({
    ok: true,
    service: 'dashzw-api',
    version: API_VERSION,
    postgres,
    uptime_s: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
}

app.get('/api/health', healthHandler);
app.get(`/api/${API_VERSION}/health`, healthHandler);

function mountApi(routerBase) {
  app.use(`${routerBase}/auth`, authRoutes);
  app.use(`${routerBase}/entities`, entityRoutes);
  app.use(`${routerBase}/domain`, domainRoutes);
  app.use(`${routerBase}/chat`, chatRoutes);
  app.use(`${routerBase}/profile`, profileRoutes);
  app.use(`${routerBase}/uploads`, uploadRoutes);
  app.use(`${routerBase}/location`, locationRoutes);
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

function sseHandler(req, res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();
  res.write(': connected\n\n');
  sseClients.add(res);
  req.on('close', () => sseClients.delete(res));
}

app.get('/api/events', sseHandler);
app.get(`/api/${API_VERSION}/events`, sseHandler);

Promise.resolve()
  .then(() => ensureSchemaPatches())
  .then(() => ensureDemoUsers())
  .catch((e) => console.error('[DashZW] startup schema/demo-user init failed:', e?.message || e));

Promise.resolve()
  .then(() => seedDatabase())
  .catch((e) => console.error('[DashZW] seedDatabase failed:', e?.message || e));

// Background job: must never crash the process on a transient DB error.
async function safeRunOrderTimeoutCheck() {
  try {
    await runOrderTimeoutCheck();
  } catch (e) {
    console.error('[DashZW] runOrderTimeoutCheck failed (will retry next cycle):', e?.message || e);
  }
}
setInterval(safeRunOrderTimeoutCheck, 60_000);
safeRunOrderTimeoutCheck();

// Catches errors passed via next(err), and synchronous throws in route
// handlers. Must be registered after all routes.
app.use((err, _req, res, _next) => {
  console.error('[DashZW] Unhandled route error:', err?.message || err);
  if (res.headersSent) return;
  res.status(500).json({ message: 'Internal server error' });
});

app.listen(PORT, async () => {
  console.log(`[DashZW API] http://localhost:${PORT}`);
  const pg = await checkPostgres();
  if (pg.enabled && pg.ok) {
    console.log(`[DashZW API] PostgreSQL: connected (${pg.users} users)`);
  } else if (pg.enabled) {
    console.error(`[DashZW API] PostgreSQL: FAILED — ${pg.message}`);
    console.error('[DashZW API] Fix DATABASE_URL in backend/.env or root .env');
  } else {
    console.log('[DashZW API] PostgreSQL: off — using JSON files (backend/data)');
  }
});