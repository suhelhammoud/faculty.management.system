import { loadEnvFile } from 'node:process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createDb } from '../client.js';
import { seedLocalDatabase } from './run-local.js';
import { localAdministrator, localUsers } from './fixtures/local/auth.js';
import { hrReferenceData } from './fixtures/local/hr-reference-data.js';
import { hrEmployees } from './fixtures/local/hr-employees.js';
import { localInventory } from './fixtures/local/inventory.js';
import { localFacilities } from './fixtures/local/facilities.js';

const dbPackageRoot = resolve(import.meta.dirname, '../..');

function isSafeLocalDatabase(databaseUrl: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    return false;
  }

  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  const databaseName = decodeURIComponent(parsed.pathname.slice(1)).toLowerCase();
  const productionNames = new Set(['prod', 'production', 'live']);
  const productionName =
    productionNames.has(databaseName) ||
    /(^|[_-])(prod|production|live)([_-]|$)/.test(databaseName);
  return (
    process.env.NODE_ENV !== 'production' &&
    ['localhost', '127.0.0.1', '::1'].includes(host) &&
    !productionName
  );
}

const databaseEnvPath = resolve(dbPackageRoot, '.env.db');
const seedEnvPath = resolve(dbPackageRoot, '.env');
if (existsSync(databaseEnvPath)) loadEnvFile(databaseEnvPath);
if (existsSync(seedEnvPath)) loadEnvFile(seedEnvPath);
const databaseUrl = process.env.DATABASE_URL;
const password = process.env.SEED_USER_PASSWORD;
if (!databaseUrl) throw new Error('Set DATABASE_URL in packages/db/.env.db or the environment');
if (!password) throw new Error('Set SEED_USER_PASSWORD in packages/db/.env');
if (!isSafeLocalDatabase(databaseUrl)) {
  throw new Error('Local seeding is restricted to non-production loopback databases');
}

const { db, pool } = createDb(databaseUrl);
try {
  const { userCount, employeeCount, roomCount, assetCount, consumableCount, storageCount } =
    await seedLocalDatabase(
      db,
      {
        administrator: localAdministrator,
        users: localUsers,
        references: hrReferenceData,
        employees: hrEmployees,
        facilities: localFacilities,
        inventory: localInventory,
      },
      password,
    );
  console.log(
    `Provisioned local administrator "${localAdministrator.username}" and seeded ${userCount} demo users, ${employeeCount} synthetic HR employees, and ${roomCount} Facilities rooms. Inventory fixtures cover ${assetCount} assets and ${consumableCount} consumable types across ${storageCount} storage rooms.`,
  );
} finally {
  await pool.end();
}
