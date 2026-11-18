import { after, before, test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { eq } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDb } from '../dist/client.js';
import { seedLocalDatabase } from '../dist/seed/run-local.js';
import { validateLocalFixtures } from '../dist/seed/validation.js';
import { localAdministrator, localUsers } from '../dist/seed/fixtures/local/auth.js';
import { hrReferenceData } from '../dist/seed/fixtures/local/hr-reference-data.js';
import { hrEmployees } from '../dist/seed/fixtures/local/hr-employees.js';
import { localFacilities } from '../dist/seed/fixtures/local/facilities.js';
import { user, account, roles, userRoles, rolePermissions } from '../dist/schema/auth/index.js';
import { ADMINISTRATOR_DEFAULT_ROLE, DEFAULT_ROLE_TEMPLATES } from '@project/authorization';

const password = 'local-test-password';
const fixtures = {
  administrator: localAdministrator,
  users: localUsers,
  references: hrReferenceData,
  employees: hrEmployees,
  facilities: localFacilities,
};
const clone = () => structuredClone(fixtures);

test('fixture preflight rejects duplicates, missing references, and invalid capacities', () => {
  validateLocalFixtures(fixtures, password);
  const cases = [
    [(f) => f.users.push(f.users[0]), /Duplicate username/],
    [(f) => f.employees.push(f.employees[0]), /Duplicate employee number/],
    [(f) => (f.employees[0].username = 'unknown'), /Unknown username/],
    [
      (f) => (f.references.positions[0].categoryCode = 'unknown'),
      /Unknown position|Unknown category/,
    ],
    [(f) => (f.facilities.rooms[0].floorNumber = 999), /Unknown floor/],
    [(f) => (f.facilities.rooms[0].maximumStudentCapacity = -1), /Invalid maximum capacity/],
  ];
  for (const [change, expected] of cases) {
    const f = clone();
    change(f);
    assert.throws(() => validateLocalFixtures(f, password), expected);
  }
});

test('invalid fixtures never start a database transaction', async () => {
  const f = clone();
  f.users.push(f.users[0]);
  await assert.rejects(
    seedLocalDatabase(
      {
        transaction() {
          assert.fail('transaction started');
        },
      },
      f,
      password,
    ),
    /Duplicate username/,
  );
});

// Opt in with a loopback PostgreSQL URL whose user can create databases.
// All writes occur in a new randomly named database, which is dropped afterward.
describe('local seed PostgreSQL integration', { skip: !process.env.SEED_TEST_DATABASE_URL }, () => {
  let control, connection, name;
  before(async () => {
    const url = new URL(process.env.SEED_TEST_DATABASE_URL);
    assert.ok(
      ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname),
      'Test server must be loopback',
    );
    name = `seed_${randomUUID().replaceAll('-', '')}_test`;
    control = new Pool({ connectionString: url.toString() });
    await control.query(`CREATE DATABASE "${name}"`);
    url.pathname = `/${name}`;
    connection = createDb(url.toString());
    await migrate(connection.db, {
      migrationsFolder: new URL('../drizzle', import.meta.url).pathname,
    });
  });
  after(async () => {
    await connection?.pool.end();
    if (control) {
      try {
        if (name) await control.query(`DROP DATABASE IF EXISTS "${name}"`);
      } finally {
        await control.end();
      }
    }
  });
  const snapshot = async () => {
    const tables = await connection.pool.query(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename",
    );
    const result = {};
    for (const { tablename } of tables.rows) {
      result[tablename] = (
        await connection.pool.query(`SELECT * FROM "${tablename}" ORDER BY 1, 2`)
      ).rows;
    }
    return result;
  };
  test('creates roles and users; reruns preserve admin credentials and reconcile demo roles', async () => {
    const { db } = connection;
    const first = await seedLocalDatabase(db, fixtures, password);
    assert.equal(first.userCount, localUsers.length);
    assert.equal(first.employeeCount, hrEmployees.length);
    assert.equal(first.roomCount, localFacilities.rooms.length);
    for (const template of [ADMINISTRATOR_DEFAULT_ROLE, ...DEFAULT_ROLE_TEMPLATES]) {
      const [saved] = await db.select().from(roles).where(eq(roles.name, template.name));
      assert.equal(saved.description, template.description);
      assert.equal(
        (await db.select().from(rolePermissions).where(eq(rolePermissions.roleId, saved.id)))
          .length,
        template.permissions.length,
      );
    }
    const [adminAccount] = await db
      .select()
      .from(account)
      .where(eq(account.userId, localAdministrator.id));
    await db
      .update(user)
      .set({ name: 'Edited administrator', mustChangePassword: true })
      .where(eq(user.id, localAdministrator.id));
    const rerun = clone();
    rerun.users[0].roles = [];
    await seedLocalDatabase(db, rerun, 'different-test-password');
    assert.equal((await db.select().from(user)).length, localUsers.length + 1);
    assert.equal((await db.select().from(account)).length, localUsers.length + 1);
    assert.equal(
      (await db.select().from(account).where(eq(account.id, adminAccount.id)))[0].password,
      adminAccount.password,
    );
    assert.equal(
      (await db.select().from(user).where(eq(user.id, localAdministrator.id)))[0].name,
      'Edited administrator',
    );
    assert.equal(
      (
        await db
          .select()
          .from(userRoles)
          .where(eq(userRoles.userId, `seed-${localUsers[0].username}`))
      ).length,
      0,
    );
  });
  test('rejects unrelated user and credential collisions without changes', async () => {
    const { db } = connection;
    await db.insert(user).values({
      id: 'unrelated',
      username: 'occupied',
      name: 'Existing user',
      email: 'existing@seed.invalid',
    });
    let f = clone();
    f.users.push({ username: 'occupied', name: 'Demo' });
    let before = await snapshot();
    await assert.rejects(seedLocalDatabase(db, f, password), /Seed account collision/);
    assert.deepEqual(await snapshot(), before);
    await db.insert(account).values({
      id: 'seed-account-extra',
      userId: 'unrelated',
      accountId: 'unrelated',
      providerId: 'credential',
      password: 'untouched',
    });
    f = clone();
    f.users.push({ username: 'extra', name: 'Demo' });
    before = await snapshot();
    await assert.rejects(seedLocalDatabase(db, f, password), /credentials belong/);
    assert.deepEqual(await snapshot(), before);
  });
  test('rolls back earlier writes when a later database operation fails', async () => {
    const { db } = connection;
    // This valid integer passes fixture checks but exceeds the PostgreSQL integer range.
    const f = clone();
    f.users[0].name = 'Must roll back';
    f.facilities.rooms[0].maximumStudentCapacity = 2147483648;
    const before = await snapshot();
    await assert.rejects(seedLocalDatabase(db, f, password));
    assert.deepEqual(await snapshot(), before);
  });
});
