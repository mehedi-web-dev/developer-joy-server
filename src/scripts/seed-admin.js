import { connectDB, closeDB } from '../config/db.js';
import { initializeAdmin } from '../lib/admin.js';

async function main() {
  console.log('============================================');
  console.log(' DeveloperJoy - Secure Admin Initialization');
  console.log('============================================\n');

  try {
    console.log('[Seed] Connecting to MongoDB database...');
    await connectDB();

    const result = await initializeAdmin();

    if (result.created) {
      console.log('\n[Seed] ✓ Initial admin account successfully created!');
      console.log(`[Seed] Email: ${result.user.email}`);
      console.log('[Seed] Role:  admin');
    } else if (result.user) {
      console.log('\n[Seed] ✓ Admin account already exists and is verified in the database.');
      console.log(`[Seed] Email: ${result.user.email}`);
      console.log(`[Seed] Role:  ${result.user.role || 'admin'}`);
    } else {
      console.log('\n[Seed] ⚠ Setup skipped: ADMIN_EMAIL or ADMIN_PASSWORD is missing in your .env file.');
      console.log('[Seed] Please ensure both are configured in .env before running this script.');
      process.exitCode = 1;
    }
  } catch (error) {
    console.error('\n[Seed] ❌ Failed to initialize admin account:', error.message);
    process.exitCode = 1;
  } finally {
    await closeDB();
    console.log('\n[Seed] Database connection closed.');
  }
}

main();
