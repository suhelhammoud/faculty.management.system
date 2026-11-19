import { HR_DEFAULT_ROLE, FACILITIES_DEFAULT_ROLE } from '@project/authorization';
import { inventoryDemoRoles } from './inventory-roles.js';
import type { AuthSeedUser, AdministratorSeed } from './types.js';

export const inventoryDemoUsers = [
  {
    username: 'inventory_operator',
    name: 'Demo Inventory Operator',
    roles: [inventoryDemoRoles[0].id],
  },
  {
    username: 'inventory_requester',
    name: 'Demo Inventory Requester',
    roles: [inventoryDemoRoles[1].id],
  },
  {
    username: 'inventory_reviewer',
    name: 'Demo Inventory Reviewer',
    roles: [inventoryDemoRoles[2].id],
  },
  {
    username: 'inventory_recorder',
    name: 'Demo Inventory Recorder',
    roles: [inventoryDemoRoles[3].id],
  },
] satisfies AuthSeedUser[];

export const inventoryOperatorUsername = inventoryDemoUsers[0].username;

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
  ...inventoryDemoUsers,
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
