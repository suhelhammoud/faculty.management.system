import { sql } from 'drizzle-orm';
import {
  check,
  date,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { user } from '../auth/users.js';

export const facultyPositions = pgTable('faculty_positions', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: text('code').notNull().unique(),
  titleEn: text('title_en').notNull(),
  titleAr: text('title_ar'),
  departmentCode: text('department_code'),
});

export const facultyPositionAppointments = pgTable(
  'faculty_position_appointments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    positionId: uuid('position_id')
      .notNull()
      .references(() => facultyPositions.id, { onDelete: 'restrict' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'restrict' }),
    appointmentDate: date('appointment_date', { mode: 'string' }).notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('faculty_position_one_current_holder')
      .on(table.positionId)
      .where(sql`${table.endedAt} is null`),
    index('faculty_position_appointment_history').on(table.positionId, table.startedAt),
    check('faculty_position_appointment_dates', sql`${table.endedAt} >= ${table.startedAt}`),
  ],
);
