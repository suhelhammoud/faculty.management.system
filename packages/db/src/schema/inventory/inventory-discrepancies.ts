import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { user } from '../auth/users.js';
import { facilitiesRooms } from '../facilities/rooms.js';
import { inventoryConditions, inventoryCustodies } from './inventory-removal.js';

export const inventoryDiscrepancyCategories = ['assignment', 'room', 'condition'] as const;

export const inventoryDiscrepancies = pgTable(
  'inventory_discrepancies',
  {
    id: uuid().defaultRandom().primaryKey(),
    reporterId: text('reporter_id')
      .notNull()
      .references(() => user.id),
    custodyId: uuid('custody_id')
      .notNull()
      .references(() => inventoryCustodies.id),
    category: text({ enum: inventoryDiscrepancyCategories }).notNull(),
    details: text().notNull(),
    assetRevision: integer('asset_revision').notNull(),
    roomId: uuid('room_id').references(() => facilitiesRooms.roomId),
    condition: text({ enum: inventoryConditions }).notNull(),
    reportedAt: timestamp('reported_at', { withTimezone: true }).defaultNow().notNull(),
    reviewerId: text('reviewer_id').references(() => user.id),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    reviewNote: text('review_note'),
  },
  (t) => [
    check(
      'inventory_discrepancies_category_check',
      sql`${t.category} in ('assignment', 'room', 'condition')`,
    ),
    check(
      'inventory_discrepancies_review_check',
      sql`
      (${t.reviewerId} is null and ${t.reviewedAt} is null and ${t.reviewNote} is null)
      or
      (${t.reviewerId} is not null and ${t.reviewedAt} is not null and ${t.reviewNote} is not null)
    `,
    ),
    uniqueIndex('inventory_discrepancies_one_open_idx')
      .on(t.reporterId, t.custodyId, t.category)
      .where(sql`${t.reviewedAt} is null`),
    index('inventory_discrepancies_queue_idx').on(t.reportedAt, t.id),
  ],
);
