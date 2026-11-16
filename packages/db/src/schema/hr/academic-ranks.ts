import { sql } from 'drizzle-orm';
import { check, index, pgTable, smallint, text, unique, uuid } from 'drizzle-orm/pg-core';
import { timestamps } from './common.js';

export const hrAcademicRanks = pgTable(
  'hr_academic_ranks',
  {
    rankId: uuid('rank_id').defaultRandom().primaryKey(),
    code: text('code').notNull().unique(),
    nameAr: text('name_ar').notNull(),
    nameEn: text('name_en'),
    rankOrder: smallint('rank_order').notNull(),
    ...timestamps(),
  },
  (table) => [
    unique('hr_academic_ranks_order_unique').on(table.rankOrder),
    index('hr_academic_ranks_order_idx').on(table.rankOrder),
    check('hr_academic_ranks_order_range_check', sql`${table.rankOrder} between 1 and 5`),
  ],
);
