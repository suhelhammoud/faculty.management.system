import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

const migrationsFolder = fileURLToPath(new URL('../drizzle', import.meta.url));
const upgradeBaseline = '0004_student_affairs_access';
const existingAsset = { tag: 'MIGRATION-TEST-ASSET', name: 'Existing demo asset' };

async function copyBaseline(destination, baselineTag = upgradeBaseline) {
  const journalPath = join('meta', '_journal.json');
  const journal = JSON.parse(await readFile(join(migrationsFolder, journalPath), 'utf8'));
  const baseline = journal.entries.findIndex(({ tag }) => tag === baselineTag);
  assert(baseline >= 0 && baseline < journal.entries.length - 1, 'Expected an upgrade migration');

  journal.entries = journal.entries.slice(0, baseline + 1);
  await mkdir(join(destination, 'meta'));
  await writeFile(join(destination, journalPath), JSON.stringify(journal));
  await Promise.all(
    journal.entries.map(({ tag }) => {
      const filename = tag + '.sql';
      return copyFile(join(migrationsFolder, filename), join(destination, filename));
    }),
  );
}

async function verifyMigrations(pool, folder) {
  const { rows } = await pool.query(
    'select hash, created_at from drizzle.__drizzle_migrations order by id',
  );
  const migrations = readMigrationFiles({ migrationsFolder: folder });
  assert.deepEqual(
    rows,
    migrations.map(({ hash, folderMillis }) => ({ hash, created_at: String(folderMillis) })),
  );
}

async function columns(pool) {
  const { rows } = await pool.query(
    `select table_name, column_name, udt_name, is_nullable, column_default
     from information_schema.columns where table_schema = 'public'
     order by table_name, ordinal_position`,
  );
  return rows;
}

test('installs a fresh schema and upgrades an existing schema with data', async (t) => {
  const connectionString = process.env.MIGRATION_TEST_DATABASE_URL;
  assert(connectionString, 'Set MIGRATION_TEST_DATABASE_URL to a local PostgreSQL connection');
  const url = new URL(connectionString);
  assert(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname), 'Use a loopback database');

  const control = new Pool({ connectionString });
  const databases = [];
  const baselineFolder = await mkdtemp(join(tmpdir(), 'faculty-migration-baseline-'));
  const positionsFolder = await mkdtemp(join(tmpdir(), 'faculty-migration-positions-'));
  t.after(async () => {
    try {
      for (const { pool, name } of databases) {
        await pool.end();
        await control.query(`DROP DATABASE "${name}"`);
      }
    } finally {
      await control.end();
      await rm(baselineFolder, { recursive: true, force: true });
      await rm(positionsFolder, { recursive: true, force: true });
    }
  });

  async function createDatabase() {
    const name = `faculty_migration_${randomUUID().replaceAll('-', '')}_test`;
    await control.query(`CREATE DATABASE "${name}"`);
    const databaseUrl = new URL(url);
    databaseUrl.pathname = '/' + name;
    const pool = new Pool({ connectionString: databaseUrl.toString() });
    databases.push({ name, pool });
    return pool;
  }

  const fresh = await createDatabase();
  const upgrade = await createDatabase();
  await copyBaseline(baselineFolder);
  await migrate(drizzle(upgrade), { migrationsFolder: baselineFolder });
  await verifyMigrations(upgrade, baselineFolder);
  await upgrade.query('insert into inventory_assets (tag, name) values ($1, $2)', [
    existingAsset.tag,
    existingAsset.name,
  ]);

  await copyBaseline(positionsFolder, '0008_faculty_positions');
  await migrate(drizzle(upgrade), { migrationsFolder: positionsFolder });
  await upgrade.query(
    "insert into auth_user (id, name, email) values ('test-holder', 'Test holder', 'holder@example.invalid')",
  );
  await upgrade.query(`insert into faculty_position_appointments (position_id, user_id, started_at)
    select id, 'test-holder', '2026-11-03 00:30:00+02' from faculty_positions where code = 'dean'`);

  for (const pool of [fresh, upgrade]) {
    const db = drizzle(pool);
    await migrate(db, { migrationsFolder });
    await migrate(db, { migrationsFolder });
    await verifyMigrations(pool, migrationsFolder);
  }

  assert.deepEqual(await columns(upgrade), await columns(fresh));
  const { rows } = await upgrade.query('select tag, name from inventory_assets where tag = $1', [
    existingAsset.tag,
  ]);
  assert.deepEqual(rows, [existingAsset]);
  const { rows: appointmentDates } = await upgrade.query(
    'select appointment_date::text as date from faculty_position_appointments',
  );
  assert.deepEqual(appointmentDates, [{ date: '2026-11-02' }]);
});
