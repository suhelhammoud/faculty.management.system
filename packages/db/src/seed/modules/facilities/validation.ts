import type { FacilitiesSeed } from '../../fixtures/local/types.js';

export function validateFacilities(seed: FacilitiesSeed) {
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
