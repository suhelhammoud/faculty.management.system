import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { user } from '../auth/users.js';
import { hrEmployees } from './employees.js';

export const hrAuditLog = pgTable(
  'hr_audit_log',
  {
    auditId: uuid('audit_id').defaultRandom().primaryKey(),
    employeeId: uuid('employee_id').references(() => hrEmployees.employeeId, {
      onDelete: 'set null',
    }),
    actorId: text('actor_id').references(() => user.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    previousValues: jsonb('previous_values'),
    newValues: jsonb('new_values'),
    reason: text('reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('hr_audit_log_employee_idx').on(table.employeeId, table.createdAt)],
);
