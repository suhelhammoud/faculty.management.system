import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { hashPassword } from 'better-auth/crypto';
import { eq } from 'drizzle-orm';
import type { Database } from '../client.js';
import { account, roles, user, userRoles } from '../schema/auth/index.js';

type SeedExecutor = Pick<Database, 'select' | 'insert'>;
type AuthSeedUser = { username: string; name: string };

async function readUsers(fixtureRoot: string): Promise<AuthSeedUser[]> {
  return JSON.parse(
    await readFile(resolve(fixtureRoot, 'auth.users.json'), 'utf8'),
  ) as AuthSeedUser[];
}

export async function seedAuth(
  tx: SeedExecutor,
  fixtureRoot: string,
  password: string,
): Promise<Map<string, string>> {
  if (password.length < 12 || password.length > 128) {
    throw new Error('SEED_USER_PASSWORD must be 12–128 characters');
  }

  const seedUsers = await readUsers(fixtureRoot);
  if (
    !seedUsers.length ||
    seedUsers.some(({ username, name }) => !/^[a-z0-9_]{3,30}$/.test(username) || !name.trim())
  ) {
    throw new Error('Auth fixtures need valid lowercase usernames and nonempty names');
  }

  const [hrRole] = await tx.select().from(roles).where(eq(roles.name, 'HR Administrator')).limit(1);
  if (!hrRole) throw new Error('HR Administrator role is missing; run database migrations first');

  const passwordHash = await hashPassword(password);
  const userIds = new Map<string, string>();
  for (const seedUser of seedUsers) {
    const [createdUser] = await tx
      .insert(user)
      .values({
        id: `seed-${seedUser.username}`,
        username: seedUser.username,
        displayUsername: seedUser.username,
        name: seedUser.name,
        email: `${seedUser.username}@seed.invalid`,
        approved: true,
        enabled: true,
        mustChangePassword: false,
      })
      .onConflictDoUpdate({
        target: user.username,
        set: {
          displayUsername: seedUser.username,
          name: seedUser.name,
          approved: true,
          enabled: true,
          mustChangePassword: false,
          updatedAt: new Date(),
        },
      })
      .returning({ id: user.id });
    userIds.set(seedUser.username, createdUser.id);

    await tx
      .insert(account)
      .values({
        id: `seed-account-${seedUser.username}`,
        accountId: createdUser.id,
        providerId: 'credential',
        userId: createdUser.id,
        password: passwordHash,
      })
      .onConflictDoUpdate({
        target: account.id,
        set: { password: passwordHash, updatedAt: new Date() },
      });
    await tx
      .insert(userRoles)
      .values({ userId: createdUser.id, roleId: hrRole.id })
      .onConflictDoNothing();
  }

  return userIds;
}
