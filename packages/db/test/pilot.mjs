import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtemp, rm, open, readFile, mkdir, copyFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { loadEnvFile } from 'node:process';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDb } from '../dist/client.js';

const workspace = new URL('../../../', import.meta.url).pathname;
if (!process.env.DATABASE_URL) loadEnvFile(resolve(workspace, 'packages/db/.env.db'));
const connection = new URL(process.env.DATABASE_URL);
assert(
  ['localhost', '127.0.0.1', '[::1]'].includes(connection.hostname),
  'Use a disposable loopback PostgreSQL server',
);
const rehearsal = process.argv.includes('--restore');
const temporary = await mkdtemp(join(tmpdir(), 'faculty-pilot-'));
const migrations = resolve(workspace, 'packages/db/drizzle');
const control = createDb(connection.href);
const created = [];
const children = [];
const password = randomBytes(24).toString('hex');
const api = 'http://127.0.0.1:4753';
const web = 'http://127.0.0.1:4754';
const environment = {
  ...process.env,
  SEED_USER_PASSWORD: password,
  PILOT_WEB_ORIGIN: web,
  VITE_API_URL: api,
};

function spawnChild(command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: workspace,
    env: environment,
    stdio: 'inherit',
    ...options,
  });
  const done = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => resolve({ code, signal }));
  });
  return { child, done };
}

async function run(command, args, options) {
  const { done } = spawnChild(command, args, options);
  const { code } = await done;
  if (code !== 0) throw new Error(`${command} exited with status ${code}`);
}

async function database() {
  const name = `faculty_pilot_${randomBytes(8).toString('hex')}_test`;
  await control.pool.query(`CREATE DATABASE "${name}"`);
  const url = new URL(connection);
  url.pathname = `/${name}`;
  const db = { ...createDb(url.href), name, url: url.href };
  created.push(db);
  return db;
}

