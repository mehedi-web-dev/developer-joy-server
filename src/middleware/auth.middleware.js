import { fromNodeHeaders } from 'better-auth/node';
import { auth } from '../lib/auth.js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Middleware that strictly requires a valid Better Auth session.
 * Rejects unauthenticated requests with a 401 Unauthorized response.
 * Attaches req.user and req.session upon successful verification.
 */
export async function requireAuth(req, res, next) {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (!session || !session.user) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: Valid session required',
      });
    }

    req.user = session.user;
    req.session = session.session;
    next();
  } catch (error) {
    console.error('[Auth Middleware] Session verification failed:', error.message);
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: Failed to verify session',
    });
  }
}

/**
 * Middleware that strictly requires an authenticated session belonging to the
 * authorized Administrator.
 *
 * Checks:
 * 1. Valid Better Auth session exists (401 Unauthorized if missing/expired).
 * 2. Authenticated user matches the configured ADMIN_EMAIL or has role: 'admin'
 *    (403 Forbidden if an ordinary authenticated user attempts access).
 */
export async function requireAdmin(req, res, next) {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (!session || !session.user) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: Valid admin session required',
      });
    }

    const authorizedAdminEmail = (process.env.ADMIN_EMAIL || '').toLowerCase().trim();
    const userEmail = (session.user.email || '').toLowerCase().trim();
    const userRole = session.user.role;

    const isAuthorized =
      (authorizedAdminEmail && userEmail === authorizedAdminEmail) ||
      userRole === 'admin';

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Insufficient permissions. Admin access required',
      });
    }

    req.user = session.user;
    req.session = session.session;
    next();
  } catch (error) {
    console.error('[Auth Middleware] Admin session verification failed:', error.message);
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: Failed to verify admin session',
    });
  }
}

/**
 * Middleware that optionally attaches the authenticated user and session if present,
 * but allows the request to continue if unauthenticated.
 */
export async function optionalAuth(req, res, next) {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (session && session.user) {
      req.user = session.user;
      req.session = session.session;
    }
    next();
  } catch (error) {
    // Non-blocking: continue without user context
    next();
  }
}
