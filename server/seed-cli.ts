import 'dotenv/config';
import { getPool, isDatabaseConfigured } from './db.ts';
import { seedIfEmpty } from './seed.ts';

async function main() {
  if (!isDatabaseConfigured()) {
    console.error('Error: SUPABASE_DB_URL or DATABASE_URL is not configured.');
    process.exit(1);
  }
  await seedIfEmpty();
  console.log('Curriculum seed check completed.');
  await getPool().end();
}

main().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
