import type { AssignedCurriculum } from './department.js';

export interface StudentAffairsCapabilities {
  read: boolean;
  administer: boolean;
  grantPromotions: boolean;
  assignedStudyYears: number[];
}

export interface PromotionGrantRecipient {
  userId: string;
  name: string;
}

export interface StaffYearAssignments extends PromotionGrantRecipient {
  years: number[];
}

export interface PromotionGrant {
  id: string;
  userId: string;
  issuedBy: string;
  issuedAt: string;
  expiresAt: string;
  revokedBy: string | null;
  revokedAt: string | null;
}

export interface StudentSummary {
  studentId: string;
  academicId: string;
  firstName: string | null;
  fatherName: string | null;
  lastName: string | null;
  currentStudyYear: number | null;
}

export interface StudentProfileFields {
  birthPlace: string | null;
  birthDate: string | null;
  motherName: string | null;
  civilRegistryPlace: string | null;
  civilRegistryNumber: string | null;
  nationality: string | null;
  governorate: string | null;
  permanentAddress: string | null;
  homsAddress: string | null;
  mobileNumber: string | null;
  phoneNumber: string | null;
  email: string | null;
  enrollmentDate: string | null;
  secondaryCertificate: string | null;
  certificateType: string | null;
  certificateDate: string | null;
  gradeAverage: string | null;
  equivalencyDecision: string | null;
  totalScore: string | null;
  language: string | null;
  gender: string | null;
  examRegistrationNumber: string | null;
  notes: string | null;
}

export interface StudentProfile extends StudentSummary, StudentProfileFields {
  departmentId?: string | null;
  departmentName?: string | null;
  curriculum?: AssignedCurriculum | null;
  revision: number;
  adjustedScore: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StudentYearChange {
  currentStudyYear: number;
  expectedRevision: number;
}

export interface StudentList {
  records: StudentSummary[];
  page: number;
  pageSize: number;
  total: number;
}

export interface StudentAnnualRecord {
  studentId: string;
  year: number;
  academicYear: string;
  remarks: string | null;
  createdAt: string;
  updatedAt: string;
}
