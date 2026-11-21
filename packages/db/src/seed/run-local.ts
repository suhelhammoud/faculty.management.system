import type { Database } from '../client.js';
import { inArray } from 'drizzle-orm';
import { user } from '../schema/auth/index.js';
import { seedLocalAccess } from './access/local-access.js';
import { seedAuth } from './access/auth.js';
import { seedElevatedGrants } from './access/elevated-grants.js';
import { seedHr } from './modules/hr/seed.js';
import { seedInventory } from './modules/inventory/seed.js';
import { inventoryOperatorUsername } from './fixtures/local/auth.js';
import { seedFacilities } from './modules/facilities/seed.js';
import { seedStudentAffairs } from './modules/student-affairs/seed.js';
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
      // Initialize assignments only for new demo accounts. The API owns later grants and revocations.
      const existingStaff = await tx
        .select({ username: user.username })
        .from(user)
        .where(
          inArray(
            user.username,
            fixtures.studentAffairs.assignments.map(({ username }) => username),
          ),
        );
      const userIds = await seedAuth(tx, fixtures.users, password);
      await seedElevatedGrants(tx, fixtures.elevatedGrants, userIds, fixtures.administrator.id);
      const employeeCount = await seedHr(tx, fixtures.references, fixtures.employees, userIds);
      const roomCount = await seedFacilities(tx, fixtures.facilities);
      const operator = userIds.get(inventoryOperatorUsername);
      if (!operator) throw new Error('Inventory seed operator was not provisioned');
      const inventory = await seedInventory(tx, fixtures.inventory, operator);
      const studentAffairs = await seedStudentAffairs(
        tx,
        fixtures.studentAffairs,
        userIds,
        new Set(
          existingStaff.map(({ username }) => username).filter((username) => username !== null),
        ),
      );
      return { userCount: userIds.size, employeeCount, roomCount, ...inventory, ...studentAffairs };
    },
    { isolationLevel: 'serializable' },
  );
}
