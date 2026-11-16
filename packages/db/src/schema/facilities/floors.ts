import { foreignKey, integer, pgTable, text, unique, uuid } from 'drizzle-orm/pg-core';
import { timestamps } from '../hr/common.js';
import { facilitiesBuildings } from './buildings.js';

export const facilitiesFloors = pgTable(
  'facilities_floors',
  {
    floorId: uuid('floor_id').defaultRandom().primaryKey(),
    buildingId: uuid('building_id')
      .notNull()
      .references(() => facilitiesBuildings.buildingId, { onDelete: 'restrict' }),
    floorNumber: integer('floor_number').notNull(),
    title: text('title'),
    ...timestamps(),
  },
  (table) => [
    unique('facilities_floors_building_number_unique').on(table.buildingId, table.floorNumber),
    unique('facilities_floors_id_building_unique').on(table.floorId, table.buildingId),
  ],
);
