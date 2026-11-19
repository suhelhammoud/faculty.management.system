import type { EmployeeSeed, ReferenceSeed } from '../../fixtures/local/types.js';

function unique(values: (string | number)[], label: string): void {
  if (new Set(values).size !== values.length) throw new Error(`Duplicate ${label}`);
}

export function validateHr(
  references: ReferenceSeed,
  employees: EmployeeSeed[],
  usernames: Set<string>,
): void {
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
    if (!usernames.has(employee.username)) {
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

  unique(
    references.staffCategories.map((r) => r.code),
    'category code',
  );
  unique(
    references.positions.map((r) => `${r.categoryCode}:${r.code}`),
    'position',
  );
  unique(
    references.academicRanks.map((r) => r.code),
    'rank code',
  );
  unique(
    references.academicRanks.map((r) => r.rankOrder),
    'rank order',
  );
  unique(
    references.gradeSchemes.map((r) => r.code),
    'grade scheme',
  );
  unique(
    references.employmentGrades.map((r) => `${r.schemeCode}:${r.gradeNumber}:${r.stepNumber}`),
    'employment grade',
  );
  unique(
    employees.map((r) => r.employeeNumber),
    'employee number',
  );
  for (const employee of employees) {
    if (
      !employee.employeeNumber.trim() ||
      !employee.firstNameAr.trim() ||
      !employee.lastNameAr.trim()
    )
      throw new Error('Employees need a number and Arabic name');
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(employee.startDate) ||
      !Number.isFinite(Date.parse(employee.startDate)) ||
      new Date(employee.startDate).toISOString().slice(0, 10) !== employee.startDate
    )
      throw new Error(`Invalid start date for ${employee.employeeNumber}`);
  }
  for (const position of references.positions) {
    if (!categoryCodes.has(position.categoryCode))
      throw new Error(`Unknown category ${position.categoryCode}`);
    if (position.isAcademic !== 0 && position.isAcademic !== 1)
      throw new Error('Invalid academic flag');
  }
  for (const rank of references.academicRanks) {
    if (!Number.isInteger(rank.rankOrder) || rank.rankOrder < 1 || rank.rankOrder > 5)
      throw new Error('Rank order must be between 1 and 5');
  }
  for (const grade of references.employmentGrades) {
    if (!Number.isInteger(grade.gradeNumber) || !Number.isInteger(grade.stepNumber))
      throw new Error('Grade and step numbers must be integers');
  }
}
