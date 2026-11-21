import { HR_DEFAULT_ROLE, FACILITIES_DEFAULT_ROLE, PERMISSION } from '@project/authorization';
import { inventoryDemoRoles } from './inventory-roles.js';
import { studentAffairsDemoRoles, studentAffairsDemoUsers } from './student-affairs.js';
import type { AuthSeedUser, AdministratorSeed, ElevatedGrantSeed } from './types.js';

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
export const moduleDemoAccess = [
  { users: inventoryDemoUsers, roles: inventoryDemoRoles },
  { users: studentAffairsDemoUsers, roles: studentAffairsDemoRoles },
] as const;
const elevatedDemoUsername = 'elevation_demo';

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
  ...studentAffairsDemoUsers,
  {
    username: elevatedDemoUsername,
    name: 'Demo Elevated Access',
    roles: [],
  },
] satisfies AuthSeedUser[];

export const localElevatedGrants = [
  {
    key: 'approve-staff-two',
    username: elevatedDemoUsername,
    permission: PERMISSION.users.approve,
    targetUsername: 'staff_two',
    validForHours: 24,
    maxUses: 1,
  },
  {
    key: 'facilities-write',
    username: elevatedDemoUsername,
    permission: PERMISSION.facilities.write,
    validForHours: 24,
    maxUses: 3,
  },
] satisfies ElevatedGrantSeed[];

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
