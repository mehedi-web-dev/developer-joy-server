import { betterAuth } from 'better-auth';
import { mongodbAdapter } from 'better-auth/adapters/mongodb';
import { getDB, getClient, dbProxy, clientProxy } from '../config/db.js';
import dotenv from 'dotenv';

dotenv.config();

const frontendUrls = (process.env.FRONTEND_URL || 'http://localhost:3000')
  .split(',')
  .map((url) => url.trim().replace(/\/+$/, ''))
  .filter(Boolean);

const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((url) => url.trim().replace(/\/+$/, '')).filter(Boolean)
  : [];

const backendUrl = (
  process.env.BETTER_AUTH_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '') ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '') ||
  `http://localhost:${process.env.PORT || 5000}`
).trim().replace(/\/+$/, '');

// Build unique normalized trusted origins for CORS and cross-origin authentication
const trustedOrigins = Array.from(
  new Set([
    ...frontendUrls,
    ...corsOrigins,
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'https://developer-joy-server.vercel.app',
    backendUrl,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
    process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null,
  ].filter(Boolean))
);

export const auth = betterAuth({
  database: mongodbAdapter(dbProxy, {
    client: clientProxy,
  }),
  baseURL: backendUrl,
  secret: process.env.BETTER_AUTH_SECRET || 'developerjoy-fallback-secret-key-32-chars-long',
  trustedOrigins,
  emailAndPassword: {
    enabled: true,
    disableSignUp: true, // Strictly disables public self-registration
  },
  user: {
    additionalFields: {
      role: {
        type: 'string',
        required: false,
        defaultValue: 'user',
        input: false, // Prevents client-side manipulation of the role field
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days session expiration
    updateAge: 60 * 60 * 24, // 1 day update age
  },
  advanced: {
    useSecureCookies: process.env.NODE_ENV === 'production',
    defaultCookieAttributes: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      path: '/',
    },
  },
});
