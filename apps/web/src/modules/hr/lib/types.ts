export type Language = 'en' | 'ar';
export type Kind =
  'staff-categories' | 'positions' | 'academic-ranks' | 'grade-schemes' | 'employment-grades';
export const kinds: Kind[] = [
  'staff-categories',
  'positions',
  'academic-ranks',
  'grade-schemes',
  'employment-grades',
];
export type Reference = {
  categoryId?: string;
  positionId?: string;
  rankId?: string;
  schemeId?: string;
  gradeId?: string;
  code?: string;
  nameAr?: string;
  nameEn?: string | null;
  description?: string | null;
  rankOrder?: number;
  gradeNumber?: number;
  stepNumber?: number | null;
  labelAr?: string | null;
  labelEn?: string | null;
  isAcademic?: number;
};
export const idKeys = {
  'staff-categories': 'categoryId',
  positions: 'positionId',
  'academic-ranks': 'rankId',
  'grade-schemes': 'schemeId',
  'employment-grades': 'gradeId',
} as const;
export const referenceId = (kind: Kind, row: Reference) => row[idKeys[kind]]!;
export function referenceName(row: Reference, language: Language) {
  return (
    (language === 'ar'
      ? row.nameAr || row.labelAr || row.nameEn || row.labelEn
      : row.nameEn || row.labelEn || row.nameAr || row.labelAr) ||
    row.code ||
    `${row.gradeNumber ?? ''}${row.stepNumber ? ` / ${row.stepNumber}` : ''}`
  );
}
export type Employment = {
  employmentRecordId: string;
  categoryId: string;
  positionId: string;
  academicRankId: string | null;
  gradeId: string | null;
  department: string | null;
  employmentRegime: string;
  employmentStatus: string;
  startDate: string;
  endDate: string | null;
  notes: string | null;
};
export const personalFields = [
  'employeeNumber',
  'firstNameAr',
  'middleNameAr',
  'lastNameAr',
  'firstNameEn',
  'middleNameEn',
  'lastNameEn',
  'birthDate',
  'nationality',
  'civilRegistryNumber',
  'phoneNumber',
  'mobileNumber',
  'email',
  'address',
  'emergencyContactName',
  'emergencyContactPhone',
  'notes',
] as const;
export type PersonalField = (typeof personalFields)[number];
export type Employee = Record<PersonalField, string | null> & {
  employeeId: string;
  employment: Employment | null;
};
export type EmployeeSummary = Pick<
  Employee,
  | 'employeeId'
  | 'employeeNumber'
  | 'firstNameAr'
  | 'middleNameAr'
  | 'lastNameAr'
  | 'firstNameEn'
  | 'middleNameEn'
  | 'lastNameEn'
> & {
  employment: Pick<
    Employment,
    'employmentRecordId' | 'categoryId' | 'positionId' | 'department' | 'employmentStatus'
  > | null;
};
export type EmployeePage = {
  records: EmployeeSummary[];
  page: number;
  pageSize: number;
  total: number;
};
export type Session = {
  user: {
    id: string;
    name: string;
    username?: string;
    approved: boolean;
    enabled: boolean;
    mustChangePassword: boolean;
  };
} | null;
export function employeeName(row: EmployeeSummary, language: Language) {
  const ar = [row.firstNameAr, row.middleNameAr, row.lastNameAr].filter(Boolean).join(' ');
  const en = [row.firstNameEn, row.middleNameEn, row.lastNameEn].filter(Boolean).join(' ');
  return language === 'ar' ? ar || en : en || ar;
}
