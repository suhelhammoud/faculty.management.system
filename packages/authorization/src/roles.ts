import {
  FACILITIES_PERMISSIONS,
  HR_PERMISSIONS,
  PERMISSION_CATALOG,
  type PermissionKey,
} from './permissions.js';

export type DefaultRoleTemplate = {
  id: string;
  name: string;
  description: string;
  permissions: readonly PermissionKey[];
};

export const ADMINISTRATOR_DEFAULT_ROLE = {
  id: 'administrator',
  name: 'Administrator',
  description: 'Full access to user administration and all application modules.',
  permissions: PERMISSION_CATALOG.map(({ key }) => key),
} as const satisfies DefaultRoleTemplate;

export const HR_DEFAULT_ROLE = {
  id: 'hr-administrator',
  name: 'HR Administrator',
  description: 'Manage employee records and HR reference data.',
  permissions: HR_PERMISSIONS,
} as const satisfies DefaultRoleTemplate;

export const FACILITIES_DEFAULT_ROLE = {
  id: 'facilities-administrator',
  name: 'Facilities Administrator',
  description: 'View and manage buildings, floors, room types, and rooms.',
  permissions: FACILITIES_PERMISSIONS,
} as const satisfies DefaultRoleTemplate;

export const DEFAULT_ROLE_TEMPLATES = [HR_DEFAULT_ROLE, FACILITIES_DEFAULT_ROLE] as const;
