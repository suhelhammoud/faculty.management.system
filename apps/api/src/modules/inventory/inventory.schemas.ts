import { inventoryConditions, inventoryTransactionTypes } from '@project/db/schema';
import { z } from 'zod';
import { uuid } from './inventory-removal.schemas.js';

export const label = z.string().trim().min(1).max(200);
const notes = z.string().trim().min(1).max(2000);
const quantity = z.number().int().min(1).max(2147483647);
const lines = <T extends z.ZodType>(item: T) => z.array(item).min(1).max(100);
const proposedAsset = { assetId: uuid, expectedRevision: z.number().int().positive() };
const asset = z.strictObject(proposedAsset);
export const assetFields = {
  tag: label,
  name: label,
  condition: z.enum(inventoryConditions).optional(),
  category: label.optional(),
  model: label.optional(),
  serialNumber: label.optional(),
  acquisitionReference: label.optional(),
  notes: notes.optional(),
};
const stock = { consumableId: uuid, quantity };
const recipient = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('employee'), id: uuid }),
  z.strictObject({ kind: z.literal('shared'), id: uuid }),
]);
const header = {
  name: label,
  reference: label.optional(),
  eventDate: z.iso.date(),
  notes: notes.optional(),
};
const assetLine = z.strictObject({ kind: z.literal('asset'), ...proposedAsset });
const stockLine = z.strictObject({ kind: z.literal('consumable'), ...stock });
const mixed = lines(z.discriminatedUnion('kind', [assetLine, stockLine]));
export const transactionInput = z.discriminatedUnion('type', [
  z.strictObject({
    ...header,
    type: z.literal('receipt'),
    reference: label,
    source: z.enum(['purchase', 'head-administration']),
    destinationRoomId: uuid,
    items: lines(
      z.discriminatedUnion('kind', [
        z.strictObject({ kind: z.literal('asset'), ...assetFields }),
        stockLine,
      ]),
    ),
  }),
  z.strictObject({
    ...header,
    type: z.literal('asset-issue'),
    sourceRoomId: uuid,
    recipient,
    destinationRoomId: uuid.nullable().optional(),
    items: lines(asset),
  }),
  z.strictObject({
    ...header,
    type: z.literal('asset-handover'),
    from: recipient,
    recipient,
    destinationRoomId: uuid.nullable().optional(),
    items: lines(asset),
  }),
  z.strictObject({
    ...header,
    type: z.literal('asset-return'),
    from: recipient,
    destinationRoomId: uuid,
    items: lines(asset),
  }),
  z.strictObject({
    ...header,
    type: z.literal('storage-relocation'),
    sourceRoomId: uuid,
    destinationRoomId: uuid,
    items: mixed,
  }),
  z.strictObject({
    ...header,
    type: z.literal('consumable-issue'),
    sourceRoomId: uuid,
    employeeId: uuid,
    items: lines(z.strictObject(stock)),
  }),
  z.strictObject({
    ...header,
    type: z.literal('consumable-adjustment'),
    roomId: uuid,
    items: lines(
      z.strictObject({
        consumableId: uuid,
        delta: z
          .number()
          .int()
          .min(-2147483647)
          .max(2147483647)
          .refine((n) => n !== 0),
        reason: notes,
      }),
    ),
  }),
  z.strictObject({
    ...header,
    type: z.literal('condition-change'),
    items: lines(
      z.strictObject({ ...proposedAsset, condition: z.enum(inventoryConditions), reason: notes }),
    ),
  }),
  z.strictObject({ ...header, type: z.literal('disposal'), reference: label, items: lines(asset) }),
]);
export type TransactionInput = z.infer<typeof transactionInput>;
export type Party = z.infer<typeof recipient>;

const offset = z.coerce.number().int().min(0).max(2147483647).default(0);
const limit = z.coerce.number().int().min(1).max(100).default(50);
const page = { offset, limit };
export const myItemsQuery = z.strictObject(page);
export const referenceQuery = z.strictObject({ ...page, q: label.optional() });
export const assetQuery = z.strictObject({
  ...page,
  q: label.optional(),
  status: z.enum(['active', 'decommissioned', 'disposed']).optional(),
  condition: z.enum(inventoryConditions).optional(),
  roomId: uuid.optional(),
  employeeId: uuid.optional(),
  sharedAccountId: uuid.optional(),
  category: label.optional(),
});
export const stockQuery = z.strictObject({
  ...page,
  q: label.optional(),
  roomId: uuid.optional(),
  consumableId: uuid.optional(),
});
export const historyQuery = z
  .strictObject({
    ...page,
    type: z.enum(inventoryTransactionTypes).optional(),
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
    actorId: label.optional(),
    assetId: uuid.optional(),
    consumableId: uuid.optional(),
    reference: label.optional(),
  })
  .refine(({ from, to }) => !from || !to || from <= to, 'Invalid date range');
export const storageInput = z.strictObject({
  sharedAccountId: uuid,
  enabled: z.boolean().default(true),
});
export const sharedInput = z.strictObject({ name: label });
export const consumableInput = z.strictObject({ code: label, name: label, unit: label });
export { uuid };
