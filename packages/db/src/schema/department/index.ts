import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  integer,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { timestamps } from '../student-affairs/common.js';
import { students } from '../student-affairs/students.js';

export const departments = pgTable('student_affairs_departments', {
  id: uuid().defaultRandom().primaryKey(),
  code: text().notNull().unique(),
  name: text().notNull(),
  active: boolean().notNull().default(true),
  ...timestamps(),
});

export const curriculumFamilies = pgTable(
  'curriculum_families',
  {
    id: uuid().defaultRandom().primaryKey(),
    departmentId: uuid('department_id')
      .notNull()
      .references(() => departments.id, { onDelete: 'restrict' }),
    name: text().notNull(),
  },
  (table) => [unique().on(table.departmentId, table.name)],
);

export const curriculumPlans = pgTable(
  'curriculum_plans',
  {
    id: uuid().defaultRandom().primaryKey(),
    familyId: uuid('family_id')
      .notNull()
      .references(() => curriculumFamilies.id, { onDelete: 'restrict' }),
    name: text().notNull(),
    version: integer().notNull(),
    description: text(),
    adoptionDate: date('adoption_date', { mode: 'string' }),
    ministryDecision: text('ministry_decision'),
    remarks: text(),
    revision: integer().notNull().default(1),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique().on(table.familyId, table.version),
    check('curriculum_plans_version_check', sql`${table.version} > 0`),
  ],
);

export const curriculumModules = pgTable(
  'curriculum_modules',
  {
    id: uuid().defaultRandom().primaryKey(),
    planId: uuid('plan_id')
      .notNull()
      .references(() => curriculumPlans.id, { onDelete: 'cascade' }),
    studyYear: smallint('study_year').notNull(),
    semester: smallint().notNull(),
    code: text().notNull(),
    name: text().notNull(),
    nameAr: text('name_ar'),
    theoryHours: smallint('theory_hours').notNull().default(0),
    labHours: smallint('lab_hours').notNull().default(0),
    credits: smallint(),
    theoryMarks: smallint('theory_marks'),
    practicalMarks: smallint('practical_marks'),
    totalMarks: smallint('total_marks'),
    progressMarks: smallint('progress_marks'),
    requirement: text().$type<'required' | 'elective'>().notNull().default('required'),
  },
  (table) => [
    index('curriculum_modules_plan_term_idx').on(table.planId, table.studyYear, table.semester),
    check('curriculum_module_year_check', sql`${table.studyYear} between 1 and 5`),
    check('curriculum_module_semester_check', sql`${table.semester} between 1 and 2`),
    check(
      'curriculum_module_hours_check',
      sql`${table.theoryHours} >= 0 and ${table.labHours} >= 0 and ${table.credits} >= 0`,
    ),
    check(
      'curriculum_module_marks_check',
      sql`${table.theoryMarks} between 0 and 100 and ${table.practicalMarks} between 0 and 100
        and ${table.totalMarks} between 0 and 100 and ${table.progressMarks} between 0 and 100`,
    ),
    check(
      'curriculum_module_requirement_check',
      sql`${table.requirement} in ('required', 'elective')`,
    ),
  ],
);

export const studentCurriculumAssignments = pgTable(
  'student_curriculum_assignments',
  {
    studentId: uuid('student_id')
      .primaryKey()
      .references(() => students.studentId, { onDelete: 'cascade' }),
    planId: uuid('plan_id')
      .notNull()
      .references(() => curriculumPlans.id, { onDelete: 'restrict' }),
    assignedBy: text('assigned_by'),
    assignedAt: timestamp('assigned_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('student_curriculum_assignments_plan_idx').on(table.planId)],
);
