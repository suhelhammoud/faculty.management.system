import { PERMISSION_CATALOG } from '@project/authorization';
import { sql } from 'drizzle-orm';
import type { SeedTransaction } from './types.js';
import { permissions } from '../schema/auth/access-control.js';

export async function seedPermissionCatalog(tx: SeedTransaction): Promise<void> {
  await tx
    .insert(permissions)
    .values([...PERMISSION_CATALOG])
    .onConflictDoUpdate({
      target: permissions.key,
      set: { description: sql`excluded.description` },
    });
}
