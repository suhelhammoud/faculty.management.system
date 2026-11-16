import { pgTable, smallint, text, unique, uuid } from 'drizzle-orm/pg-core';
import { timestamps } from './common.js';
import { hrStaffCategories } from './staff-categories.js';

export const hrPositions = pgTable(
  'hr_positions',
  {
    positionId: uuid('position_id').defaultRandom().primaryKey(),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => hrStaffCategories.categoryId, { onDelete: 'restrict' }),
    code: text('code').notNull(),
    nameAr: text('name_ar').notNull(),
    nameEn: text('name_en'),
    isAcademic: smallint('is_academic').default(0).notNull(),
    ...timestamps(),
  },
  (table) => [unique('hr_positions_category_code_unique').on(table.categoryId, table.code)],
);
