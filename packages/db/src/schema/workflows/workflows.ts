import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { user } from '../auth/users.js';

const timestampWithZone = (name: string) => timestamp(name, { withTimezone: true });

export const workflowInstances = pgTable(
  'workflow_instances',
  {
    id: uuid().defaultRandom().primaryKey(),
    definitionKey: text('definition_key').notNull(),
    definitionVersion: integer('definition_version').notNull(),
    subjectModule: text('subject_module').notNull(),
    subjectType: text('subject_type').notNull(),
    subjectId: text('subject_id').notNull(),
    startedBy: text('started_by')
      .notNull()
      .references(() => user.id),
    status: text({ enum: ['running', 'completed', 'rejected', 'cancelled'] }).notNull(),
    currentStep: text('current_step'),
    startedAt: timestampWithZone('started_at').defaultNow().notNull(),
    lastActivityAt: timestampWithZone('last_activity_at').defaultNow().notNull(),
    completedAt: timestampWithZone('completed_at'),
  },
  (table) => [
    index('workflow_instances_monitor_idx').on(table.status, table.currentStep),
    index('workflow_instances_subject_idx').on(
      table.subjectModule,
      table.subjectType,
      table.subjectId,
    ),
  ],
);

export const workflowTasks = pgTable(
  'workflow_tasks',
  {
    id: uuid().defaultRandom().primaryKey(),
    instanceId: uuid('instance_id')
      .notNull()
      .references(() => workflowInstances.id),
    step: text().notNull(),
    assignedUserId: text('assigned_user_id').references(() => user.id),
    status: text({ enum: ['pending', 'completed', 'cancelled'] }).notNull(),
    openedAt: timestampWithZone('opened_at').defaultNow().notNull(),
    completedAt: timestampWithZone('completed_at'),
  },
  (table) => [
    uniqueIndex('workflow_tasks_one_pending_idx')
      .on(table.instanceId)
      .where(sql`${table.status} = 'pending'`),
    index('workflow_tasks_instance_idx').on(table.instanceId, table.openedAt),
  ],
);

export type WorkflowResult = {
  instanceId: string;
  taskId: string | null;
  status: typeof workflowInstances.$inferSelect.status;
};

export const workflowEvents = pgTable(
  'workflow_events',
  {
    id: uuid().defaultRandom().primaryKey(),
    instanceId: uuid('instance_id')
      .notNull()
      .references(() => workflowInstances.id),
    taskId: uuid('task_id').references(() => workflowTasks.id),
    actorId: text('actor_id')
      .notNull()
      .references(() => user.id),
    action: text().notNull(),
    comment: text(),
    domainReference: text('domain_reference'),
    occurredAt: timestampWithZone('occurred_at').defaultNow().notNull(),
    idempotencyScope: text('idempotency_scope'),
    idempotencyKey: text('idempotency_key'),
    inputHash: text('input_hash'),
    result: jsonb().$type<WorkflowResult>(),
  },
  (table) => [
    index('workflow_events_history_idx').on(table.instanceId, table.occurredAt),
    uniqueIndex('workflow_events_idempotency_idx').on(
      table.actorId,
      table.idempotencyScope,
      table.idempotencyKey,
    ),
  ],
);
