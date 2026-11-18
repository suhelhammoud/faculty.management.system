import { PERMISSION_CATALOG } from '@project/authorization';
import { sql } from 'drizzle-orm';
import type { Database } from '../client.js';
import { permissions } from '../schema/auth/access-control.js';

type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

export async function seedPermissionCatalog(tx: Transaction): Promise<void> {
  await tx
    .insert(permissions)
    .values([...PERMISSION_CATALOG])
    .onConflictDoUpdate({
      target: permissions.key,
      set: { description: sql`excluded.description` },
    });
}
