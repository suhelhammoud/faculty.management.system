import { pgTable, smallint, text, unique, uuid } from 'drizzle-orm/pg-core';
import { timestamps } from './common.js';
import { hrGradeSchemes } from './grade-schemes.js';

export const hrEmploymentGrades = pgTable(
  'hr_employment_grades',
  {
    gradeId: uuid('grade_id').defaultRandom().primaryKey(),
    schemeId: uuid('scheme_id')
      .notNull()
      .references(() => hrGradeSchemes.schemeId, { onDelete: 'restrict' }),
    gradeNumber: smallint('grade_number').notNull(),
    stepNumber: smallint('step_number'),
    labelAr: text('label_ar'),
    labelEn: text('label_en'),
    ...timestamps(),
  },
  (table) => [
    unique('hr_employment_grades_scheme_grade_step_unique').on(
      table.schemeId,
      table.gradeNumber,
      table.stepNumber,
    ),
  ],
);
