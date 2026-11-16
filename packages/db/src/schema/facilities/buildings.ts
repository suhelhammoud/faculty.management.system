import { pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { timestamps } from '../hr/common.js';

export const facilitiesBuildings = pgTable('facilities_buildings', {
  buildingId: uuid('building_id').defaultRandom().primaryKey(),
  buildingCode: text('building_code').notNull().unique(),
  title: text('title').notNull(),
  address: text('address'),
  status: text('status').notNull().default('active'),
  ...timestamps(),
});
