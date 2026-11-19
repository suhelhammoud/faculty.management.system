import { loadEnvFile } from 'node:process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createDb } from '../client.js';
import { seedPermissionCatalog } from './access/permissions.js';

const dbPackageRoot = resolve(import.meta.dirname, '../..');
const envPath = resolve(dbPackageRoot, '.env.db');
if (existsSync(envPath)) loadEnvFile(envPath);

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('Set DATABASE_URL in packages/db/.env.db or the environment');

const { db, pool } = createDb(databaseUrl);
try {
  await db.transaction((tx) => seedPermissionCatalog(tx));
  console.log('Permission catalog synchronized. Existing role assignments were left unchanged.');
} finally {
  await pool.end();
}
