import { personalFields, type Employee, type PersonalField, type Kind } from './types';
export type Values = Record<string, string>;
export const requiredPersonal: PersonalField[] = ['employeeNumber', 'firstNameAr', 'lastNameAr'];
export function personalValues(employee?: Employee): Values {
  return Object.fromEntries(personalFields.map((field) => [field, employee?.[field] ?? '']));
}
export function personalPayload(values: Values) {
  return Object.fromEntries(personalFields.map((key) => [key, values[key]?.trim() || null]));
}
export function validateValues(values: Values, required: string[]) {
  const errors: Record<string, string> = {};
  required.forEach((field) => {
    if (!values[field]?.trim()) errors[field] = 'Required field.';
  });
  Object.entries(values).forEach(([field, value]) => {
    if (value.length > (field === 'notes' ? 10000 : 1000))
      errors[field] = 'This value is too long.';
  });
  if (values.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim()))
    errors.email = 'Enter a valid email address.';
  for (const field of ['birthDate', 'startDate', 'endDate']) {
    const value = values[field];
    if (
      value &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(value) ||
        !Number.isFinite(Date.parse(value)) ||
        new Date(value).toISOString().slice(0, 10) !== value)
    )
      errors[field] = 'Enter a valid date.';
  }
  if (values.endDate && values.startDate && values.endDate < values.startDate)
    errors.endDate = 'End date must be on or after start date.';
  return errors;
}
export const referenceFields: Record<Kind, string[]> = {
  'staff-categories': ['code', 'nameAr', 'nameEn', 'description'],
  positions: ['categoryId', 'code', 'nameAr', 'nameEn', 'isAcademic'],
  'academic-ranks': ['code', 'nameAr', 'nameEn', 'rankOrder'],
  'grade-schemes': ['code', 'nameAr', 'nameEn', 'description'],
  'employment-grades': ['schemeId', 'gradeNumber', 'stepNumber', 'labelAr', 'labelEn'],
};
export const referenceRequired: Record<Kind, string[]> = {
  'staff-categories': ['code', 'nameAr'],
  positions: ['categoryId', 'code', 'nameAr'],
  'academic-ranks': ['code', 'nameAr', 'rankOrder'],
  'grade-schemes': ['code', 'nameAr'],
  'employment-grades': ['schemeId', 'gradeNumber'],
};
export function referencePayload(kind: Kind, values: Values) {
  return Object.fromEntries(
    referenceFields[kind].map((key) => [
      key,
      key === 'isAcademic'
        ? Number(values[key] || 0)
        : ['rankOrder', 'gradeNumber', 'stepNumber'].includes(key)
          ? values[key]
            ? Number(values[key])
            : null
          : values[key]?.trim() || null,
    ]),
  );
}
export function employeeFilters(params: URLSearchParams) {
  const rawPage = Number(params.get('page'));
  const page = Number.isSafeInteger(rawPage) && rawPage > 0 && rawPage <= 2147483647 ? rawPage : 1;
  const pageSize = [10, 20, 50, 100].includes(Number(params.get('pageSize')))
    ? Number(params.get('pageSize'))
    : 20;
  const result = new URLSearchParams({
    page: String(Math.floor(page)),
    pageSize: String(pageSize),
  });
  for (const field of ['search', 'categoryId', 'positionId', 'employmentStatus']) {
    const value = params.get(field)?.trim();
    if (value) result.set(field, value);
  }
  return result;
}

export function serverFieldErrors(
  error: unknown,
  fields: readonly string[],
): Record<string, string> {
  if (!error || typeof error !== 'object' || !('details' in error) || !Array.isArray(error.details))
    return {};
  const errors: Record<string, string> = {};
  for (const message of error.details) {
    if (typeof message !== 'string') continue;
    const field = fields.find((key) =>
      new RegExp(`(?:^|[\\s".])${key}(?:[:\\s".]|$)`).test(message),
    );
    if (field) errors[field] = 'Check the form values and try again.';
  }
  return errors;
}
