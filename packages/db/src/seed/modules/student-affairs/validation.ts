import { studentAffairsDemoRoles } from '../../fixtures/local/student-affairs.js';
import type { AuthSeedUser, StudentAffairsSeed } from '../../fixtures/local/types.js';

function studyYear(year: number) {
  return Number.isInteger(year) && year >= 1 && year <= 5;
}

export function validateStudentAffairs(fixtures: StudentAffairsSeed, users: AuthSeedUser[]) {
  const [staffRole] = studentAffairsDemoRoles;
  const assigned = new Set<string>();
  for (const { username, years } of fixtures.assignments) {
    if (
      !users.some(
        (account) => account.username === username && account.roles?.includes(staffRole.id),
      )
    )
      throw new Error(`Unknown Student Affairs demo staff account ${username}`);
    if (
      assigned.has(username) ||
      !years.length ||
      new Set(years).size !== years.length ||
      !years.every(studyYear)
    )
      throw new Error(`Invalid or duplicate Student Affairs year assignment for ${username}`);
    assigned.add(username);
  }

  const studentIds = new Set<string>();
  const academicIds = new Set<string>();
  for (const student of fixtures.students) {
    const { studentId, academicId, firstName, fatherName, lastName, currentStudyYear, annual } =
      student;
    if (
      !/^DEMO-STA-\d+$/.test(academicId) ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(studentId) ||
      ![firstName, fatherName, lastName].every((name) => name.trim()) ||
      !studyYear(currentStudyYear) ||
      studentIds.has(studentId) ||
      academicIds.has(academicId)
    ) {
      throw new Error(`Invalid or duplicate Student Affairs student ${academicId}`);
    }
    studentIds.add(studentId);
    academicIds.add(academicId);
    const periods = new Set<string>();
    for (const { academicYear, year } of annual) {
      if (
        !/^[1-9]\d{3}-\d{4}$/.test(academicYear) ||
        Number(academicYear.slice(0, 4)) + 1 !== Number(academicYear.slice(5)) ||
        !studyYear(year) ||
        periods.has(academicYear)
      ) {
        throw new Error(`Invalid or duplicate Student Affairs academic period for ${academicId}`);
      }
      periods.add(academicYear);
    }
  }
}
