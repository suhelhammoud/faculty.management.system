import { z } from 'zod';

const text = z.string().trim().min(1).max(1000);
const optionalText = text.nullable().optional();
export const uuid = z.uuid();
const capacity = z.number().int().min(0).max(2147483647).nullable().optional();
const nonempty = (value: object) => Object.keys(value).length > 0;
const validCapacityPair = (value: {
  maximumStudentCapacity?: number | null;
  currentAvailableStudentCapacity?: number | null;
}) =>
  value.maximumStudentCapacity == null ||
  value.currentAvailableStudentCapacity == null ||
  value.currentAvailableStudentCapacity <= value.maximumStudentCapacity;
const roomFields = {
  buildingId: uuid,
  floorId: uuid,
  roomTypeId: uuid,
  roomCode: text,
  title: text,
  maximumStudentCapacity: capacity,
  currentAvailableStudentCapacity: capacity,
  status: text.optional(),
};

export const facilityKind = z.enum(['buildings', 'floors', 'room-types', 'rooms']);
export type FacilityKind = z.infer<typeof facilityKind>;

export const facilitySchemas = {
  buildings: z.strictObject({
    buildingCode: text,
    title: text,
    address: optionalText,
    status: text.optional(),
  }),
  floors: z.strictObject({
    buildingId: uuid,
    floorNumber: z.number().int().min(-100).max(1000),
    title: optionalText,
  }),
  'room-types': z.strictObject({ name: text, description: optionalText }),
  rooms: z
    .strictObject(roomFields)
    .refine(validCapacityPair, 'Available capacity cannot exceed maximum capacity'),
};

export const facilityPatchSchemas = {
  buildings: facilitySchemas.buildings.partial().refine(nonempty, 'Supply at least one field'),
  floors: facilitySchemas.floors.partial().refine(nonempty, 'Supply at least one field'),
  'room-types': facilitySchemas['room-types']
    .partial()
    .refine(nonempty, 'Supply at least one field'),
  rooms: z
    .strictObject(roomFields)
    .partial()
    .refine(nonempty, 'Supply at least one field')
    .refine(validCapacityPair, 'Available capacity cannot exceed maximum capacity'),
};
