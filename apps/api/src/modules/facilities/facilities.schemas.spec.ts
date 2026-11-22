import { describe, expect, it } from 'vitest';
import { facilityPatchSchemas, facilitySchemas } from './facilities.schemas.js';

const room = {
  buildingId: '11111111-1111-4111-8111-111111111111',
  floorId: '22222222-2222-4222-8222-222222222222',
  roomTypeId: '33333333-3333-4333-8333-333333333333',
  roomCode: 'classroom_7',
  title: 'Classroom 7',
};

describe('Facilities room validation', () => {
  it('accepts a room with optional capacities omitted', () => {
    expect(facilitySchemas.rooms.parse(room)).toMatchObject(room);
  });

  it('rejects available capacity greater than maximum capacity', () => {
    expect(
      facilitySchemas.rooms.safeParse({
        ...room,
        maximumStudentCapacity: 30,
        currentAvailableStudentCapacity: 31,
      }).success,
    ).toBe(false);
  });

  it('allows partial edits but rejects empty or unknown fields', () => {
    expect(facilityPatchSchemas.rooms.parse({ title: 'Updated classroom' })).toEqual({
      title: 'Updated classroom',
    });
    expect(facilityPatchSchemas.rooms.safeParse({}).success).toBe(false);
    expect(facilityPatchSchemas.rooms.safeParse({ roomId: 'injected' }).success).toBe(false);
  });
});
