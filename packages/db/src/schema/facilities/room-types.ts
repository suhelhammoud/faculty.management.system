import { pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { timestamps } from '../hr/common.js';

export const facilitiesRoomTypes = pgTable('facilities_room_types', {
  roomTypeId: uuid('room_type_id').defaultRandom().primaryKey(),
  name: text('name').notNull().unique(),
  description: text('description'),
  ...timestamps(),
});
