import { z } from 'zod';

export const id = z.uuid();
const name = z.string().trim().min(1).max(200);
const hours = z.number().int().min(0).max(80);
export const newDepartment = z.strictObject({
  code: z
    .string()
    .trim()
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name,
});
export const departmentUpdate = z.strictObject({ name, active: z.boolean() });
const module = z.strictObject({
  studyYear: z.number().int().min(1).max(5),
  semester: z.number().int().min(1).max(2),
  code: z.string().trim().min(1).max(80),
  name,
  theoryHours: hours,
  labHours: hours,
  credits: z.number().int().min(0).max(100),
  requirement: z.enum(['required', 'elective']),
});
const draft = z.strictObject({ name, modules: z.array(module).max(500) });
export const newPlan = draft.extend({ departmentId: id });
export const editDraft = draft.extend({ expectedRevision: z.number().int().positive() });
export const publication = z.strictObject({
  expectedRevision: z.number().int().positive(),
  allowEmptySemesters: z.boolean(),
});
export const assignment = z.strictObject({
  planId: id,
  studentIds: z
    .array(id)
    .min(1)
    .max(500)
    .refine((ids) => new Set(ids).size === ids.length),
});
export const candidateQuery = z.strictObject({
  page: z
    .string()
    .regex(/^[1-9]\d{0,5}$/)
    .transform(Number)
    .optional()
    .default(1),
  search: z.string().trim().max(200).optional(),
});
