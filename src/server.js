import app from './app.js';
import { connectDB, closeDB } from './config/db.js';
import { initializeAdmin } from './lib/admin.js';
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT || 5000;
let server = null;

async function startServer() {
  try {
    // 1. Establish database connection before accepting traffic
    console.log('[Server] Connecting to MongoDB...');
    await connectDB();

    // 2. Initialize or verify authorized admin account
    if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
      await initializeAdmin();
    }

    // 3. Start HTTP server
    server = app.listen(PORT, () => {
      console.log(`[Server] DeveloperJoy backend running on port ${PORT} (PID: ${process.pid})`);
      console.log(`[Server] Auth endpoint: http://localhost:${PORT}/api/auth`);
      console.log(`[Server] Health endpoint: http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    console.error('[Server] Startup failed:', error);
    process.exit(1);
  }
}

async function gracefulShutdown(signal) {
  console.log(`\n[Server] Received ${signal}. Initiating graceful shutdown...`);

  const forceExitTimeout = setTimeout(() => {
    console.error('[Server] Graceful shutdown timed out after 10s. Forcing exit.');
    process.exit(1);
  }, 10000);
  forceExitTimeout.unref();

  if (server) {
    server.close(async (err) => {
      if (err) {
        console.error('[Server] Error while closing HTTP server:', err);
      } else {
        console.log('[Server] HTTP server closed.');
      }

      try {
        await closeDB();
      } catch (dbErr) {
        console.error('[Server] Error closing database connection:', dbErr);
      }

      console.log('[Server] Graceful shutdown completed.');
      process.exit(0);
    });
  } else {
    try {
      await closeDB();
    } catch (dbErr) {
      console.error('[Server] Error closing database connection:', dbErr);
    }
    process.exit(0);
  }
}

// Graceful shutdown event listeners
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Uncaught exceptions and unhandled rejections
process.on('uncaughtException', (error) => {
  console.error('[Server] Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  console.error('[Server] Unhandled Rejection:', reason);
  gracefulShutdown('unhandledRejection');
});

startServer();
