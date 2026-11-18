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
] as const;

export type PermissionKey = (typeof PERMISSION_CATALOG)[number]['key'];

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

export type DefaultRoleTemplate = {
  id: string;
  name: string;
  permissions: readonly PermissionKey[];
};

export const HR_DEFAULT_ROLE = {
  id: 'hr-administrator',
  name: 'HR Administrator',
  permissions: HR_PERMISSIONS,
} as const satisfies DefaultRoleTemplate;

export const FACILITIES_DEFAULT_ROLE = {
  id: 'facilities-administrator',
  name: 'Facilities Administrator',
  permissions: FACILITIES_PERMISSIONS,
} as const satisfies DefaultRoleTemplate;

export const DEFAULT_ROLE_TEMPLATES = [HR_DEFAULT_ROLE, FACILITIES_DEFAULT_ROLE] as const;
