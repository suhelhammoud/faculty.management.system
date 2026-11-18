import type { Database } from '../client.js';
import { seedLocalAccess } from './local-access.js';
import { seedAuth } from './auth.js';
import { seedHr } from './hr.js';
import { seedFacilities } from './facilities.js';
import { assertSeedAccounts, demoIdentity } from './ownership.js';
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
      const employeeCount = await seedHr(tx, fixtures.references, fixtures.employees, userIds);
      const roomCount = await seedFacilities(tx, fixtures.facilities);
      return { userCount: userIds.size, employeeCount, roomCount };
    },
    { isolationLevel: 'serializable' },
  );
}
