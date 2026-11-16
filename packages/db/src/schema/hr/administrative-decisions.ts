import { date, index, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { timestamps } from './common.js';
import { hrEmployees } from './employees.js';

export const hrAdministrativeDecisions = pgTable(
  'hr_administrative_decisions',
  {
    decisionId: uuid('decision_id').defaultRandom().primaryKey(),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => hrEmployees.employeeId, { onDelete: 'cascade' }),
    decisionNumber: text('decision_number').notNull(),
    decisionType: text('decision_type').notNull(),
    decisionDate: date('decision_date', { mode: 'string' }).notNull(),
    summary: text('summary'),
    ...timestamps(),
  },
  (table) => [
    index('hr_administrative_decisions_employee_idx').on(table.employeeId, table.decisionDate),
  ],
);
