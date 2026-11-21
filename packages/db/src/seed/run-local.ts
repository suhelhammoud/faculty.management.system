import type { Database } from '../client.js';
import { seedLocalAccess } from './access/local-access.js';
import { seedAuth } from './access/auth.js';
import { seedElevatedGrants } from './access/elevated-grants.js';
import { seedHr } from './modules/hr/seed.js';
import { seedInventory } from './modules/inventory/seed.js';
import { inventoryOperatorUsername } from './fixtures/local/auth.js';
import { seedFacilities } from './modules/facilities/seed.js';
import { assertSeedAccounts, demoIdentity } from './access/ownership.js';
import { validateLocalFixtures, type LocalSeedFixtures } from './validation.js';

export async function seedLocalDatabase(
  db: Database,
  fixtures: LocalSeedFixtures,
  password: string,
) {
  validateLocalFixtures(fixtures, password);
  return db.transaction(
    async (tx) => {
      // Read all account identities before creating roles or changing existing data.
      await assertSeedAccounts(tx, [fixtures.administrator, ...fixtures.users.map(demoIdentity)]);
      await seedLocalAccess(tx, fixtures.administrator, password);
      const userIds = await seedAuth(tx, fixtures.users, password);
      await seedElevatedGrants(tx, fixtures.elevatedGrants, userIds, fixtures.administrator.id);
      const employeeCount = await seedHr(tx, fixtures.references, fixtures.employees, userIds);
      const roomCount = await seedFacilities(tx, fixtures.facilities);
      const operator = userIds.get(inventoryOperatorUsername);
      if (!operator) throw new Error('Inventory seed operator was not provisioned');
      const inventory = await seedInventory(tx, fixtures.inventory, operator);
      return { userCount: userIds.size, employeeCount, roomCount, ...inventory };
    },
    { isolationLevel: 'serializable' },
  );
}
