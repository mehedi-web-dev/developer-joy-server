import { auth } from './auth.js';
import { getDB } from '../config/db.js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Initializes or verifies the authorized admin account in MongoDB.
 *
 * Security & Design Guarantees:
 * 1. Strictly Server-Side: No public HTTP registration endpoint is exposed.
 * 2. Idempotent & Non-destructive: Existing admin accounts, passwords, hashes,
 *    and user IDs are never overwritten.
 * 3. Official Better Auth Integration: Uses Better Auth's internal adapter and
 *    official password hasher (scrypt) to guarantee total compatibility with
 *    Better Auth session creation and credential verification.
 * 4. Role Enforcement: Sets role: 'admin' on the user document.
 *
 * @param {object} [options]
 * @param {string} [options.email] - Admin email (defaults to process.env.ADMIN_EMAIL)
 * @param {string} [options.password] - Admin password (defaults to process.env.ADMIN_PASSWORD)
 * @param {string} [options.name] - Admin name (defaults to process.env.ADMIN_NAME)
 * @returns {Promise<{ created: boolean, user: object|null, reason?: string }>}
 */
export async function initializeAdmin(options = {}) {
  const adminEmail = (options.email || process.env.ADMIN_EMAIL || '').toLowerCase().trim();
  const adminPassword = options.password || process.env.ADMIN_PASSWORD;
  const adminName = options.name || process.env.ADMIN_NAME || 'DeveloperJoy Admin';

  if (!adminEmail || !adminPassword) {
    console.warn('[Admin Setup] ADMIN_EMAIL or ADMIN_PASSWORD is missing in environment variables. Admin initialization skipped.');
    return { created: false, user: null, reason: 'missing_credentials' };
  }

  const ctx = await auth.$context;
  const existingRecord = await ctx.internalAdapter.findUserByEmail(adminEmail);
  const existingUser = existingRecord?.user || existingRecord;

  if (existingUser) {
    // If the user already exists, ensure their role is set to 'admin'
    if (existingUser.role !== 'admin') {
      const db = getDB();
      await db.collection('user').updateOne(
        { email: adminEmail },
        { $set: { role: 'admin', updatedAt: new Date() } }
      );
      existingUser.role = 'admin';
    }
    console.log(`[Admin Setup] Authorized admin account (${adminEmail}) verified in database.`);
    return { created: false, user: existingUser };
  }

  console.log(`[Admin Setup] Initializing first admin account (${adminEmail})...`);
  const now = new Date();

  // 1. Create user document with role: 'admin'
  const user = await ctx.internalAdapter.createUser({
    name: adminName,
    email: adminEmail,
    role: 'admin',
    emailVerified: true,
    createdAt: now,
    updatedAt: now,
  });

  const userId = user.id || (user._id ? user._id.toString() : String(user));

  // 2. Hash password using Better Auth's official password hasher
  const hashedPassword = await ctx.password.hash(adminPassword);

  // 3. Create credential account document
  await ctx.internalAdapter.createAccount({
    userId,
    accountId: userId,
    providerId: 'credential',
    password: hashedPassword,
    createdAt: now,
    updatedAt: now,
  });

  console.log(`[Admin Setup] Successfully created authorized admin account: ${adminEmail}`);
  return { created: true, user };
}
