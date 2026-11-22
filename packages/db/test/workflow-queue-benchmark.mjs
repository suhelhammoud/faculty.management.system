import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { createRequire } from 'node:module';
import { loadEnvFile } from 'node:process';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDb } from '../dist/client.js';
import { seedPermissionCatalog } from '../dist/seed/access/permissions.js';

const apiPath = new URL('../../../apps/api/', import.meta.url);
const requireFromApi = createRequire(new URL('package.json', apiPath));
requireFromApi('reflect-metadata');
const { ConfigService } = requireFromApi('@nestjs/config');
const { AuthorizationService } = await import(
  new URL('dist/auth/authorization.service.js', apiPath)
);
const { WorkflowRegistry } = await import(
  new URL('dist/modules/workflows/workflow-registry.js', apiPath)
);
const { InventoryRemovalService } = await import(
  new URL('dist/modules/inventory/inventory-removal.service.js', apiPath)
);
const { WorkflowsService } = await import(
  new URL('dist/modules/workflows/workflows.service.js', apiPath)
);
const { WorkflowsService: Baseline } = await import(
  new URL('dist/modules/workflows/workflows-baseline.js', apiPath)
);

if (!process.env.DATABASE_URL) loadEnvFile(new URL('../.env.db', import.meta.url).pathname);
const url = new URL(process.env.DATABASE_URL);
assert(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname));
const control = createDb(url.href);
const name = `queue_bench_${randomUUID().replaceAll('-', '')}_test`;
let connection;
try {
  await control.pool.query(`create database "${name}"`);
  url.pathname = `/${name}`;
  connection = createDb(url.href);
  const { db, pool } = connection;
  await migrate(db, { migrationsFolder: new URL('../drizzle', import.meta.url).pathname });
  await db.transaction(seedPermissionCatalog);
  const actor = randomUUID();
  await pool.query(
    'insert into auth_user (id, name, email, approved, must_change_password) values ($1, $1, $2, true, false)',
    [actor, `${actor}@benchmark.invalid`],
  );
  await pool.query("insert into roles (id, name) values ('queue-benchmark', 'Queue benchmark')");
  await pool.query(
    "insert into role_permissions(role_id, permission) values ('queue-benchmark', 'inventory:removal-review')",
  );
  await pool.query("insert into user_roles(user_id, role_id) values ($1, 'queue-benchmark')", [
    actor,
  ]);

  const auth = new AuthorizationService(db);
  const registry = new WorkflowRegistry();
  const current = new WorkflowsService(
    db,
    registry,
    auth,
    new ConfigService({ BETTER_AUTH_SECRET: randomUUID() }),
  );
  new InventoryRemovalService(db, auth, registry, current).onModuleInit();
  registry.onApplicationBootstrap();
  const previous = new Baseline(db, registry, auth);
  let queries = 0;
  const query = pool.query;
  pool.query = function (...args) {
    queries++;
    return query.apply(this, args);
  };

  async function measure(rows, queue, mode, read, expected) {
    const samples = [];
    let perRun = 0;
    await read();
    for (let sample = 0; sample < 5; sample++) {
      queries = 0;
      const start = performance.now();
      const result = await read();
      samples.push(performance.now() - start);
      perRun = queries;
      assert.equal(result, expected);
    }
    samples.sort((a, b) => a - b);
    console.log(
      [rows, queue, mode, samples[2].toFixed(1), samples[4].toFixed(1), perRun, expected].join(
        '\t',
      ),
    );
  }

  console.log('rows\tqueue\tmode\tp50_ms\tp95_ms\tsql_queries\treturned');
  for (const rows of [100, 1000]) {
    await pool.query(
      'truncate workflow_tasks, workflow_events, workflow_instances, inventory_removal_items, inventory_removal_decisions, inventory_removal_requests cascade',
    );
    await pool.query(
      `with subjects as (
      insert into inventory_removal_requests(requester_id)
      select $1 from generate_series(1, $2::int) returning id
    ), instances as (
      insert into workflow_instances(definition_key, definition_version, subject_module, subject_type, subject_id, started_by, status, current_step)
      select 'inventory.removal', 1, 'inventory', 'removal-request', id::text, $1, 'running', 'review' from subjects returning id
    ) insert into workflow_tasks(instance_id, step, status) select id, 'review', 'pending' from instances`,
      [actor, rows],
    );
    for (const queue of ['inbox', 'monitor']) {
      await measure(
        rows,
        queue,
        'baseline all',
        async () => (await previous[queue](actor)).length,
        rows,
      );
      await measure(
        rows,
        queue,
        'first page',
        async () => (await current[queue](actor, { limit: 25 })).records.length,
        25,
      );
      await measure(
        rows,
        queue,
        'all pages',
        async () => {
          let cursor;
          let count = 0;
          do {
            const page = await current[queue](actor, { limit: 25, cursor });
            count += page.records.length;
            cursor = page.nextCursor ?? undefined;
          } while (cursor);
          return count;
        },
        rows,
      );
    }
  }
} finally {
  try {
    if (connection) {
      await connection.pool.end();
      await control.pool.query(`drop database "${name}"`);
    }
  } finally {
    await control.pool.end();
  }
}
