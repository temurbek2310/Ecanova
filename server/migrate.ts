import 'dotenv/config';
import { applyMigrations, getPool, isDatabaseConfigured } from './db.ts';

async function main() {
  if (!isDatabaseConfigured()) {
    console.error('Error: SUPABASE_DB_URL or DATABASE_URL is not configured.');
    process.exit(1);
  }
  const applied = await applyMigrations();
  if (applied.length === 0) {
    console.log('All Supabase PostgreSQL migrations are already applied.');
  } else {
    console.log('Applied PostgreSQL migrations:', applied.join(', '));
  }
  await getPool().end();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
