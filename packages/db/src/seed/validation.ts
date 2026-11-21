import { inventoryDemoRoles } from './fixtures/local/inventory-roles.js';
import { inventoryOperatorUsername, moduleDemoAccess } from './fixtures/local/auth.js';
import { validateFacilities } from './modules/facilities/validation.js';
import { validateHr } from './modules/hr/validation.js';
import { validateInventory } from './modules/inventory/validation.js';
import { validateStudentAffairs } from './modules/student-affairs/validation.js';
import { DEFAULT_ROLE_TEMPLATES, ELEVATED_PERMISSION_SCOPES } from '@project/authorization';
import type {
  AuthSeedUser,
  AdministratorSeed,
  ReferenceSeed,
  EmployeeSeed,
  ElevatedGrantSeed,
  FacilitiesSeed,
  InventorySeed,
  StudentAffairsSeed,
} from './fixtures/local/types.js';

export function validatePassword(password: string): void {
  if (password.length < 12 || password.length > 128)
    throw new Error('SEED_USER_PASSWORD must be 12–128 characters');
}

export function validateUsers(seedUsers: AuthSeedUser[]): void {
  const allowedRoleIds = new Set<string>(DEFAULT_ROLE_TEMPLATES.map(({ id }) => id));
  if (
    !seedUsers.length ||
    seedUsers.some(
      ({ username, name, roles: assignedRoles }) =>
        !/^[a-z0-9_]{3,30}$/.test(username) ||
        !name.trim() ||
        (assignedRoles ?? []).some(
          (role) =>
            !allowedRoleIds.has(role) &&
            !moduleDemoAccess.some(
              ({ users, roles }) =>
                users.some((user) => user.username === username) &&
                roles.some(({ id }) => id === role),
            ),
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
  elevatedGrants: ElevatedGrantSeed[];
  references: ReferenceSeed;
  employees: EmployeeSeed[];
  facilities: FacilitiesSeed;
  inventory: InventorySeed;
  studentAffairs: StudentAffairsSeed;
};

function validateElevatedGrants(grants: ElevatedGrantSeed[], usernames: ReadonlySet<string>) {
  const keys = new Set<string>();
  for (const grant of grants) {
    if (!/^[a-z0-9-]+$/.test(grant.key) || keys.has(grant.key)) {
      throw new Error(`Invalid or duplicate elevated grant key ${grant.key}`);
    }
    keys.add(grant.key);
    if (
      !usernames.has(grant.username) ||
      (grant.targetUsername !== undefined && !usernames.has(grant.targetUsername))
    ) {
      throw new Error(`Unknown demo account for elevated grant ${grant.key}`);
    }
    const scope = ELEVATED_PERMISSION_SCOPES.get(grant.permission);
    if (scope === undefined || (grant.targetUsername !== undefined && scope !== 'users')) {
      throw new Error(`Unsupported permission or scope for elevated grant ${grant.key}`);
    }
    if (
      [grant.validForHours, grant.maxUses].some(
        (value) => !Number.isInteger(value) || value < 1 || value > 2_147_483_647,
      )
    ) {
      throw new Error(`Invalid lifetime or attempt limit for elevated grant ${grant.key}`);
    }
  }
}

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
  const usernames = new Set(fixtures.users.map((u) => u.username));
  validateElevatedGrants(fixtures.elevatedGrants, usernames);
  validateHr(fixtures.references, fixtures.employees, usernames);
  validateFacilities(fixtures.facilities);
  if (
    !fixtures.users.some(
      ({ username, roles }) =>
        username === inventoryOperatorUsername && roles?.includes(inventoryDemoRoles[0].id),
    )
  )
    throw new Error('Inventory seed requires its demo operator');
  validateInventory(fixtures.inventory, fixtures.facilities, fixtures.employees);
  validateStudentAffairs(fixtures.studentAffairs, fixtures.users);
}
