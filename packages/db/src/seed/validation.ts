import { inventoryDemoRoles } from './fixtures/local/inventory-roles.js';
import { inventoryDemoUsers, inventoryOperatorUsername } from './fixtures/local/auth.js';
import { validateFacilities } from './modules/facilities/validation.js';
import { validateHr } from './modules/hr/validation.js';
import { validateInventory } from './modules/inventory/validation.js';
import { DEFAULT_ROLE_TEMPLATES } from '@project/authorization';
import type {
  AuthSeedUser,
  AdministratorSeed,
  ReferenceSeed,
  EmployeeSeed,
  FacilitiesSeed,
  InventorySeed,
} from './fixtures/local/types.js';

export function validatePassword(password: string): void {
  if (password.length < 12 || password.length > 128)
    throw new Error('SEED_USER_PASSWORD must be 12–128 characters');
}

export function validateUsers(seedUsers: AuthSeedUser[]): void {
  const allowedRoleIds = new Set<string>(DEFAULT_ROLE_TEMPLATES.map(({ id }) => id));
  const inventoryRoleIds = new Set<string>(inventoryDemoRoles.map(({ id }) => id));
  const inventoryUsernames = new Set(inventoryDemoUsers.map(({ username }) => username));
  if (
    !seedUsers.length ||
    seedUsers.some(
      ({ username, name, roles: assignedRoles }) =>
        !/^[a-z0-9_]{3,30}$/.test(username) ||
        !name.trim() ||
        (assignedRoles ?? []).some(
          (role) =>
            !allowedRoleIds.has(role) &&
            !(inventoryUsernames.has(username) && inventoryRoleIds.has(role)),
        ),
    )
  ) {
    throw new Error('Auth fixtures need valid usernames, names, and recognized roles');
  }

  const usernames = seedUsers.map(({ username }) => username);
  if (new Set(usernames).size !== usernames.length) throw new Error('Duplicate username');
}

export type LocalSeedFixtures = {
  administrator: AdministratorSeed;
  users: AuthSeedUser[];
  references: ReferenceSeed;
  employees: EmployeeSeed[];
  facilities: FacilitiesSeed;
  inventory: InventorySeed;
};
export function validateLocalFixtures(fixtures: LocalSeedFixtures, password: string): void {
  validatePassword(password);
  validateUsers(fixtures.users);
  const admin = fixtures.administrator;
  if (
    !/^[a-z0-9_]{3,30}$/.test(admin.username) ||
    !admin.id.trim() ||
    !admin.accountId.trim() ||
    !admin.name.trim() ||
    !admin.email.includes('@')
  )
    throw new Error('Invalid local administrator profile');
  if (
    fixtures.users.some(
      (u) =>
        u.username === admin.username ||
        `seed-${u.username}` === admin.id ||
        `seed-account-${u.username}` === admin.accountId ||
        `${u.username}@seed.invalid` === admin.email,
    )
  )
    throw new Error('Administrator conflicts with a demo user');
  validateHr(
    fixtures.references,
    fixtures.employees,
    new Set(fixtures.users.map((u) => u.username)),
  );
  validateFacilities(fixtures.facilities);
  if (
    !fixtures.users.some(
      ({ username, roles }) =>
        username === inventoryOperatorUsername && roles?.includes(inventoryDemoRoles[0].id),
    )
  )
    throw new Error('Inventory seed requires its demo operator');
  validateInventory(fixtures.inventory, fixtures.facilities, fixtures.employees);
}
