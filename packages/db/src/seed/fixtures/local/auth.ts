import { HR_DEFAULT_ROLE, FACILITIES_DEFAULT_ROLE } from '@project/authorization';
import type { AuthSeedUser, AdministratorSeed } from './types.js';

export const localUsers = [
  {
    username: 'hr_1',
    name: 'HR One',
    roles: [HR_DEFAULT_ROLE.id],
  },
  {
    username: 'hr_2',
    name: 'HR Two',
    roles: [HR_DEFAULT_ROLE.id],
  },
  {
    username: 'facility_1',
    name: 'facility coordinator',
    roles: [FACILITIES_DEFAULT_ROLE.id],
  },
  {
    username: 'staff_one',
    name: 'Staff One',
    roles: [],
  },
  {
    username: 'staff_two',
    name: 'Staff Two',
    roles: [],
  },
] satisfies AuthSeedUser[];

export const localAdministrator = {
  id: 'seed-admin',
  accountId: 'seed-account-admin',
  username: 'admin',
  displayUsername: 'admin',
  name: 'Local Administrator',
  email: 'admin@seed.invalid',
  approved: true,
  enabled: true,
  mustChangePassword: false,
} satisfies AdministratorSeed;
