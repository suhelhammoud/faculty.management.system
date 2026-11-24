import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnvFile } from 'node:process';
import { createDb } from '../client.js';
import { seedCurricula } from './modules/department/seed.js';

const databaseEnv = resolve(import.meta.dirname, '../../.env.db');
if (existsSync(databaseEnv)) loadEnvFile(databaseEnv);
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('Set DATABASE_URL in packages/db/.env.db or the environment');

const { db, pool } = createDb(databaseUrl);
try {
  const counts = await seedCurricula(db);
  console.log(
    `Verified ${counts.departments} departments, ${counts.versions} published versions, and ${counts.modules} curriculum modules.`,
  );
} finally {
  await pool.end();
}
