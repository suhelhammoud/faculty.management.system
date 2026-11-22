export interface FacultyPositionHolder {
  userId: string;
  name: string;
  username: string | null;
}

export interface FacultyPositionAppointment extends FacultyPositionHolder {
  id: string;
  appointmentDate: string;
  startedAt: string;
  endedAt: string | null;
}

export interface FacultyPosition {
  id: string;
  code: string;
  titleEn: string;
  titleAr: string | null;
  departmentCode: string | null;
  currentAppointment: FacultyPositionAppointment | null;
}

export interface FacultyPositionsResponse {
  positions: FacultyPosition[];
  canManage: boolean;
}

export interface FacultyPositionTitles {
  titleEn: string;
  titleAr?: string | null;
}

export interface CreateFacultyPosition extends FacultyPositionTitles {
  code: string;
  departmentCode?: string | null;
}

export interface UpdateFacultyPositionHolder {
  userId: string | null;
  expectedAppointmentId: string | null;
  appointmentDate?: string;
}
