import { sql } from 'drizzle-orm';
import {
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { user } from '../auth/users.js';
import { facilitiesRooms } from '../facilities/rooms.js';
import { hrEmployees } from '../hr/employees.js';
import { inventoryAssets, inventoryRemovalDecisions } from './inventory-removal.js';

import { inventorySharedAccounts } from './inventory-parties.js';

export const inventoryStorage = pgTable(
  'inventory_storage',
  {
    roomId: uuid('room_id')
      .primaryKey()
      .references(() => facilitiesRooms.roomId),
    sharedAccountId: uuid('shared_account_id')
      .notNull()
      .references(() => inventorySharedAccounts.id),
    enabled: integer().notNull().default(1),
  },
  (t) => [check('inventory_storage_enabled_check', sql`${t.enabled} in (0, 1)`)],
);

export const inventoryConsumables = pgTable('inventory_consumables', {
  id: uuid().defaultRandom().primaryKey(),
  code: text().notNull().unique(),
  name: text().notNull(),
  unit: text().notNull(),
});

export const inventoryBalances = pgTable(
  'inventory_balances',
  {
    consumableId: uuid('consumable_id')
      .notNull()
      .references(() => inventoryConsumables.id),
    roomId: uuid('room_id')
      .notNull()
      .references(() => inventoryStorage.roomId),
    quantity: integer().notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.consumableId, t.roomId] }),
    check('inventory_balance_nonnegative', sql`${t.quantity} >= 0`),
  ],
);

export const inventoryTransactionTypes = [
  'receipt',
  'asset-issue',
  'asset-handover',
  'asset-return',
  'storage-relocation',
  'consumable-issue',
  'consumable-adjustment',
  'condition-change',
  'disposal',
  'committee-decision',
  'asset-registration',
  'custody-change',
] as const;

export const inventoryTransactions = pgTable(
  'inventory_transactions',
  {
    id: uuid().defaultRandom().primaryKey(),
    type: text({ enum: inventoryTransactionTypes }).notNull(),
    name: text().notNull(),
    reference: text(),
    eventDate: date('event_date').notNull(),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).defaultNow().notNull(),
    actorId: text('actor_id')
      .notNull()
      .references(() => user.id),
    source: text({ enum: ['purchase', 'head-administration'] }),
    sourceRoomId: uuid('source_room_id').references(() => facilitiesRooms.roomId),
    destinationRoomId: uuid('destination_room_id').references(() => facilitiesRooms.roomId),
    recipientEmployeeId: uuid('recipient_employee_id').references(() => hrEmployees.employeeId),
    notes: text(),
    decisionId: uuid('decision_id')
      .unique()
      .references(() => inventoryRemovalDecisions.id),
    idempotencyKey: text('idempotency_key'),
    inputHash: text('input_hash'),
  },
  (t) => [
    unique('inventory_transaction_actor_key_unique').on(t.actorId, t.idempotencyKey),
    index('inventory_transaction_history_idx').on(t.eventDate, t.id),
  ],
);

export type InventoryAssetSnapshot = {
  status: string;
  condition: string;
  roomId: string | null;
  employeeId: string | null;
  sharedAccountId: string | null;
  revision: number;
};

export const inventoryTransactionLines = pgTable(
  'inventory_transaction_lines',
  {
    transactionId: uuid('transaction_id')
      .notNull()
      .references(() => inventoryTransactions.id),
    line: integer().notNull(),
    assetId: uuid('asset_id').references(() => inventoryAssets.id),
    consumableId: uuid('consumable_id').references(() => inventoryConsumables.id),
    quantity: integer(),
    before: jsonb().$type<InventoryAssetSnapshot>(),
    after: jsonb().$type<InventoryAssetSnapshot>(),
    outcome: text({ enum: ['approved-for-waste', 'rejected', 'deferred'] }),
    reason: text(),
  },
  (t) => [
    primaryKey({ columns: [t.transactionId, t.line] }),
    check(
      'inventory_transaction_line_item_check',
      sql`
    (${t.assetId} is not null and ${t.consumableId} is null and ${t.quantity} is null)
    or (${t.assetId} is null and ${t.consumableId} is not null and ${t.quantity} is not null and ${t.quantity} <> 0)
  `,
    ),
    index('inventory_transaction_asset_idx').on(t.assetId),
    index('inventory_transaction_consumable_idx').on(t.consumableId),
  ],
);
