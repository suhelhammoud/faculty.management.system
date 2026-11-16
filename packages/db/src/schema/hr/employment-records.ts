import { sql } from 'drizzle-orm';
import {
  check,
  date,
  index,
  pgTable,
  smallint,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { timestamps } from './common.js';
import { hrAcademicRanks } from './academic-ranks.js';
import { hrEmployees } from './employees.js';
import { hrEmploymentGrades } from './employment-grades.js';
import { hrPositions } from './positions.js';
import { hrStaffCategories } from './staff-categories.js';

export const hrEmploymentRecords = pgTable(
  'hr_employment_records',
  {
    employmentRecordId: uuid('employment_record_id').defaultRandom().primaryKey(),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => hrEmployees.employeeId, { onDelete: 'cascade' }),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => hrStaffCategories.categoryId, { onDelete: 'restrict' }),
    positionId: uuid('position_id')
      .notNull()
      .references(() => hrPositions.positionId, { onDelete: 'restrict' }),
    academicRankId: uuid('academic_rank_id').references(() => hrAcademicRanks.rankId, {
      onDelete: 'restrict',
    }),
    gradeId: uuid('grade_id').references(() => hrEmploymentGrades.gradeId, {
      onDelete: 'restrict',
    }),
    department: text('department'),
    employmentRegime: text('employment_regime').notNull(),
    appointmentType: text('appointment_type'),
    employmentStatus: text('employment_status').default('active').notNull(),
    startDate: date('start_date', { mode: 'string' }).notNull(),
    endDate: date('end_date', { mode: 'string' }),
    decisionNumber: text('decision_number'),
    decisionDate: date('decision_date', { mode: 'string' }),
    isCurrent: smallint('is_current').default(1).notNull(),
    notes: text('notes'),
    ...timestamps(),
  },
  (table) => [
    index('hr_employment_records_employee_idx').on(table.employeeId, table.startDate),
    uniqueIndex('hr_employment_records_one_current_per_employee_idx')
      .on(table.employeeId)
      .where(sql`${table.isCurrent} = 1`),
    check('hr_employment_records_is_current_check', sql`${table.isCurrent} in (0, 1)`),
  ],
);
