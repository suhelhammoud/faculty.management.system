import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Database } from '../client.js';
import {
  facilitiesBuildings,
  facilitiesFloors,
  facilitiesRoomTypes,
  facilitiesRooms,
} from '../schema/facilities/index.js';

type SeedExecutor = Pick<Database, 'select' | 'insert'>;
type FacilitiesSeed = {
  buildings: { buildingCode: string; title: string; address?: string; status?: string }[];
  floors: { buildingCode: string; floorNumber: number; title?: string }[];
  roomTypes: { name: string; description?: string }[];
  rooms: {
    buildingCode: string;
    floorNumber: number;
    roomType: string;
    roomCode: string;
    title: string;
    maximumStudentCapacity?: number | null;
    currentAvailableStudentCapacity?: number | null;
    status?: string;
  }[];
};

async function readFacilities(fixtureRoot: string): Promise<FacilitiesSeed> {
  return JSON.parse(
    await readFile(resolve(fixtureRoot, 'facilities.json'), 'utf8'),
  ) as FacilitiesSeed;
}

function assertFacilities(seed: FacilitiesSeed) {
  const buildingCodes = new Set<string>();
  const floorKeys = new Set<string>();
  const roomTypeNames = new Set<string>();
  const roomKeys = new Set<string>();

  for (const building of seed.buildings) {
    if (!building.buildingCode.trim() || !building.title.trim()) {
      throw new Error('Facility buildings need a code and title');
    }
    if (buildingCodes.has(building.buildingCode)) {
      throw new Error(`Duplicate facility building ${building.buildingCode}`);
    }
    buildingCodes.add(building.buildingCode);
  }

  for (const floor of seed.floors) {
    const key = `${floor.buildingCode}:${floor.floorNumber}`;
    if (!buildingCodes.has(floor.buildingCode))
      throw new Error(`Unknown building ${floor.buildingCode}`);
    if (!Number.isInteger(floor.floorNumber)) throw new Error(`Invalid floor number ${key}`);
    if (floorKeys.has(key)) throw new Error(`Duplicate facility floor ${key}`);
    floorKeys.add(key);
  }

  for (const roomType of seed.roomTypes) {
    if (!roomType.name.trim()) throw new Error('Facility room types need a name');
    if (roomTypeNames.has(roomType.name)) throw new Error(`Duplicate room type ${roomType.name}`);
    roomTypeNames.add(roomType.name);
  }

  for (const room of seed.rooms) {
    const key = `${room.buildingCode}:${room.roomCode}`;
    if (!buildingCodes.has(room.buildingCode))
      throw new Error(`Unknown building ${room.buildingCode}`);
    if (!floorKeys.has(`${room.buildingCode}:${room.floorNumber}`)) {
      throw new Error(
        `Unknown floor ${room.buildingCode}:${room.floorNumber} for ${room.roomCode}`,
      );
    }
    if (!roomTypeNames.has(room.roomType)) throw new Error(`Unknown room type ${room.roomType}`);
    if (!room.roomCode.trim() || !room.title.trim()) {
      throw new Error(`Room ${key} needs a code and title`);
    }
    if (roomKeys.has(key)) throw new Error(`Duplicate room code ${key}`);
    roomKeys.add(key);

    const maximum = room.maximumStudentCapacity;
    const available = room.currentAvailableStudentCapacity;
    if (maximum != null && (!Number.isInteger(maximum) || maximum < 0)) {
      throw new Error(`Invalid maximum capacity for ${key}`);
    }
    if (available != null && (!Number.isInteger(available) || available < 0)) {
      throw new Error(`Invalid available capacity for ${key}`);
    }
    if (maximum != null && available != null && available > maximum) {
      throw new Error(`Available capacity exceeds maximum for ${key}`);
    }
  }
}

export async function seedFacilities(tx: SeedExecutor, fixtureRoot: string): Promise<number> {
  const seed = await readFacilities(fixtureRoot);
  assertFacilities(seed);

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
