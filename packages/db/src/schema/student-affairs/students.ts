import { sql } from 'drizzle-orm';
import {
  date,
  numeric,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { user } from '../auth/users.js';

export const students = pgTable(
  'students',
  {
    studentId: uuid('student_id').defaultRandom().primaryKey(),
    academicId: text('academic_id').notNull(),
    userId: text('user_id').references(() => user.id, { onDelete: 'set null' }),
    birthPlace: text('birth_place'),
    birthDate: date('birth_date', { mode: 'string' }),
    motherName: text('mother_name'),
    civilRegistryPlace: text('civil_registry_place'),
    civilRegistryNumber: text('civil_registry_number'),
    nationality: text('nationality'),
    governorate: text('governorate'),
    permanentAddress: text('permanent_address'),
    homsAddress: text('homs_address'),
    mobileNumber: text('mobile_number'),
    phoneNumber: text('phone_number'),
    email: text('email'),
    enrollmentDate: date('enrollment_date', { mode: 'string' }),
    secondaryCertificate: text('secondary_certificate'),
    certificateType: text('certificate_type'),
    certificateDate: date('certificate_date', { mode: 'string' }),
    gradeAverage: numeric('grade_average', { precision: 10, scale: 2 }),
    equivalencyDecision: text('equivalency_decision'),
    totalScore: numeric('total_score', { precision: 12, scale: 2 }),
    adjustedScore: numeric('adjusted_score', { precision: 12, scale: 2 }),
    language: text('language'),
    gender: text('gender'),
    examRegistrationNumber: text('exam_registration_number'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => sql`now()`),
  },
  (table) => [
    unique('students_academic_id_unique').on(table.academicId),
    unique('students_user_id_unique').on(table.userId),
  ],
);

export const studentAcademicYears = pgTable(
  'student_academic_years',
  {
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.studentId, { onDelete: 'cascade' }),
    year: smallint('year').notNull(),
    academicYear: text('academic_year').notNull(),
    firstTermFee: numeric('first_term_fee', { precision: 12, scale: 2 }),
    firstTermReceiptNumber: text('first_term_receipt_number'),
    firstTermReceiptDate: date('first_term_receipt_date', { mode: 'string' }),
    secondTermFee: numeric('second_term_fee', { precision: 12, scale: 2 }),
    secondTermReceiptNumber: text('second_term_receipt_number'),
    secondTermReceiptDate: date('second_term_receipt_date', { mode: 'string' }),
    certificateReceiptNumber: text('certificate_receipt_number'),
    certificateReceiptDate: date('certificate_receipt_date', { mode: 'string' }),
    firstTermResult: text('first_term_result'),
    secondTermResult: text('second_term_result'),
    remarks: text('remarks'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => sql`now()`),
  },
  (table) => [primaryKey({ columns: [table.studentId, table.academicYear] })],
);
