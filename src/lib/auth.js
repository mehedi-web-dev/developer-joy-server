import { betterAuth } from 'better-auth';
import { mongodbAdapter } from 'better-auth/adapters/mongodb';
import { getDB, getClient } from '../config/db.js';
import dotenv from 'dotenv';

dotenv.config();

const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
const backendUrl = process.env.BETTER_AUTH_URL || `http://localhost:${process.env.PORT || 5000}`;

// Build unique normalized trusted origins for CORS and cross-origin authentication
const trustedOrigins = Array.from(
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

export const auth = betterAuth({
  database: mongodbAdapter(getDB(), {
    client: getClient(),
  }),
  baseURL: backendUrl,
  secret: process.env.BETTER_AUTH_SECRET,
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
