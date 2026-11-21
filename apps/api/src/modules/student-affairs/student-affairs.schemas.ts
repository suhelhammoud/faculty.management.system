import { z } from 'zod';

const text = z.string().trim().min(1).max(1000);
const optionalText = text.nullable().optional();
const date = z.iso.date().nullable().optional();
const decimal = (digits: number) =>
  z
    .string()
    .regex(new RegExp(`^\\d{1,${digits}}(?:\\.\\d{1,2})?$`))
    .nullable()
    .optional();

export const uuid = z.uuid();
export const userId = z.string().trim().min(1).max(200);
export const studyYear = z.number().int().min(1).max(5);
export const studyYearParam = z.enum(['1', '2', '3', '4', '5']).transform(Number);
const pageNumber = z
  .string()
  .regex(/^[1-9]\d*$/)
  .transform(Number)
  .pipe(z.number().int());
const nonempty = (value: object) => Object.keys(value).length > 0;

export const studentQuery = z.strictObject({
  search: z.string().trim().min(1).max(200).optional(),
  studyYear: z.union([studyYearParam, z.literal('unassigned')]).optional(),
  page: pageNumber.pipe(z.number().max(1_000_000)).optional().default(1),
  pageSize: pageNumber.pipe(z.number().max(100)).optional().default(20),
});

const profile = z.strictObject({
  academicId: text,
  firstName: text,
  fatherName: text,
  lastName: text,
  birthPlace: optionalText,
  birthDate: date,
  motherName: optionalText,
  civilRegistryPlace: optionalText,
  civilRegistryNumber: optionalText,
  nationality: optionalText,
  governorate: optionalText,
  permanentAddress: optionalText,
  homsAddress: optionalText,
  mobileNumber: optionalText,
  phoneNumber: optionalText,
  email: z.string().trim().pipe(z.email()).nullable().optional(),
  enrollmentDate: date,
  secondaryCertificate: optionalText,
  certificateType: optionalText,
  certificateDate: date,
  gradeAverage: decimal(8),
  equivalencyDecision: optionalText,
  totalScore: decimal(10),
  language: optionalText,
  gender: optionalText,
  examRegistrationNumber: optionalText,
  notes: z.string().trim().max(10000).nullable().optional(),
});
export const studentCreate = profile.extend({ currentStudyYear: studyYear });
export const studentPatch = profile.partial().refine(nonempty, 'Supply at least one field');
export const currentYearPut = z.strictObject({ currentStudyYear: studyYear });

const annualFields = z.strictObject({
  year: studyYear,
  remarks: z.string().trim().max(10000).nullable().optional(),
});
const canonicalPeriod = z
  .string()
  .regex(/^[1-9]\d{3}-\d{4}$/)
  .refine(
    (value) => Number(value.slice(0, 4)) + 1 === Number(value.slice(5)),
    'Academic period must contain consecutive years',
  );
export const academicYearParam = z.string().min(1);
export const annualCreate = annualFields.extend({ academicYear: canonicalPeriod });
export const annualPatch = annualFields.partial().refine(nonempty, 'Supply at least one field');

export const promotionGrantCreate = z.strictObject({
  userId,
  expiresAt: z.iso.datetime({ offset: true }).transform((value) => new Date(value)),
});

export type StudentQuery = z.infer<typeof studentQuery>;
export type StudentCreate = z.infer<typeof studentCreate>;
export type StudentPatch = z.infer<typeof studentPatch>;
export type AnnualCreate = z.infer<typeof annualCreate>;
export type AnnualPatch = z.infer<typeof annualPatch>;
export type PromotionGrantCreate = z.infer<typeof promotionGrantCreate>;
