export interface Department {
  id: string;
  code: string;
  name: string;
  active: boolean;
}

export interface CurriculumModule {
  studyYear: number;
  semester: number;
  code: string;
  name: string;
  nameAr: string | null;
  theoryHours: number;
  labHours: number;
  credits: number | null;
  theoryMarks: number | null;
  practicalMarks: number | null;
  totalMarks: number | null;
  progressMarks: number | null;
  requirement: 'required' | 'elective';
}

export interface CurriculumVersion {
  id: string;
  familyId: string;
  departmentId: string;
  name: string;
  version: number;
  revision: number;
  publishedAt: string | null;
}

export interface CurriculumPlanMetadata {
  description: string | null;
  adoptionDate: string | null;
  ministryDecision: string | null;
  remarks: string | null;
}

export interface CurriculumDetail extends CurriculumVersion, CurriculumPlanMetadata {
  modules: CurriculumModule[];
}

export interface AssignedCurriculum {
  id: string;
  name: string;
  version: number;
  departmentName: string;
}

export interface AssignmentStudent {
  studentId: string;
  academicId: string;
  firstName: string | null;
  fatherName: string | null;
  lastName: string | null;
  currentStudyYear: number | null;
  assignment: { id: string; name: string; version: number } | null;
}

export interface AssignmentPage {
  records: AssignmentStudent[];
  total: number;
}
