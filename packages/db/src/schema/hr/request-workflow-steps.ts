import { boolean, pgTable, smallint, text, unique, uuid } from 'drizzle-orm/pg-core';
import { roles } from '../auth/access-control.js';
import { timestamps } from './common.js';
import { hrRequestTypes } from './request-types.js';

export const hrRequestWorkflowSteps = pgTable(
  'hr_request_workflow_steps',
  {
    workflowStepId: uuid('workflow_step_id').defaultRandom().primaryKey(),
    requestTypeId: uuid('request_type_id')
      .notNull()
      .references(() => hrRequestTypes.requestTypeId, { onDelete: 'cascade' }),
    stepOrder: smallint('step_order').notNull(),
    name: text('name').notNull(),
    reviewerRoleId: text('reviewer_role_id').references(() => roles.id, { onDelete: 'set null' }),
    isRequired: boolean('is_required').default(true).notNull(),
    ...timestamps(),
  },
  (table) => [
    unique('hr_request_workflow_steps_type_order_unique').on(table.requestTypeId, table.stepOrder),
  ],
);
