import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import type { Database } from '@project/db';
import {
  facilitiesBuildings,
  facilitiesFloors,
  facilitiesRoomTypes,
  facilitiesRooms,
} from '@project/db/schema';
import { DATABASE } from '../../database/database.constants.js';
import { handleDatabaseErrors } from '../hr/hr.database-errors.js';
import { facilityPatchSchemas, facilitySchemas, type FacilityKind } from './facilities.schemas.js';

const definitions = {
  buildings: { table: facilitiesBuildings, id: facilitiesBuildings.buildingId },
  floors: { table: facilitiesFloors, id: facilitiesFloors.floorId },
  'room-types': { table: facilitiesRoomTypes, id: facilitiesRoomTypes.roomTypeId },
  rooms: { table: facilitiesRooms, id: facilitiesRooms.roomId },
};

@Injectable()
export class FacilitiesService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async list() {
    const [buildings, floors, roomTypes, rooms] = await Promise.all([
      this.db.select().from(facilitiesBuildings).orderBy(asc(facilitiesBuildings.buildingCode)),
      this.db
        .select()
        .from(facilitiesFloors)
        .orderBy(asc(facilitiesFloors.buildingId), asc(facilitiesFloors.floorNumber)),
      this.db.select().from(facilitiesRoomTypes).orderBy(asc(facilitiesRoomTypes.name)),
      this.db
        .select()
        .from(facilitiesRooms)
        .orderBy(asc(facilitiesRooms.roomCode), asc(facilitiesRooms.roomId)),
    ]);
    return { buildings, floors, roomTypes, rooms };
  }

  async write(
    kind: FacilityKind,
    id: string | undefined,
    input: unknown,
    claim?: () => Promise<void>,
  ) {
    const schema = id ? facilityPatchSchemas[kind] : facilitySchemas[kind];
    const parsed = schema.safeParse(input);
    if (!parsed.success) {
      throw new BadRequestException(
        parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
      );
    }

    await claim?.();
    return handleDatabaseErrors(() =>
      this.db.transaction(async (tx) => {
        const definition = definitions[kind];
        if (id) {
          const [existing] = await tx
            .select()
            .from(definition.table)
            .where(eq(definition.id, id))
            .limit(1);
          if (!existing) throw new NotFoundException('Facility record not found');
        }

        switch (kind) {
          case 'buildings':
            return id
              ? (
                  await tx
                    .update(facilitiesBuildings)
                    .set({
                      ...(parsed.data as Partial<typeof facilitiesBuildings.$inferInsert>),
                      updatedAt: new Date(),
                    })
                    .where(eq(facilitiesBuildings.buildingId, id))
                    .returning()
                )[0]
              : (
                  await tx
                    .insert(facilitiesBuildings)
                    .values(parsed.data as typeof facilitiesBuildings.$inferInsert)
                    .returning()
                )[0];
          case 'floors':
            return id
              ? (
                  await tx
                    .update(facilitiesFloors)
                    .set({
                      ...(parsed.data as Partial<typeof facilitiesFloors.$inferInsert>),
                      updatedAt: new Date(),
                    })
                    .where(eq(facilitiesFloors.floorId, id))
                    .returning()
                )[0]
              : (
                  await tx
                    .insert(facilitiesFloors)
                    .values(parsed.data as typeof facilitiesFloors.$inferInsert)
                    .returning()
                )[0];
          case 'room-types':
            return id
              ? (
                  await tx
                    .update(facilitiesRoomTypes)
                    .set({
                      ...(parsed.data as Partial<typeof facilitiesRoomTypes.$inferInsert>),
                      updatedAt: new Date(),
                    })
                    .where(eq(facilitiesRoomTypes.roomTypeId, id))
                    .returning()
                )[0]
              : (
                  await tx
                    .insert(facilitiesRoomTypes)
                    .values(parsed.data as typeof facilitiesRoomTypes.$inferInsert)
                    .returning()
                )[0];
          case 'rooms':
            return id
              ? (
                  await tx
                    .update(facilitiesRooms)
                    .set({
                      ...(parsed.data as Partial<typeof facilitiesRooms.$inferInsert>),
                      updatedAt: new Date(),
                    })
                    .where(eq(facilitiesRooms.roomId, id))
                    .returning()
                )[0]
              : (
                  await tx
                    .insert(facilitiesRooms)
                    .values(parsed.data as typeof facilitiesRooms.$inferInsert)
                    .returning()
                )[0];
        }
      }),
    );
  }
}
