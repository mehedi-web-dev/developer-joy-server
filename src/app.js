import express from 'express';
import cors from 'cors';
import { toNodeHandler } from 'better-auth/node';
import dotenv from 'dotenv';
import { auth } from './lib/auth.js';
import { getDB } from './config/db.js';
import projectRoutes from './routes/project.routes.js';

dotenv.config();

const app = express();

// Trust the immediate first-hop reverse proxy (Vercel Edge / API Gateway)
app.set('trust proxy', 1);

// Disable x-powered-by header for security
app.disable('x-powered-by');

// Hardened request path normalization for Vercel Edge rewrites
app.use((req, _res, next) => {
  const isRewrittenEntrypoint =
    req.url === '/api' ||
    req.url === '/api/index' ||
    req.url === '/api/index.js' ||
    req.url.startsWith('/api/index?') ||
    req.url.startsWith('/api?');

  if (!isRewrittenEntrypoint) {
    return next();
  }

  const rawMatchedPath = req.headers['x-matched-path'];
  const matchedPath = Array.isArray(rawMatchedPath) ? rawMatchedPath[0] : rawMatchedPath;

  if (matchedPath && typeof matchedPath === 'string' && matchedPath.startsWith('/')) {
    const queryIndex = req.url.indexOf('?');
    const queryString = queryIndex !== -1 ? req.url.slice(queryIndex) : '';
    const normalizedUrl = matchedPath.includes('?') ? matchedPath : `${matchedPath}${queryString}`;
    req.url = normalizedUrl;
    req.originalUrl = normalizedUrl;
  }

  next();
});

// Trusted CORS origins (supports comma-separated origins in FRONTEND_URL and CORS_ORIGINS)
const frontendUrls = (process.env.FRONTEND_URL || 'http://localhost:3000')
  .split(',')
  .map((url) => url.trim().replace(/\/+$/, ''))
  .filter(Boolean);

const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((url) => url.trim().replace(/\/+$/, '')).filter(Boolean)
  : [];

const backendUrl = (process.env.BETTER_AUTH_URL || `http://localhost:${process.env.PORT || 5000}`)
  .trim()
  .replace(/\/+$/, '');

const allowedOrigins = Array.from(
  new Set([
    ...frontendUrls,
    ...corsOrigins,
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    backendUrl,
  ])
);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);
      const normalizedOrigin = origin.trim().replace(/\/+$/, '');
      if (allowedOrigins.includes(normalizedOrigin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Cookie',
      'X-Requested-With',
      'Accept',
      'Origin',
    ],
    exposedHeaders: ['Set-Cookie'],
  })
);

// 1. Better Auth request handler for Express 5
// IMPORTANT: Must be mounted BEFORE body parsers like express.json()
// In Express 5 (path-to-regexp v8), wildcards require the '*splat' syntax.
app.all(['/api/auth', '/api/auth/*splat'], toNodeHandler(auth));

// 2. Global body parsers (mounted AFTER Better Auth)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Root welcome / status route
app.get('/', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'DeveloperJoy Portfolio Backend API is running',
    version: '1.0.0',
    authEndpoints: '/api/auth',
    healthCheck: '/api/health',
  });
});

// Health check endpoint
app.get('/api/health', async (_req, res) => {
  let dbStatus = 'disconnected';
  try {
    const db = getDB();
    await db.command({ ping: 1 });
    dbStatus = 'connected';
  } catch (err) {
    dbStatus = `error: ${err.message}`;
  }

  const configuredEnv = {
    MONGODB_URI: Boolean(process.env.MONGODB_URI),
    DB_NAME: Boolean(process.env.DB_NAME),
    BETTER_AUTH_SECRET: Boolean(process.env.BETTER_AUTH_SECRET),
    BETTER_AUTH_URL: Boolean(process.env.BETTER_AUTH_URL || process.env.VERCEL_URL),
    FRONTEND_URL: Boolean(process.env.FRONTEND_URL),
    ADMIN_EMAIL: Boolean(process.env.ADMIN_EMAIL),
    ADMIN_PASSWORD: Boolean(process.env.ADMIN_PASSWORD),
  };

  const isHealthy = dbStatus === 'connected' && configuredEnv.MONGODB_URI && configuredEnv.BETTER_AUTH_SECRET;

  res.status(isHealthy ? 200 : 503).json({
    success: isHealthy,
    status: isHealthy ? 'healthy' : 'degraded',
    database: dbStatus,
    environmentConfigured: configuredEnv,
    timestamp: new Date().toISOString(),
  });
});

// Mount Project Management REST API routes
app.use('/api', projectRoutes);

// 404 Handler for undefined routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// Centralized Error Handling Middleware
app.use((err, _req, res, _next) => {
  console.error('[Error Handler]', err);
  const statusCode = err.status || err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
});

export default app;
