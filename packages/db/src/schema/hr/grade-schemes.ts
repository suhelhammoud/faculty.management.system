import { pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { timestamps } from './common.js';

export const hrGradeSchemes = pgTable('hr_grade_schemes', {
  schemeId: uuid('scheme_id').defaultRandom().primaryKey(),
  code: text('code').notNull().unique(),
  nameAr: text('name_ar').notNull(),
  nameEn: text('name_en'),
  description: text('description'),
  ...timestamps(),
});
