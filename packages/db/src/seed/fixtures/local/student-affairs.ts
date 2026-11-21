import { PERMISSION, type DefaultRoleTemplate } from '@project/authorization';
import type { AuthSeedUser, StudentAffairsSeed } from './types.js';

const permissions = PERMISSION.studentAffairs;

export const studentAffairsDemoRoles = [
  {
    id: 'student-affairs-demo-staff',
    name: 'Demo Student Affairs Staff',
    description: 'Read student records and write within assigned study years.',
    permissions: [permissions.read],
  },
  {
    id: 'student-affairs-demo-admin',
    name: 'Demo Student Affairs Admin',
    description: 'Administer Student Affairs and use dean-issued promotion grants.',
    permissions: [permissions.read, permissions.administer],
  },
  {
    id: 'student-affairs-demo-dean',
    name: 'Demo Dean',
    description: 'Issue and revoke Student Affairs promotion grants.',
    permissions: [permissions.grantPromotions],
  },
] as const satisfies readonly DefaultRoleTemplate[];

const [staffRole, adminRole, deanRole] = studentAffairsDemoRoles;

export const studentAffairsDemoUsers = [
  { username: 'sta_admin', name: 'Demo Student Affairs Admin', roles: [adminRole.id] },
  { username: 'sta_dean', name: 'Demo Dean', roles: [deanRole.id] },
  { username: 'sta_staff_one', name: 'Demo Student Affairs Staff One', roles: [staffRole.id] },
  { username: 'sta_staff_two', name: 'Demo Student Affairs Staff Two', roles: [staffRole.id] },
  { username: 'sta_staff_three', name: 'Demo Student Affairs Staff Three', roles: [staffRole.id] },
] satisfies AuthSeedUser[];

export const localStudentAffairs = {
  assignments: [
    { username: 'sta_staff_one', years: [1, 2] },
    { username: 'sta_staff_two', years: [2, 3] },
    { username: 'sta_staff_three', years: [4, 5] },
  ],
  students: [
    {
      studentId: 'a4100000-0000-4000-8000-000000000001',
      academicId: 'DEMO-STA-001',
      firstName: 'ليلى',
      fatherName: 'خالد',
      lastName: 'أحمد',
      currentStudyYear: 1,
      annual: [{ academicYear: '2026-2027', year: 1 }],
    },
    {
      studentId: 'a4100000-0000-4000-8000-000000000002',
      academicId: 'DEMO-STA-002',
      firstName: 'عمر',
      fatherName: 'مروان',
      lastName: 'حسن',
      currentStudyYear: 2,
      annual: [
        { academicYear: '2025-2026', year: 1, remarks: 'Demo historical record' },
        { academicYear: '2026-2027', year: 2 },
      ],
    },
    {
      studentId: 'a4100000-0000-4000-8000-000000000003',
      academicId: 'DEMO-STA-003',
      firstName: 'مريم',
      fatherName: 'يوسف',
      lastName: 'علي',
      currentStudyYear: 3,
      annual: [{ academicYear: '2026-2027', year: 3 }],
    },
    {
      studentId: 'a4100000-0000-4000-8000-000000000004',
      academicId: 'DEMO-STA-004',
      firstName: 'سارة',
      fatherName: 'ماهر',
      lastName: 'محمود',
      currentStudyYear: 4,
      annual: [{ academicYear: '2026-2027', year: 4 }],
    },
    {
      studentId: 'a4100000-0000-4000-8000-000000000005',
      academicId: 'DEMO-STA-005',
      firstName: 'كريم',
      fatherName: 'رامي',
      lastName: 'إبراهيم',
      currentStudyYear: 5,
      annual: [{ academicYear: '2026-2027', year: 5 }],
    },
  ],
} satisfies StudentAffairsSeed;
