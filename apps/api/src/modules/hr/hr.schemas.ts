import { z } from 'zod';

const text = z.string().trim().min(1).max(1000);
const optionalText = text.nullable().optional();
export const uuid = z.uuid();
const date = z.iso.date();
export const employeeCreate = z.strictObject({
  employeeNumber: text,
  firstNameAr: text,
  middleNameAr: optionalText,
  lastNameAr: text,
  firstNameEn: optionalText,
  middleNameEn: optionalText,
  lastNameEn: optionalText,
  birthDate: date.nullable().optional(),
  nationality: optionalText,
  civilRegistryNumber: optionalText,
  phoneNumber: optionalText,
  mobileNumber: optionalText,
  email: z.string().trim().pipe(z.email()).nullable().optional(),
  address: optionalText,
  emergencyContactName: optionalText,
  emergencyContactPhone: optionalText,
  notes: z.string().trim().max(10000).nullable().optional(),
});
const nonempty = (value: object) => Object.keys(value).length > 0;
export const employeePatch = employeeCreate.partial().refine(nonempty, 'Supply at least one field');
export const employmentPut = z
  .strictObject({
    categoryId: uuid,
    positionId: uuid,
    academicRankId: uuid.nullable().optional(),
    gradeId: uuid.nullable().optional(),
    department: optionalText,
    employmentRegime: text,
    employmentStatus: text.optional(),
    startDate: date,
    endDate: date.nullable().optional(),
    notes: z.string().trim().max(10000).nullable().optional(),
  })
  .refine((v) => !v.endDate || v.endDate >= v.startDate, 'End date must be on or after start date');
const pageNumber = z
  .string()
  .regex(/^[1-9]\d*$/)
  .transform(Number)
  .pipe(z.number().int().safe());
export const employeeQuery = z.strictObject({
  search: z.string().trim().min(1).max(200).optional(),
  categoryId: uuid.optional(),
  positionId: uuid.optional(),
  employmentStatus: text.optional(),
  page: pageNumber.optional().default(1),
  pageSize: pageNumber.pipe(z.number().max(100)).optional().default(20),
});
const named = { code: text, nameAr: text, nameEn: optionalText };
export const referenceSchemas = {
  'staff-categories': z.strictObject({ ...named, description: optionalText }),
  positions: z.strictObject({
    ...named,
    categoryId: uuid,
    isAcademic: z.union([z.literal(0), z.literal(1)]).optional(),
  }),
  'academic-ranks': z.strictObject({ ...named, rankOrder: z.number().int().min(1).max(5) }),
  'grade-schemes': z.strictObject({ ...named, description: optionalText }),
  'employment-grades': z.strictObject({
    schemeId: uuid,
    gradeNumber: z.number().int().min(1).max(32767),
    stepNumber: z.number().int().min(1).max(32767).nullable().optional(),
    labelAr: optionalText,
    labelEn: optionalText,
  }),
};
export const referenceKind = z.enum([
  'staff-categories',
  'positions',
  'academic-ranks',
  'grade-schemes',
  'employment-grades',
]);
export type ReferenceKind = z.infer<typeof referenceKind>;
export type EmployeeCreate = z.infer<typeof employeeCreate>;
export type EmployeePatch = z.infer<typeof employeePatch>;
export type EmploymentPut = z.infer<typeof employmentPut>;
export type EmployeeQuery = z.infer<typeof employeeQuery>;
export const referenceQuery = z.strictObject({
  categoryId: uuid.optional(),
  schemeId: uuid.optional(),
});
export const referencePatchSchemas = {
  'staff-categories': referenceSchemas['staff-categories']
    .partial()
    .refine(nonempty, 'Supply at least one field'),
  positions: referenceSchemas['positions'].partial().refine(nonempty, 'Supply at least one field'),
  'academic-ranks': referenceSchemas['academic-ranks']
    .partial()
    .refine(nonempty, 'Supply at least one field'),
  'grade-schemes': referenceSchemas['grade-schemes']
    .partial()
    .refine(nonempty, 'Supply at least one field'),
  'employment-grades': referenceSchemas['employment-grades']
    .partial()
    .refine(nonempty, 'Supply at least one field'),
};