async function waitFor(url, process) {
  for (let i = 0; i < 100; i++) {
    if (process.child.exitCode !== null) throw new Error(`Process for ${url} exited early`);
    if ((await fetch(url, { signal: AbortSignal.timeout(1000) }).catch(() => null))?.ok) return;
    await new Promise((done) => setTimeout(done, 200));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function startApi(db) {
  const server = spawnChild(process.execPath, ['apps/api/dist/main.js'], {
    stdio: ['ignore', 'ignore', 'inherit'],
    env: {
      ...environment,
      DATABASE_URL: db.url,
      PORT: '4753',
      BETTER_AUTH_URL: api,
      BETTER_AUTH_SECRET: randomBytes(40).toString('hex'),
      TRUSTED_ORIGINS: web,
    },
  });
  children.push(server);
  await waitFor(`${api}/health/database`, server);
  return server;
}

async function stop(server) {
  if (server.child.exitCode === null && server.child.signalCode === null) server.child.kill();
  await server.done;
}

async function baseline(folder) {
  const journal = JSON.parse(await readFile(join(migrations, 'meta/_journal.json'), 'utf8'));
  const index = journal.entries.findIndex(({ tag }) => tag === '0005_inventory_discrepancies');
  assert(index >= 0);
  journal.entries = journal.entries.slice(0, index + 1);
  await mkdir(join(folder, 'meta'), { recursive: true });
  await writeFile(join(folder, 'meta/_journal.json'), JSON.stringify(journal));
  await Promise.all(
    journal.entries.map(({ tag }) =>
      copyFile(join(migrations, tag + '.sql'), join(folder, tag + '.sql')),
    ),
  );
}

async function snapshot(db) {
  const tables = [
    'students',
    'student_academic_years',
    'student_affairs_staff_years',
    'student_affairs_promotion_grants',
    'inventory_assets',
    'inventory_custodies',
    'inventory_transactions',
    'audit_log',
  ];
  const rows = await Promise.all(
    tables.map(async (table) => {
      const result = await db.pool.query(
        `select to_jsonb(record) as value from ${table} record order by to_jsonb(record)::text`,
      );
      return [table, result.rows];
    }),
  );
  return Object.fromEntries(rows);
}

async function roleCheck() {
  for (const [username, path, expected] of [
    ['sta_admin', 'student-affairs/students?search=DEMO-STA-002', 200],
    ['sta_dean', 'student-affairs/promotion-grants', 200],
    ['sta_dean', 'student-affairs/students', 403],
    ['inventory_operator', 'inventory/assets', 200],
    ['sta_staff_one', 'inventory/assets', 403],
  ]) {
    const login = await fetch(`${api}/api/auth/sign-in/username`, {
      method: 'POST',
      headers: { Origin: web, 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    assert.equal(login.status, 200, username);
    const cookie = login.headers
      .getSetCookie()
      .map((part) => part.split(';', 1)[0])
      .join('; ');
    const response = await fetch(`${api}/api/${path}`, { headers: { Cookie: cookie } });
    assert.equal(response.status, expected, `${username} / ${path}`);
    if (path.includes('DEMO-STA-002'))
      assert.equal((await response.json()).records[0].currentStudyYear, 3);
    else await response.body?.cancel();
  }
}

try {
  const source = await database();
  if (rehearsal) {
    const oldMigrations = join(temporary, 'baseline');
    await baseline(oldMigrations);
    await migrate(source.db, { migrationsFolder: oldMigrations });
    await source.pool.query(`
      with student as (
        insert into students (academic_id, first_name, current_study_year)
        values ('PILOT-LEGACY', 'Synthetic student', 2) returning student_id
      )
      insert into student_academic_years (student_id, academic_year, year, remarks)
      select student_id, '2025-2026', 1, 'Synthetic history' from student
    `);
    await source.pool.query(
      "insert into inventory_assets(tag, name) values ('PILOT-LEGACY', 'Synthetic asset')",
    );
  }
  await migrate(source.db, { migrationsFolder: migrations });
  await run(process.execPath, ['packages/db/dist/seed/permission-catalog.js'], {
    env: { ...environment, DATABASE_URL: source.url },
  });
  if (rehearsal) {
    const { rows } = await source.pool.query(`
      select revision, first_name, academic_year, remarks from students
      join student_academic_years using (student_id) where academic_id = 'PILOT-LEGACY'
    `);
    assert.deepEqual(rows, [
      {
        revision: 1,
        first_name: 'Synthetic student',
        academic_year: '2025-2026',
        remarks: 'Synthetic history',
      },
    ]);
    const assets = await source.pool.query(
      "select name from inventory_assets where tag = 'PILOT-LEGACY'",
    );
    assert.deepEqual(assets.rows, [{ name: 'Synthetic asset' }]);
    console.log('Upgrade from 0005 preserved an existing student, annual record, and asset.');
  }
  await run(process.execPath, ['packages/db/dist/seed/local.js'], {
    env: { ...environment, DATABASE_URL: source.url, NODE_ENV: 'test' },
  });

  const server = await startApi(source);
  const out = join(temporary, 'web');
  await run('pnpm', ['--filter', 'web', 'build', '--outDir', out, '--emptyOutDir']);
  const webServer = spawnChild(
    process.execPath,
    [
      'node_modules/vite/bin/vite.js',
      'preview',
      '--outDir',
      out,
      '--host',
      '127.0.0.1',
      '--port',
      '4754',
      '--strictPort',
    ],
    { cwd: resolve(workspace, 'apps/web') },
  );
  children.push(webServer);
  await waitFor(web, webServer);
  await run('pnpm', [
    'exec',
    'playwright',
    'test',
    '--config',
    'playwright.frontend.live.config.ts',
  ]);
  await stop(server);

  if (rehearsal) {
    const target = await database();
    const runtime = process.env.PILOT_CONTAINER_RUNTIME || 'podman';
    const container = process.env.PILOT_PG_CONTAINER || 'faculty-postgres';
    const env = { ...environment, PGPASSWORD: decodeURIComponent(connection.password) };
    const args = ['exec', '-i', '--env', 'PGPASSWORD', container];
    const pgUser = decodeURIComponent(connection.username);
    const archive = join(temporary, 'pilot.dump');
    const output = await open(archive, 'w', 0o600);
    try {
      await run(runtime, [...args, 'pg_dump', '-U', pgUser, '-Fc', source.name], {
        env,
        stdio: ['ignore', output.fd, 'inherit'],
      });
    } finally {
      await output.close();
    }
    const input = await open(archive, 'r');
    try {
      await run(
        runtime,
        [...args, 'pg_restore', '-U', pgUser, '--exit-on-error', '-d', target.name],
        {
          env,
          stdio: [input.fd, 'inherit', 'inherit'],
        },
      );
    } finally {
      await input.close();
    }
    assert.deepEqual(await snapshot(target), await snapshot(source));
    await startApi(target);
    await roleCheck();
    console.log('Restored records, audit history, API health, and five role checks verified.');
  }
} finally {
  for (const server of children) await stop(server).catch(() => {});
  try {
    for (const db of created) {
      await db.pool.end();
      await control.pool.query(`DROP DATABASE "${db.name}"`);
    }
  } finally {
    await control.pool.end();
    await rm(temporary, { recursive: true, force: true });
  }
}
