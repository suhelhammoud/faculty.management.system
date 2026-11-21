import { sql } from 'drizzle-orm';
import { elevatedGrants } from '../../schema/auth/index.js';
import type { ElevatedGrantSeed } from '../fixtures/local/types.js';
import type { SeedTransaction } from '../types.js';

export async function seedElevatedGrants(
  tx: SeedTransaction,
  grants: ElevatedGrantSeed[],
  userIds: ReadonlyMap<string, string>,
  administratorId: string,
): Promise<void> {
  if (!grants.length) return;

  const rows = grants.map((grant) => {
    const userId = userIds.get(grant.username);
    const resourceId = grant.targetUsername ? userIds.get(grant.targetUsername) : undefined;
    if (!userId || (grant.targetUsername && !resourceId)) {
      throw new Error(`Missing demo account for elevated grant ${grant.key}`);
    }
    return {
      id: `seed-elevated-${grant.key}`,
      userId,
      permission: grant.permission,
      resourceType: resourceId ? 'users' : null,
      resourceId: resourceId ?? null,
      expiresAt: sql`clock_timestamp() + ${grant.validForHours}::integer * interval '1 hour'`,
      maxUses: grant.maxUses,
      remainingUses: grant.maxUses,
      grantedBy: administratorId,
    };
  });

  // Preserve usage, expiry, and revocation when the local seed is rerun.
  await tx.insert(elevatedGrants).values(rows).onConflictDoNothing({ target: elevatedGrants.id });
}
