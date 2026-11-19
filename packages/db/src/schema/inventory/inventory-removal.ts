import { sql } from 'drizzle-orm';
import {
  check,
  date,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { user } from '../auth/users.js';
import { hrEmployees } from '../hr/employees.js';
import { facilitiesRooms } from '../facilities/rooms.js';
import { inventorySharedAccounts } from './inventory-parties.js';

export const inventoryConditions = [
  'serviceable',
  'malfunctioning',
  'under-repair',
  'lost',
  'unassessed',
] as const;

export const inventoryAssets = pgTable('inventory_assets', {
  id: uuid().defaultRandom().primaryKey(),
  tag: text().notNull().unique(),
  name: text().notNull(),
  status: text({ enum: ['active', 'decommissioned', 'disposed'] })
    .notNull()
    .default('active'),
  revision: integer().default(1).notNull(),
  condition: text({ enum: inventoryConditions }).notNull().default('unassessed'),
  category: text(),
  model: text(),
  serialNumber: text('serial_number'),
  acquisitionReference: text('acquisition_reference'),
  notes: text(),
  roomId: uuid('room_id').references(() => facilitiesRooms.roomId),
  createdAt: timestamp('created_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
});

export const inventoryCustodies = pgTable(
  'inventory_custodies',
  {
    id: uuid().defaultRandom().primaryKey(),
    assetId: uuid('asset_id')
      .notNull()
      .references(() => inventoryAssets.id),
    employeeId: uuid('employee_id').references(() => hrEmployees.employeeId),
    sharedAccountId: uuid('shared_account_id').references(() => inventorySharedAccounts.id),
    openedAt: timestamp('opened_at', { withTimezone: true }).defaultNow().notNull(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
  },
  (table) => [
    check(
      'inventory_custody_one_party',
      sql`(${table.employeeId} is null) <> (${table.sharedAccountId} is null)`,
    ),
    uniqueIndex('inventory_custodies_one_active_idx')
      .on(table.assetId)
      .where(sql`${table.endedAt} is null`),
  ],
);

export const inventoryRemovalRequests = pgTable('inventory_removal_requests', {
  id: uuid().defaultRandom().primaryKey(),
  requesterId: text('requester_id')
    .notNull()
    .references(() => user.id),
  currentRevision: integer('current_revision').notNull().default(1),
});

export const inventoryRemovalItems = pgTable(
  'inventory_removal_items',
  {
    requestId: uuid('request_id')
      .notNull()
      .references(() => inventoryRemovalRequests.id),
    revision: integer().notNull(),
    assetId: uuid('asset_id')
      .notNull()
      .references(() => inventoryAssets.id),
    assetRevision: integer('asset_revision').notNull(),
    custodyId: uuid('custody_id').references(() => inventoryCustodies.id),
    reason: text().notNull(),
    outcome: text({ enum: ['approved-for-waste', 'rejected', 'deferred'] }),
    decisionReason: text('decision_reason'),
  },
  (table) => [primaryKey({ columns: [table.requestId, table.revision, table.assetId] })],
);

export const inventoryRemovalDecisions = pgTable('inventory_removal_decisions', {
  id: uuid().defaultRandom().primaryKey(),
  requestId: uuid('request_id')
    .notNull()
    .unique()
    .references(() => inventoryRemovalRequests.id),
  revision: integer().notNull(),
  actorId: text('actor_id')
    .notNull()
    .references(() => user.id),
  name: text().notNull(),
  reference: text().notNull(),
  decidedOn: date('decided_on').notNull(),
  recordedAt: timestamp('recorded_at', { withTimezone: true }).defaultNow().notNull(),
});
