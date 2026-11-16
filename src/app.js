import express from 'express';
import cors from 'cors';
import { toNodeHandler } from 'better-auth/node';
import dotenv from 'dotenv';
import { auth } from './lib/auth.js';
import projectRoutes from './routes/project.routes.js';

dotenv.config();

const app = express();

// Disable x-powered-by header for security
app.disable('x-powered-by');

// Trusted CORS origins
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
const backendUrl = process.env.BETTER_AUTH_URL || `http://localhost:${process.env.PORT || 5000}`;
const allowedOrigins = Array.from(
  new Set(
    [
      frontendUrl,
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      backendUrl,
    ]
      .filter(Boolean)
      .map((origin) => origin.trim().replace(/\/+$/, ''))
  )
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
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
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
app.get('/api/health', (_req, res) => {
  res.status(200).json({
    success: true,
    status: 'healthy',
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
