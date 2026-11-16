import { check, foreignKey, integer, pgTable, text, unique, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { timestamps } from '../hr/common.js';
import { facilitiesFloors } from './floors.js';
import { facilitiesRoomTypes } from './room-types.js';

export const facilitiesRooms = pgTable(
  'facilities_rooms',
  {
    roomId: uuid('room_id').defaultRandom().primaryKey(),
    buildingId: uuid('building_id').notNull(),
    floorId: uuid('floor_id').notNull(),
    roomTypeId: uuid('room_type_id')
      .notNull()
      .references(() => facilitiesRoomTypes.roomTypeId, { onDelete: 'restrict' }),
    roomCode: text('room_code').notNull(),
    title: text('title').notNull(),
    maximumStudentCapacity: integer('maximum_student_capacity'),
    currentAvailableStudentCapacity: integer('current_available_student_capacity'),
    status: text('status').notNull().default('active'),
    ...timestamps(),
  },
  (table) => [
    foreignKey({
      name: 'facilities_rooms_floor_building_fk',
      columns: [table.floorId, table.buildingId],
      foreignColumns: [facilitiesFloors.floorId, facilitiesFloors.buildingId],
    }).onDelete('restrict'),
    unique('facilities_rooms_building_code_unique').on(table.buildingId, table.roomCode),
    check(
      'facilities_rooms_capacity_nonnegative_check',
      sql`(${table.maximumStudentCapacity} is null or ${table.maximumStudentCapacity} >= 0)
        and (${table.currentAvailableStudentCapacity} is null or ${table.currentAvailableStudentCapacity} >= 0)`,
    ),
    check(
      'facilities_rooms_available_capacity_check',
      sql`${table.currentAvailableStudentCapacity} is null
        or ${table.maximumStudentCapacity} is null
        or ${table.currentAvailableStudentCapacity} <= ${table.maximumStudentCapacity}`,
    ),
  ],
);
