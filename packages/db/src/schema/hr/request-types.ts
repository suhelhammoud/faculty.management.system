import { pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { timestamps } from './common.js';

export const hrRequestTypes = pgTable('hr_request_types', {
  requestTypeId: uuid('request_type_id').defaultRandom().primaryKey(),
  code: text('code').notNull().unique(),
  nameAr: text('name_ar').notNull(),
  nameEn: text('name_en'),
  description: text('description'),
  ...timestamps(),
});
