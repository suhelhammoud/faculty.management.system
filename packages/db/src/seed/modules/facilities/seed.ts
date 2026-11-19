import type { FacilitiesSeed } from '../../fixtures/local/types.js';
import { validateFacilities } from './validation.js';
import type { SeedTransaction } from '../../types.js';
import {
  facilitiesBuildings,
  facilitiesFloors,
  facilitiesRoomTypes,
  facilitiesRooms,
} from '../../../schema/facilities/index.js';

export async function seedFacilities(tx: SeedTransaction, seed: FacilitiesSeed): Promise<number> {
  validateFacilities(seed);

  const buildingIds = new Map<string, string>();
  for (const building of seed.buildings) {
    const [saved] = await tx
      .insert(facilitiesBuildings)
      .values({
        buildingCode: building.buildingCode,
        title: building.title,
        address: building.address ?? null,
        status: building.status ?? 'active',
      })
      .onConflictDoUpdate({
        target: facilitiesBuildings.buildingCode,
        set: {
          title: building.title,
          address: building.address ?? null,
          status: building.status ?? 'active',
          updatedAt: new Date(),
        },
      })
      .returning({ id: facilitiesBuildings.buildingId });
    buildingIds.set(building.buildingCode, saved.id);
  }

  const floorIds = new Map<string, string>();
  for (const floor of seed.floors) {
    const buildingId = buildingIds.get(floor.buildingCode);
    if (!buildingId) throw new Error(`Missing facility building ${floor.buildingCode}`);
    const [saved] = await tx
      .insert(facilitiesFloors)
      .values({ buildingId, floorNumber: floor.floorNumber, title: floor.title ?? null })
      .onConflictDoUpdate({
        target: [facilitiesFloors.buildingId, facilitiesFloors.floorNumber],
        set: { title: floor.title ?? null, updatedAt: new Date() },
      })
      .returning({ id: facilitiesFloors.floorId });
    floorIds.set(`${floor.buildingCode}:${floor.floorNumber}`, saved.id);
  }

  const roomTypeIds = new Map<string, string>();
  for (const roomType of seed.roomTypes) {
    const [saved] = await tx
      .insert(facilitiesRoomTypes)
      .values({ name: roomType.name, description: roomType.description ?? null })
      .onConflictDoUpdate({
        target: facilitiesRoomTypes.name,
        set: { description: roomType.description ?? null, updatedAt: new Date() },
      })
      .returning({ id: facilitiesRoomTypes.roomTypeId });
    roomTypeIds.set(roomType.name, saved.id);
  }

  for (const room of seed.rooms) {
    const buildingId = buildingIds.get(room.buildingCode);
    const floorId = floorIds.get(`${room.buildingCode}:${room.floorNumber}`);
    const roomTypeId = roomTypeIds.get(room.roomType);
    if (!buildingId || !floorId || !roomTypeId) {
      throw new Error(`Could not resolve facility references for ${room.roomCode}`);
    }
    await tx
      .insert(facilitiesRooms)
      .values({
        buildingId,
        floorId,
        roomTypeId,
        roomCode: room.roomCode,
        title: room.title,
        maximumStudentCapacity: room.maximumStudentCapacity ?? null,
        currentAvailableStudentCapacity: room.currentAvailableStudentCapacity ?? null,
        status: room.status ?? 'active',
      })
      .onConflictDoUpdate({
        target: [facilitiesRooms.buildingId, facilitiesRooms.roomCode],
        set: {
          floorId,
          roomTypeId,
          title: room.title,
          maximumStudentCapacity: room.maximumStudentCapacity ?? null,
          currentAvailableStudentCapacity: room.currentAvailableStudentCapacity ?? null,
          status: room.status ?? 'active',
          updatedAt: new Date(),
        },
      });
  }

  return seed.rooms.length;
}
