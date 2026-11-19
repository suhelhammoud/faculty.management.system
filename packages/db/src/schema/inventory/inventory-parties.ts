import { pgTable, text, uuid } from 'drizzle-orm/pg-core';

export const fallbackInventoryCustodian = '00000000-0000-4000-8000-000000000001';
export const inventorySharedAccounts = pgTable('inventory_shared_accounts', {
  id: uuid().defaultRandom().primaryKey(),
  name: text().notNull().unique(),
});
