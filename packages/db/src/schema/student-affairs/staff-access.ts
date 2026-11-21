import { sql } from 'drizzle-orm';
import {
  check,
  index,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { user } from '../auth/users.js';

export const studentAffairsStaffYears = pgTable(
  'student_affairs_staff_years',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    studyYear: smallint('study_year').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.studyYear] }),
    check('student_affairs_staff_year_check', sql`${table.studyYear} between 1 and 5`),
  ],
);

export const studentAffairsPromotionGrants = pgTable(
  'student_affairs_promotion_grants',
  {
    id: uuid().defaultRandom().primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    issuedBy: text('issued_by').notNull(),
    issuedAt: timestamp('issued_at', { withTimezone: true }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedBy: text('revoked_by'),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (table) => [
    index('student_affairs_promotion_grants_recipient_idx').on(table.userId, table.expiresAt),
    check(
      'student_affairs_promotion_grant_time_check',
      sql`${table.expiresAt} > ${table.issuedAt}`,
    ),
  ],
);
