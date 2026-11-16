import { date, numeric, pgTable, primaryKey, smallint, text, uuid } from 'drizzle-orm/pg-core';
import { timestamps } from './common.js';
import { students } from './students.js';

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
    ...timestamps(),
  },
  (table) => [primaryKey({ columns: [table.studentId, table.academicYear] })],
);
