import { DEFAULT_ROLE_TEMPLATES } from '@project/authorization';
import type {
  AuthSeedUser,
  AdministratorSeed,
  ReferenceSeed,
  EmployeeSeed,
  FacilitiesSeed,
} from './fixtures/local/types.js';

export function validatePassword(password: string): void {
  if (password.length < 12 || password.length > 128)
    throw new Error('SEED_USER_PASSWORD must be 12–128 characters');
}
function unique(values: (string | number)[], label: string): void {
  if (new Set(values).size !== values.length) throw new Error(`Duplicate ${label}`);
}
export function validateUsers(seedUsers: AuthSeedUser[]): void {
  const allowedRoleIds = new Set<string>(DEFAULT_ROLE_TEMPLATES.map(({ id }) => id));
  if (
    !seedUsers.length ||
    seedUsers.some(
      ({ username, name, roles: assignedRoles }) =>
        !/^[a-z0-9_]{3,30}$/.test(username) ||
        !name.trim() ||
        (assignedRoles ?? []).some((role) => !allowedRoleIds.has(role)),
    )
  ) {
    throw new Error('Auth fixtures need valid usernames, names, and recognized roles');
  }

  unique(
    seedUsers.map(({ username }) => username),
    'username',
  );
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

export function validateFacilities(seed: FacilitiesSeed) {
  const buildingCodes = new Set<string>();
  const floorKeys = new Set<string>();
  const roomTypeNames = new Set<string>();
  const roomKeys = new Set<string>();

  for (const building of seed.buildings) {
    if (!building.buildingCode.trim() || !building.title.trim()) {
      throw new Error('Facility buildings need a code and title');
    }
    if (buildingCodes.has(building.buildingCode)) {
      throw new Error(`Duplicate facility building ${building.buildingCode}`);
    }
    buildingCodes.add(building.buildingCode);
  }

  for (const floor of seed.floors) {
    const key = `${floor.buildingCode}:${floor.floorNumber}`;
    if (!buildingCodes.has(floor.buildingCode))
      throw new Error(`Unknown building ${floor.buildingCode}`);
    if (!Number.isInteger(floor.floorNumber)) throw new Error(`Invalid floor number ${key}`);
    if (floorKeys.has(key)) throw new Error(`Duplicate facility floor ${key}`);
    floorKeys.add(key);
  }

  for (const roomType of seed.roomTypes) {
    if (!roomType.name.trim()) throw new Error('Facility room types need a name');
    if (roomTypeNames.has(roomType.name)) throw new Error(`Duplicate room type ${roomType.name}`);
    roomTypeNames.add(roomType.name);
  }

  for (const room of seed.rooms) {
    const key = `${room.buildingCode}:${room.roomCode}`;
    if (!buildingCodes.has(room.buildingCode))
      throw new Error(`Unknown building ${room.buildingCode}`);
    if (!floorKeys.has(`${room.buildingCode}:${room.floorNumber}`)) {
      throw new Error(
        `Unknown floor ${room.buildingCode}:${room.floorNumber} for ${room.roomCode}`,
      );
    }
    if (!roomTypeNames.has(room.roomType)) throw new Error(`Unknown room type ${room.roomType}`);
    if (!room.roomCode.trim() || !room.title.trim()) {
      throw new Error(`Room ${key} needs a code and title`);
    }
    if (roomKeys.has(key)) throw new Error(`Duplicate room code ${key}`);
    roomKeys.add(key);

    const maximum = room.maximumStudentCapacity;
    const available = room.currentAvailableStudentCapacity;
    if (maximum != null && (!Number.isInteger(maximum) || maximum < 0)) {
      throw new Error(`Invalid maximum capacity for ${key}`);
    }
    if (available != null && (!Number.isInteger(available) || available < 0)) {
      throw new Error(`Invalid available capacity for ${key}`);
    }
    if (maximum != null && available != null && available > maximum) {
      throw new Error(`Available capacity exceeds maximum for ${key}`);
    }
  }
}

export type LocalSeedFixtures = {
  administrator: AdministratorSeed;
  users: AuthSeedUser[];
  references: ReferenceSeed;
  employees: EmployeeSeed[];
  facilities: FacilitiesSeed;
};
export function validateLocalFixtures(fixtures: LocalSeedFixtures, password: string): void {
  validatePassword(password);
  validateUsers(fixtures.users);
  const admin = fixtures.administrator;
  if (
    !/^[a-z0-9_]{3,30}$/.test(admin.username) ||
    !admin.id.trim() ||
    !admin.accountId.trim() ||
    !admin.name.trim() ||
    !admin.email.includes('@')
  )
    throw new Error('Invalid local administrator profile');
  if (
    fixtures.users.some(
      (u) =>
        u.username === admin.username ||
        `seed-${u.username}` === admin.id ||
        `seed-account-${u.username}` === admin.accountId ||
        `${u.username}@seed.invalid` === admin.email,
    )
  )
    throw new Error('Administrator conflicts with a demo user');
  validateHr(
    fixtures.references,
    fixtures.employees,
    new Set(fixtures.users.map((u) => u.username)),
  );
  validateFacilities(fixtures.facilities);
}
