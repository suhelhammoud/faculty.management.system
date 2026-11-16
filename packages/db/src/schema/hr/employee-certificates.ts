import { date, index, pgTable, smallint, text, uuid } from 'drizzle-orm/pg-core';
import { timestamps } from './common.js';
import { hrEmployees } from './employees.js';

export const hrEmployeeCertificates = pgTable(
  'hr_employee_certificates',
  {
    certificateId: uuid('certificate_id').defaultRandom().primaryKey(),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => hrEmployees.employeeId, { onDelete: 'cascade' }),
    qualification: text('qualification').notNull(),
    fieldOfStudy: text('field_of_study'),
    institution: text('institution').notNull(),
    country: text('country'),
    awardDate: date('award_date', { mode: 'string' }),
    equivalencyDecision: text('equivalency_decision'),
    isAppointmentBasis: smallint('is_appointment_basis').default(0).notNull(),
    notes: text('notes'),
    ...timestamps(),
  },
  (table) => [index('hr_employee_certificates_employee_idx').on(table.employeeId)],
);
