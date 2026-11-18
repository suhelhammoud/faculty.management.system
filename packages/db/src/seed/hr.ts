import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { and, eq } from 'drizzle-orm';
import type { Database } from '../client.js';
import {
  hrAcademicRanks,
  hrEmploymentGrades,
  hrGradeSchemes,
  hrEmployees,
  hrEmploymentRecords,
  hrPositions,
  hrStaffCategories,
} from '../schema/hr/index.js';

type SeedExecutor = Pick<Database, 'select' | 'insert' | 'update'>;
type ReferenceSeed = {
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
type EmployeeSeed = {
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

async function readJson<T>(fixtureRoot: string, filename: string): Promise<T> {
  return JSON.parse(await readFile(resolve(fixtureRoot, filename), 'utf8')) as T;
}

export async function seedHr(
  tx: SeedExecutor,
  fixtureRoot: string,
  userIds: Map<string, string>,
): Promise<number> {
  const [references, employees] = await Promise.all([
    readJson<ReferenceSeed>(fixtureRoot, 'hr.reference-data.json'),
    readJson<EmployeeSeed[]>(fixtureRoot, 'hr.employees.json'),
  ]);

  const categoryCodes = new Set(references.staffCategories.map(({ code }) => code));
  const positionKeys = new Set(
    references.positions.map(({ categoryCode, code }) => `${categoryCode}:${code}`),
  );
  const rankCodes = new Set(references.academicRanks.map(({ code }) => code));
  const gradeSchemeCodes = new Set(references.gradeSchemes.map(({ code }) => code));
  for (const grade of references.employmentGrades) {
    if (!gradeSchemeCodes.has(grade.schemeCode)) {
      throw new Error(`Unknown grade scheme ${grade.schemeCode}`);
    }
    if (grade.gradeNumber < 1 || grade.stepNumber < 1) {
      throw new Error(`Grade and step numbers must be positive for ${grade.schemeCode}`);
    }
  }
  for (const employee of employees) {
    if (!userIds.has(employee.username)) {
      throw new Error(`Unknown username in employee ${employee.employeeNumber}`);
    }
    if (!categoryCodes.has(employee.categoryCode)) {
      throw new Error(`Unknown category code in employee ${employee.employeeNumber}`);
    }
    if (!positionKeys.has(`${employee.categoryCode}:${employee.positionCode}`)) {
      throw new Error(`Unknown position in employee ${employee.employeeNumber}`);
    }
    if (employee.academicRankCode && !rankCodes.has(employee.academicRankCode)) {
      throw new Error(`Unknown rank ${employee.academicRankCode}`);
    }
  }

  const categoryIds = new Map<string, string>();
  for (const category of references.staffCategories) {
    const [saved] = await tx
      .insert(hrStaffCategories)
      .values(category)
      .onConflictDoUpdate({
        target: hrStaffCategories.code,
        set: { nameAr: category.nameAr, nameEn: category.nameEn, updatedAt: new Date() },
      })
      .returning({ id: hrStaffCategories.categoryId });
    categoryIds.set(category.code, saved.id);
  }

  const positionIds = new Map<string, string>();
  for (const position of references.positions) {
    const categoryId = categoryIds.get(position.categoryCode);
    if (!categoryId) throw new Error(`Missing category ${position.categoryCode}`);
    const [saved] = await tx
      .insert(hrPositions)
      .values({
        categoryId,
        code: position.code,
        nameAr: position.nameAr,
        nameEn: position.nameEn,
        isAcademic: position.isAcademic,
      })
      .onConflictDoUpdate({
        target: [hrPositions.categoryId, hrPositions.code],
        set: {
          nameAr: position.nameAr,
          nameEn: position.nameEn,
          isAcademic: position.isAcademic,
          updatedAt: new Date(),
        },
      })
      .returning({ id: hrPositions.positionId });
    positionIds.set(`${position.categoryCode}:${position.code}`, saved.id);
  }

  const rankIds = new Map<string, string>();
  for (const rank of references.academicRanks) {
    const [saved] = await tx
      .insert(hrAcademicRanks)
      .values(rank)
      .onConflictDoUpdate({
        target: hrAcademicRanks.code,
        set: {
          nameAr: rank.nameAr,
          nameEn: rank.nameEn,
          rankOrder: rank.rankOrder,
          updatedAt: new Date(),
        },
      })
      .returning({ id: hrAcademicRanks.rankId });
    rankIds.set(rank.code, saved.id);
  }

  const gradeSchemeIds = new Map<string, string>();
  for (const scheme of references.gradeSchemes) {
    const [saved] = await tx
      .insert(hrGradeSchemes)
      .values(scheme)
      .onConflictDoUpdate({
        target: hrGradeSchemes.code,
        set: {
          nameAr: scheme.nameAr,
          nameEn: scheme.nameEn,
          description: scheme.description ?? null,
          updatedAt: new Date(),
        },
      })
      .returning({ id: hrGradeSchemes.schemeId });
    gradeSchemeIds.set(scheme.code, saved.id);
  }

  for (const grade of references.employmentGrades) {
    const schemeId = gradeSchemeIds.get(grade.schemeCode);
    if (!schemeId) throw new Error(`Missing grade scheme ${grade.schemeCode}`);
    await tx
      .insert(hrEmploymentGrades)
      .values({
        schemeId,
        gradeNumber: grade.gradeNumber,
        stepNumber: grade.stepNumber,
        labelAr: grade.labelAr,
        labelEn: grade.labelEn,
      })
      .onConflictDoUpdate({
        target: [
          hrEmploymentGrades.schemeId,
          hrEmploymentGrades.gradeNumber,
          hrEmploymentGrades.stepNumber,
        ],
        set: {
          labelAr: grade.labelAr,
          labelEn: grade.labelEn,
          updatedAt: new Date(),
        },
      });
  }

  for (const employee of employees) {
    const userId = userIds.get(employee.username);
    const categoryId = categoryIds.get(employee.categoryCode);
    const positionId = positionIds.get(`${employee.categoryCode}:${employee.positionCode}`);
    const academicRankId = employee.academicRankCode
      ? rankIds.get(employee.academicRankCode)
      : null;
    if (!userId || !categoryId || !positionId) {
      throw new Error(`Could not resolve references for employee ${employee.employeeNumber}`);
    }

    const [savedEmployee] = await tx
      .insert(hrEmployees)
      .values({
        employeeNumber: employee.employeeNumber,
        userId,
        firstNameAr: employee.firstNameAr,
        lastNameAr: employee.lastNameAr,
        firstNameEn: employee.firstNameEn,
        lastNameEn: employee.lastNameEn,
      })
      .onConflictDoUpdate({
        target: hrEmployees.employeeNumber,
        set: {
          userId,
          firstNameAr: employee.firstNameAr,
          lastNameAr: employee.lastNameAr,
          firstNameEn: employee.firstNameEn,
          lastNameEn: employee.lastNameEn,
          updatedAt: new Date(),
        },
      })
      .returning({ id: hrEmployees.employeeId });

    const [currentRecord] = await tx
      .select({ id: hrEmploymentRecords.employmentRecordId })
      .from(hrEmploymentRecords)
      .where(
        and(
          eq(hrEmploymentRecords.employeeId, savedEmployee.id),
          eq(hrEmploymentRecords.isCurrent, 1),
        ),
      )
      .limit(1);
    const employmentValues = {
      employeeId: savedEmployee.id,
      categoryId,
      positionId,
      academicRankId: academicRankId ?? null,
      department: employee.department,
      employmentRegime: employee.employmentRegime,
      employmentStatus: 'active',
      startDate: employee.startDate,
      isCurrent: 1,
    };
    if (currentRecord) {
      await tx
        .update(hrEmploymentRecords)
        .set({ ...employmentValues, updatedAt: new Date() })
        .where(eq(hrEmploymentRecords.employmentRecordId, currentRecord.id));
    } else {
      await tx.insert(hrEmploymentRecords).values(employmentValues);
    }
  }

  return employees.length;
}
