import type { ReferenceSeed } from './types.js';

export const hrReferenceData = {
  staffCategories: [
    {
      code: 'TEACHING_FACULTY',
      nameAr: 'هيئة التدريس',
      nameEn: 'Teaching Faculty',
      description: 'Teaching faculty staff',
    },
    {
      code: 'LAB_TEACHING',
      nameAr: 'الكوادر التعليمية المخبرية',
      nameEn: 'Laboratory Teaching Staff',
      description: 'Laboratory teaching staff',
    },
    {
      code: 'TECHNICAL',
      nameAr: 'الكوادر الفنية',
      nameEn: 'Technical Staff',
      description: 'Technical staff',
    },
    {
      code: 'ADMIN_SUPPORT',
      nameAr: 'الكوادر الإدارية والداعمة',
      nameEn: 'Administrative and Support Staff',
      description: 'Administrative and support staff',
    },
  ],
  positions: [
    {
      categoryCode: 'TEACHING_FACULTY',
      code: 'DEMO_FACULTY_MEMBER',
      nameAr: 'عضو هيئة تدريس تجريبي',
      nameEn: 'Demo Faculty Member',
      isAcademic: 1,
    },
    {
      categoryCode: 'ADMIN_SUPPORT',
      code: 'DEMO_HR_COORDINATOR',
      nameAr: 'منسق موارد بشرية تجريبي',
      nameEn: 'Demo HR Coordinator',
      isAcademic: 0,
    },
  ],
  academicRanks: [
    {
      code: 'LECTURER',
      nameAr: 'مدرس',
      nameEn: 'Lecturer',
      rankOrder: 1,
    },
    {
      code: 'ASSISTANT_PROFESSOR',
      nameAr: 'أستاذ مساعد',
      nameEn: 'Assistant Professor',
      rankOrder: 2,
    },
    {
      code: 'PROFESSOR',
      nameAr: 'أستاذ',
      nameEn: 'Professor',
      rankOrder: 3,
    },
  ],
  gradeSchemes: [
    {
      code: 'DEMO_GENERAL',
      nameAr: 'سلم درجات تجريبي',
      nameEn: 'Demo General Grade Scheme',
      description: 'Synthetic example only; not an institutional pay scale.',
    },
  ],
  employmentGrades: [
    {
      schemeCode: 'DEMO_GENERAL',
      gradeNumber: 1,
      stepNumber: 1,
      labelAr: 'الدرجة التجريبية 1، المرحلة 1',
      labelEn: 'Demo Grade 1, Step 1',
    },
    {
      schemeCode: 'DEMO_GENERAL',
      gradeNumber: 1,
      stepNumber: 2,
      labelAr: 'الدرجة التجريبية 1، المرحلة 2',
      labelEn: 'Demo Grade 1, Step 2',
    },
  ],
} satisfies ReferenceSeed;
