import { after, before, test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { and, eq, isNull } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDb } from '../dist/client.js';
import { seedLocalDatabase } from '../dist/seed/run-local.js';
import { validateLocalFixtures } from '../dist/seed/validation.js';
import { localAdministrator, localUsers } from '../dist/seed/fixtures/local/auth.js';
import { hrReferenceData } from '../dist/seed/fixtures/local/hr-reference-data.js';
import { hrEmployees } from '../dist/seed/fixtures/local/hr-employees.js';
import { localInventory } from '../dist/seed/fixtures/local/inventory.js';
import { inventoryDemoRoles } from '../dist/seed/fixtures/local/inventory-roles.js';
import {
  inventoryAssets,
  inventoryBalances,
  inventoryConsumables,
  inventoryCustodies,
  inventoryStorage,
  inventoryTransactions,
  inventoryTransactionLines,
  facilitiesRooms,
  workflowTasks,
} from '../dist/schema/index.js';
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
  inventory: localInventory,
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
    [(f) => (f.inventory.receipts[0].stock[0].quantity = 0.5), /Invalid Inventory stock quantity/],
    [(f) => (f.inventory.issues[0].employeeNumber = 'unknown'), /Unknown Inventory employee/],
    [(f) => (f.inventory.storage[0].roomCode = 'unknown'), /Unknown active Inventory storage room/],
    [
      (f) => (f.inventory.receipts[0].eventDate = '2025-02-30'),
      /Invalid Inventory transaction date/,
    ],
    [
      (f) => (f.inventory.receipts[0].assets[1].tag = f.inventory.receipts[0].assets[0].tag),
      /Duplicate Inventory asset tag/,
    ],
    [
      (f) => (f.inventory.receipts[0].assets[1].id = f.inventory.receipts[0].assets[0].id),
      /Duplicate Inventory fixture ID/,
    ],
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
    for (const template of [
      ADMINISTRATOR_DEFAULT_ROLE,
      ...DEFAULT_ROLE_TEMPLATES,
      ...inventoryDemoRoles,
    ]) {
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
  test('posts consistent Inventory opening records and preserves them on rerun', async () => {
    const { db } = connection;
    const ledgers = await db.select().from(inventoryTransactions);
    assert.equal(ledgers.length, 4);
    assert.equal((await db.select().from(inventoryTransactionLines)).length, 11);
    assert.equal((await db.select().from(workflowTasks)).length, 0);
    assert.deepEqual(
      (await db.select().from(inventoryBalances)).map(({ quantity }) => quantity).sort(),
      [10, 12, 20],
    );
    assert.equal((await db.select().from(inventoryAssets)).length, 6);
    assert.equal((await db.select().from(inventoryConsumables)).length, 3);
    assert.equal((await db.select().from(inventoryStorage)).length, 2);
    for (const template of inventoryDemoRoles) {
      const actual = await db
        .select()
        .from(rolePermissions)
        .where(eq(rolePermissions.roleId, template.id));
      assert.deepEqual(
        new Set(actual.map(({ permission }) => permission)),
        new Set(template.permissions),
      );
    }

    const [asset] = await db
      .select()
      .from(inventoryAssets)
      .where(eq(inventoryAssets.tag, 'DEMO-INV-001'));
    const [room] = await db
      .select()
      .from(facilitiesRooms)
      .where(eq(facilitiesRooms.roomId, asset.roomId));
    assert.equal(room.roomCode, 'lab_01');
    const [loan] = await db
      .select()
      .from(inventoryAssets)
      .where(eq(inventoryAssets.tag, 'DEMO-INV-002'));
    assert.equal(loan.roomId, null);
    const [current] = await db
      .select()
      .from(inventoryCustodies)
      .where(and(eq(inventoryCustodies.assetId, asset.id), isNull(inventoryCustodies.endedAt)));
    assert.ok(current.employeeId);
    const [store] = await db.select().from(inventoryStorage);
    await db.transaction(async (tx) => {
      await tx
        .update(inventoryCustodies)
        .set({ endedAt: new Date() })
        .where(eq(inventoryCustodies.id, current.id));
      await tx
        .insert(inventoryCustodies)
        .values({ assetId: asset.id, sharedAccountId: store.sharedAccountId });
      await tx
        .update(inventoryAssets)
        .set({ roomId: store.roomId, condition: 'malfunctioning', revision: 3 })
        .where(eq(inventoryAssets.id, asset.id));
    });
    await db
      .update(inventoryBalances)
      .set({ quantity: 7 })
      .where(eq(inventoryBalances.quantity, 20));
    await db
      .update(inventoryStorage)
      .set({ enabled: 0 })
      .where(eq(inventoryStorage.roomId, store.roomId));
    await db
      .insert(userRoles)
      .values({ userId: 'seed-staff_one', roleId: inventoryDemoRoles[0].id });
    const before = await snapshot();
    await seedLocalDatabase(db, fixtures, password);
    const after = await snapshot();
    for (const [table, rows] of Object.entries(before)) {
      if (table.startsWith('inventory_') || table.startsWith('workflow_'))
        assert.deepEqual(after[table], rows, table);
    }
    assert.ok(
      (await db.select().from(userRoles).where(eq(userRoles.userId, 'seed-staff_one'))).some(
        ({ roleId }) => roleId === inventoryDemoRoles[0].id,
      ),
    );
  });
  test('rejects an Inventory tag collision and rolls back earlier fixture writes', async () => {
    const { db } = connection;
    await db.insert(inventoryAssets).values({ tag: 'DEMO-INV-COLLISION', name: 'Unrelated' });
    const f = clone();
    f.users[0].name = 'Must roll back';
    f.inventory.receipts[1].assets[1].tag = 'DEMO-INV-COLLISION';
    const before = await snapshot();
    await assert.rejects(seedLocalDatabase(db, f, password), /Inventory seed asset collision/);
    assert.deepEqual(await snapshot(), before);
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
