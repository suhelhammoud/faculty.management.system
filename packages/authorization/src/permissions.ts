export const PERMISSION = {
  users: {
    read: 'users:read',
    create: 'users:create',
    approve: 'users:approve',
    resetPassword: 'users:reset-password',
    assignRoles: 'users:assign-roles',
  },
  roles: {
    read: 'roles:read',
    create: 'roles:create',
    update: 'roles:update',
  },
  audit: {
    read: 'audit:read',
  },
  hrEmployees: {
    read: 'hr-employees:read',
    create: 'hr-employees:create',
    update: 'hr-employees:update',
  },
  hrReferenceData: {
    read: 'hr-reference-data:read',
    write: 'hr-reference-data:write',
  },
  facilities: {
    read: 'facilities:read',
    write: 'facilities:write',
  },
  workflow: {
    monitor: 'workflow:monitor',
  },
  studentAffairs: {
    read: 'student-affairs:read',
    administer: 'student-affairs:administer',
    grantPromotions: 'student-affairs:grant-promotions',
  },
  inventory: {
    read: 'inventory:read',
    configure: 'inventory:configure',
    postTransactions: 'inventory:post-transactions',
    dispose: 'inventory:dispose',
    manageAssets: 'inventory:manage-assets',
    requestRemoval: 'inventory:request-removal',
    reviewRemoval: 'inventory:removal-review',
    decideRemoval: 'inventory:removal-decide',
    withdrawRemoval: 'inventory:removal-withdraw',
  },
} as const;

export const PERMISSION_CATALOG = [
  { key: PERMISSION.users.read, description: 'View user accounts' },
  { key: PERMISSION.users.create, description: 'Create user accounts' },
  { key: PERMISSION.users.approve, description: 'Approve or manage account access' },
  { key: PERMISSION.users.resetPassword, description: 'Reset user passwords' },
  { key: PERMISSION.users.assignRoles, description: 'Assign roles to users' },
  { key: PERMISSION.roles.read, description: 'View roles and permissions' },
  { key: PERMISSION.roles.create, description: 'Create roles' },
  { key: PERMISSION.roles.update, description: 'Update roles and their permissions' },
  { key: PERMISSION.audit.read, description: 'View the audit log' },
  { key: PERMISSION.hrEmployees.read, description: 'View HR employee records' },
  { key: PERMISSION.hrEmployees.create, description: 'Create HR employee records' },
  { key: PERMISSION.hrEmployees.update, description: 'Update HR employee records' },
  { key: PERMISSION.hrReferenceData.read, description: 'View HR reference data' },
  { key: PERMISSION.hrReferenceData.write, description: 'Manage HR reference data' },
  { key: PERMISSION.facilities.read, description: 'View facilities records' },
  { key: PERMISSION.facilities.write, description: 'Manage facilities records' },
  { key: PERMISSION.studentAffairs.read, description: 'Read Student Affairs records' },
  {
    key: PERMISSION.studentAffairs.administer,
    description: 'Administer Student Affairs and use dean-issued promotion grants',
  },
  {
    key: PERMISSION.studentAffairs.grantPromotions,
    description: 'Issue and revoke Student Affairs promotion grants',
  },
  {
    key: PERMISSION.workflow.monitor,
    description: 'View the workflow monitor within record scope',
  },
  {
    key: PERMISSION.inventory.manageAssets,
    description: 'Register assets and change asset custody',
  },
  { key: PERMISSION.inventory.read, description: 'Read inventory and transaction history' },
  { key: PERMISSION.inventory.configure, description: 'Configure inventory storage and catalogs' },
  {
    key: PERMISSION.inventory.postTransactions,
    description: 'Post inventory movements and adjustments',
  },
  { key: PERMISSION.inventory.dispose, description: 'Record physical disposal of approved assets' },
  { key: PERMISSION.inventory.requestRemoval, description: 'Submit asset removal requests' },
  { key: PERMISSION.inventory.reviewRemoval, description: 'Review asset removal requests' },
  {
    key: PERMISSION.inventory.decideRemoval,
    description: 'Record asset removal committee decisions',
  },
  {
    key: PERMISSION.inventory.withdrawRemoval,
    description: 'Withdraw asset removal requests awaiting a committee decision',
  },
] as const;

export type PermissionKey = (typeof PERMISSION_CATALOG)[number]['key'];

export const ELEVATED_PERMISSION_SCOPES: ReadonlyMap<string, 'users' | 'inventory.asset' | null> =
  new Map<PermissionKey, 'users' | 'inventory.asset' | null>([
    [PERMISSION.users.create, null],
    [PERMISSION.users.approve, 'users'],
    [PERMISSION.users.resetPassword, 'users'],
    [PERMISSION.hrEmployees.create, null],
    [PERMISSION.hrEmployees.update, null],
    [PERMISSION.hrReferenceData.write, null],
    [PERMISSION.facilities.write, null],
    [PERMISSION.inventory.configure, null],
    [PERMISSION.inventory.manageAssets, 'inventory.asset'],
  ]);

export const HR_PERMISSIONS = [
  PERMISSION.hrEmployees.read,
  PERMISSION.hrEmployees.create,
  PERMISSION.hrEmployees.update,
  PERMISSION.hrReferenceData.read,
  PERMISSION.hrReferenceData.write,
] as const satisfies readonly PermissionKey[];

export const FACILITIES_PERMISSIONS = [
  PERMISSION.facilities.read,
  PERMISSION.facilities.write,
] as const satisfies readonly PermissionKey[];
