import type { DEFAULT_ROLE_TEMPLATES } from '@project/authorization';

export type SeedRoleId = (typeof DEFAULT_ROLE_TEMPLATES)[number]['id'];
export type AuthSeedUser = { username: string; name: string; roles?: SeedRoleId[] };
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
