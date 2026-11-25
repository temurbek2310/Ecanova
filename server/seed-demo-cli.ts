import 'dotenv/config';
import { getPool, isDatabaseConfigured } from './db.ts';
import { seedIfEmpty } from './seed.ts';
import { seedDemoCohort } from './seed-demo.ts';

/**
 * DEV-ONLY: seeds the demo cohort (learners, XP, weekly attempts) on top of
 * the curriculum. Refuses to run when NODE_ENV=production.
 *   npm run db:seed:demo            # learners only
 *   npm run db:seed:demo -- --staff # also creates the demo admin account
 */
async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.error('Refusing to seed demo accounts with NODE_ENV=production.');
    process.exit(1);
  }
  if (!isDatabaseConfigured()) {
    console.error('Error: SUPABASE_DB_URL or DATABASE_URL is not configured.');
    process.exit(1);
  }
  await seedIfEmpty();
  await seedDemoCohort({ includeStaff: process.argv.includes('--staff') });
  console.log('Demo cohort seeded.');
  await getPool().end();
}

main().catch((err) => {
  console.error('Demo seeding failed:', err);
  process.exit(1);
});
