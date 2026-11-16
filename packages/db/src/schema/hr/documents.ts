import { sql } from 'drizzle-orm';
import { check, index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { user } from '../auth/users.js';
import { hrAdministrativeDecisions } from './administrative-decisions.js';
import { hrEmployeeCertificates } from './employee-certificates.js';
import { hrEmployees } from './employees.js';
import { hrEmploymentRecords } from './employment-records.js';

export const hrDocuments = pgTable(
  'hr_documents',
  {
    documentId: uuid('document_id').defaultRandom().primaryKey(),
    employeeId: uuid('employee_id').references(() => hrEmployees.employeeId, {
      onDelete: 'cascade',
    }),
    employmentRecordId: uuid('employment_record_id').references(
      () => hrEmploymentRecords.employmentRecordId,
      { onDelete: 'cascade' },
    ),
    certificateId: uuid('certificate_id').references(() => hrEmployeeCertificates.certificateId, {
      onDelete: 'cascade',
    }),
    decisionId: uuid('decision_id').references(() => hrAdministrativeDecisions.decisionId, {
      onDelete: 'cascade',
    }),
    storageKey: text('storage_key').notNull(),
    originalFileName: text('original_file_name').notNull(),
    mimeType: text('mime_type'),
    byteSize: integer('byte_size'),
    sha256: text('sha256'),
    description: text('description'),
    uploadedBy: text('uploaded_by').references(() => user.id, { onDelete: 'set null' }),
    uploadedAt: timestamp('uploaded_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('hr_documents_employee_idx').on(table.employeeId),
    check(
      'hr_documents_exactly_one_owner_check',
      sql`num_nonnulls(${table.employeeId}, ${table.employmentRecordId}, ${table.certificateId}, ${table.decisionId}) = 1`,
    ),
  ],
);
