import { eq } from 'drizzle-orm';
import {
  studentAcademicYears,
  studentAffairsStaffYears,
  students,
} from '../../../schema/student-affairs/index.js';
import type { StudentAffairsSeed } from '../../fixtures/local/types.js';
import type { SeedTransaction } from '../../types.js';

export async function seedStudentAffairs(
  tx: SeedTransaction,
  fixtures: StudentAffairsSeed,
  userIds: ReadonlyMap<string, string>,
  existingStaff: ReadonlySet<string>,
) {
  for (const { username, years } of fixtures.assignments) {
    if (existingStaff.has(username)) continue;
    const userId = userIds.get(username);
    if (!userId) throw new Error(`Student Affairs seed staff account is missing for ${username}`);
    await tx
      .insert(studentAffairsStaffYears)
      .values(years.map((studyYear) => ({ userId, studyYear })))
      .onConflictDoNothing();
  }

  let annualRecordCount = 0;
  for (const { annual, ...student } of fixtures.students) {
    const [claimed] = await tx
      .select({ studentId: students.studentId })
      .from(students)
      .where(eq(students.academicId, student.academicId));
    if (claimed && claimed.studentId !== student.studentId)
      throw new Error(`Student Affairs seed academic ID collision for ${student.academicId}`);
    await tx.insert(students).values(student).onConflictDoNothing({ target: students.studentId });
    if (annual.length) {
      await tx
        .insert(studentAcademicYears)
        .values(annual.map((record) => ({ studentId: student.studentId, ...record })))
        .onConflictDoNothing();
    }
    annualRecordCount += annual.length;
  }
  return { studentCount: fixtures.students.length, annualRecordCount };
}
