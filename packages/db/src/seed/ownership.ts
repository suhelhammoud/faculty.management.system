import { and, eq, or } from 'drizzle-orm';
import { account, user } from '../schema/auth/index.js';
import type { SeedTransaction } from './types.js';
import type { AuthSeedUser } from './fixtures/local/types.js';

type SeedIdentity = { id: string; username: string; email: string; accountId: string };
export function demoIdentity(seedUser: AuthSeedUser): SeedIdentity {
  return {
    id: `seed-${seedUser.username}`,
    username: seedUser.username,
    email: `${seedUser.username}@seed.invalid`,
    accountId: `seed-account-${seedUser.username}`,
  };
}

export async function assertSeedAccounts(
  tx: SeedTransaction,
  identities: SeedIdentity[],
): Promise<void> {
  for (const identity of identities) {
    const matches = await tx
      .select()
      .from(user)
      .where(
        or(
          eq(user.id, identity.id),
          eq(user.username, identity.username),
          eq(user.email, identity.email),
        ),
      );
    if (matches.some((match) => match.id !== identity.id || match.username !== identity.username)) {
      throw new Error(
        `Seed account collision for ${identity.username}: user identity belongs to another account`,
      );
    }
    const credentials = await tx
      .select()
      .from(account)
      .where(
        or(
          eq(account.id, identity.accountId),
          and(eq(account.userId, identity.id), eq(account.providerId, 'credential')),
        ),
      );
    if (
      credentials.some(
        (match) =>
          match.id !== identity.accountId ||
          match.userId !== identity.id ||
          match.accountId !== identity.id ||
          match.providerId !== 'credential',
      )
    ) {
      throw new Error(
        `Seed account collision for ${identity.username}: credentials belong to another account`,
      );
    }
  }
}
