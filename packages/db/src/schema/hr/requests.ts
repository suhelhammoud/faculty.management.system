import { sql } from 'drizzle-orm';
import { date, index, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { user } from '../auth/users.js';
import { timestamps } from './common.js';
import { hrEmployees } from './employees.js';
import { hrRequestTypes } from './request-types.js';

export const hrRequests = pgTable(
  'hr_requests',
  {
    requestId: uuid('request_id').defaultRandom().primaryKey(),
    referenceNumber: text('reference_number').notNull(),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => hrEmployees.employeeId, { onDelete: 'cascade' }),
    requestTypeId: uuid('request_type_id')
      .notNull()
      .references(() => hrRequestTypes.requestTypeId, { onDelete: 'restrict' }),
    submittedBy: text('submitted_by').references(() => user.id, { onDelete: 'set null' }),
    status: text('status').default('submitted').notNull(),
    startDate: date('start_date', { mode: 'string' }),
    endDate: date('end_date', { mode: 'string' }),
    details: text('details'),
    submittedAt: timestamp('submitted_at', { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    ...timestamps(),
  },
  (table) => [
    unique('hr_requests_reference_number_unique').on(table.referenceNumber),
    index('hr_requests_employee_status_idx').on(table.employeeId, table.status),
    index('hr_requests_type_submitted_idx').on(table.requestTypeId, table.submittedAt),
  ],
);
