import { describe, expect, it } from 'vitest';
import {
  employeeCreate,
  employeePatch,
  employeeQuery,
  employmentPut,
  referencePatchSchemas,
} from './hr.schemas.js';

const profile = { employeeNumber: ' EMP-1 ', firstNameAr: ' سارة ', lastNameAr: ' حسن ' };

describe('HR input boundaries', () => {
  it('trims employee fields and permits optional personal details to be cleared', () => {
    expect(employeeCreate.parse(profile).employeeNumber).toBe('EMP-1');
    expect(employeePatch.parse({ phoneNumber: null })).toEqual({ phoneNumber: null });
  });

  it('rejects account linking, mass assignment and empty updates', () => {
    for (const field of ['userId', 'employeeId', 'createdAt']) {
      expect(employeeCreate.safeParse({ ...profile, [field]: 'injected' }).success).toBe(false);
    }
    expect(employeePatch.safeParse({}).success).toBe(false);
    expect(employeePatch.safeParse({ firstNameAr: ' ' }).success).toBe(false);
  });

  it('rejects invalid calendar dates, inverted ranges and internal employment flags', () => {
    const employment = {
      categoryId: '7c580676-46e1-41e6-80f2-d126fb3d68d7',
      positionId: '7c580676-46e1-41e6-80f2-d126fb3d68d7',
      employmentRegime: 'Faculty',
      startDate: '2026-02-28',
    };
    expect(employmentPut.safeParse({ ...employment, startDate: '2026-02-30' }).success).toBe(false);
    expect(employmentPut.safeParse({ ...employment, endDate: '2026-02-01' }).success).toBe(false);
    expect(employmentPut.safeParse({ ...employment, isCurrent: 0 }).success).toBe(false);
  });

  it('uses bounded pagination and validates filters', () => {
    expect(employeeQuery.parse({})).toEqual({ page: 1, pageSize: 20 });
    for (const query of [
      { page: '1.5' },
      { pageSize: '101' },
      { page: '0' },
      { categoryId: 'wrong' },
      { unknown: 'value' },
    ]) {
      expect(employeeQuery.safeParse(query).success).toBe(false);
    }
  });

  it('does not reset omitted reference fields during PATCH', () => {
    expect(referencePatchSchemas.positions.parse({ nameEn: 'Clerk' })).toEqual({ nameEn: 'Clerk' });
    expect(referencePatchSchemas.positions.safeParse({}).success).toBe(false);
    expect(referencePatchSchemas.positions.safeParse({ categoryId: null }).success).toBe(false);
    expect(
      referencePatchSchemas.positions.safeParse({ code: 'x', positionId: 'injected' }).success,
    ).toBe(false);
  });
});
