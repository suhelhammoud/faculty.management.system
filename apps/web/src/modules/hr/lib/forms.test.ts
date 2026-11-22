import { describe, expect, it } from 'vitest';
import { personalPayload, referencePayload, validateValues, employeeFilters } from './forms';
import { readLanguage } from './store';
describe('HR form boundaries', () => {
  it('uses English by default and restores only a valid saved language', () => {
    localStorage.clear();
    expect(readLanguage()).toBe('en');
    localStorage.setItem('faculty-hr-language', 'ar');
    expect(readLanguage()).toBe('ar');
    expect(localStorage.getItem('faculty-language')).toBe('ar');
    localStorage.removeItem('faculty-language');
    localStorage.setItem('faculty-hr-language', 'unknown');
    expect(readLanguage()).toBe('en');
  });
  it('clears nullable fields and converts grade numbers without submitting a zero for an empty step', () => {
    expect(
      personalPayload({ employeeNumber: ' EMP1 ', firstNameAr: 'سارة', lastNameAr: 'حسن' }),
    ).toMatchObject({ employeeNumber: 'EMP1', email: null });
    expect(
      referencePayload('employment-grades', {
        schemeId: 'scheme',
        gradeNumber: '2',
        stepNumber: '',
      }),
    ).toMatchObject({ gradeNumber: 2, stepNumber: null });
    expect(
      referencePayload('positions', {
        categoryId: 'category',
        code: 'A',
        nameAr: 'كاتب',
        isAcademic: '1',
      }),
    ).toMatchObject({ isAcademic: 1 });
  });
  it('validates required fields, real calendar dates, email and date ordering', () => {
    expect(
      validateValues({ startDate: '2026-02-30', endDate: '2026-01-01', email: 'bad' }, [
        'employeeNumber',
      ]),
    ).toMatchObject({
      employeeNumber: 'Required field.',
      startDate: 'Enter a valid date.',
      endDate: 'End date must be on or after start date.',
      email: 'Enter a valid email address.',
    });
  });
  it('normalizes pagination and ignores unknown URL parameters', () => {
    expect(
      employeeFilters(new URLSearchParams('page=-2&pageSize=999&search=Sara&unknown=x')).toString(),
    ).toBe('page=1&pageSize=20&search=Sara');
  });
});
