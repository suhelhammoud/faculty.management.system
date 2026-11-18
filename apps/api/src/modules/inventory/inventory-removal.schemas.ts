import { z } from 'zod';

const label = z.string().trim().min(1).max(200);
const reason = z.string().trim().min(1).max(2000);
export const uuid = z.uuid().transform((value) => value.toLowerCase());
const items = <T extends { assetId: string }>(schema: z.ZodType<T>) =>
  z
    .array(schema)
    .min(1)
    .max(100)
    .refine(
      (entries) => new Set(entries.map(({ assetId }) => assetId)).size === entries.length,
      'Each asset must appear exactly once',
    );

export const proposal = z.strictObject({
  items: items(z.strictObject({ assetId: uuid, reason })),
});
export const committeeDecision = z.strictObject({
  name: label,
  reference: label,
  decidedOn: z.iso.date(),
  items: items(
    z.strictObject({
      assetId: uuid,
      outcome: z.enum(['approved-for-waste', 'rejected', 'deferred']),
      reason,
    }),
  ),
});
export const asset = z.strictObject({ tag: label, name: label, employeeId: uuid.optional() });
export const custody = z.strictObject({ employeeId: uuid.nullable() });
