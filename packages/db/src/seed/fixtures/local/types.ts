import type { DEFAULT_ROLE_TEMPLATES, PermissionKey } from '@project/authorization';

import type { inventoryConditions } from '../../../schema/inventory/index.js';
import type { inventoryDemoRoles } from './inventory-roles.js';

export type SharedSeedRoleId = (typeof DEFAULT_ROLE_TEMPLATES)[number]['id'];
export type InventoryDemoRoleId = (typeof inventoryDemoRoles)[number]['id'];
export type SeedRoleId = SharedSeedRoleId | InventoryDemoRoleId;
export type AuthSeedUser = { username: string; name: string; roles?: SeedRoleId[] };
export type ElevatedGrantSeed = {
  key: string;
  username: string;
  permission: PermissionKey;
  targetUsername?: string;
  validForHours: number;
  maxUses: number;
};
export type ReferenceSeed = {
  staffCategories: {
    code: string;
    nameAr: string;
    nameEn: string;
    description?: string;
  }[];
  positions: {
    categoryCode: string;
    code: string;
    nameAr: string;
    nameEn: string;
    isAcademic: 0 | 1;
  }[];
  academicRanks: {
    code: string;
    nameAr: string;
    nameEn: string;
    rankOrder: number;
  }[];
  gradeSchemes: {
    code: string;
    nameAr: string;
    nameEn: string;
    description?: string;
  }[];
  employmentGrades: {
    schemeCode: string;
    gradeNumber: number;
    stepNumber: number;
    labelAr: string;
    labelEn: string;
  }[];
};
export type EmployeeSeed = {
  employeeNumber: string;
  username: string;
  firstNameAr: string;
  lastNameAr: string;
  firstNameEn: string;
  lastNameEn: string;
  categoryCode: string;
  positionCode: string;
  academicRankCode?: string;
  department: string;
  employmentRegime: string;
  startDate: string;
};

export type FacilitiesSeed = {
  buildings: { buildingCode: string; title: string; address?: string; status?: string }[];
  floors: { buildingCode: string; floorNumber: number; title?: string }[];
  roomTypes: { name: string; description?: string }[];
  rooms: {
    buildingCode: string;
    floorNumber: number;
    roomType: string;
    roomCode: string;
    title: string;
    maximumStudentCapacity?: number | null;
    currentAvailableStudentCapacity?: number | null;
    status?: string;
  }[];
};

export type AdministratorSeed = {
  id: string;
  accountId: string;
  username: string;
  displayUsername: string;
  name: string;
  email: string;
  approved: boolean;
  enabled: boolean;
  mustChangePassword: boolean;
};

export type SeedRoom = { buildingCode: string; roomCode: string };
type OpeningBatch = { id: string; name: string; reference: string; eventDate: string };
type OpeningAsset = {
  id: string;
  tag: string;
  name: string;
  category: string;
  condition: (typeof inventoryConditions)[number];
};
export type InventorySeed = {
  sharedAccounts: { id: string; name: string }[];
  storage: (SeedRoom & { sharedAccountId: string })[];
  consumables: { id: string; code: string; name: string; unit: string }[];
  receipts: (OpeningBatch & {
    source: 'purchase' | 'head-administration';
    room: SeedRoom;
    assets: OpeningAsset[];
    stock: { code: string; quantity: number }[];
  })[];
  issues: (OpeningBatch & { assetTag: string; employeeNumber: string; room: SeedRoom | null })[];
};
