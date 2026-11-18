import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { hashPassword } from 'better-auth/crypto';
import { and, eq, inArray } from 'drizzle-orm';
import type { Database } from '../client.js';
import { account, roles, user, userRoles } from '../schema/auth/index.js';

type SeedExecutor = Pick<Database, 'select' | 'insert' | 'delete'>;
type SeedRole = 'hr_admin' | 'facilities_admin';
type AuthSeedUser = { username: string; name: string; roles?: SeedRole[] };
const roleNames: Record<SeedRole, string> = {
  hr_admin: 'HR Administrator',
  facilities_admin: 'Facilities Administrator',
};

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
    seedUsers.some(
      ({ username, name, roles: assignedRoles }) =>
        !/^[a-z0-9_]{3,30}$/.test(username) ||
        !name.trim() ||
        (assignedRoles ?? []).some((role) => !Object.hasOwn(roleNames, role)),
    )
  ) {
    throw new Error('Auth fixtures need valid usernames, names, and recognized roles');
  }

  const seedRoles = new Map<string, string>();
  for (const roleName of Object.values(roleNames)) {
    const [role] = await tx.select().from(roles).where(eq(roles.name, roleName)).limit(1);
    if (!role) throw new Error(`${roleName} role is missing; run database migrations first`);
    seedRoles.set(roleName, role.id);
  }

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
    const seedRoleIds = [...seedRoles.values()];
    await tx
      .delete(userRoles)
      .where(and(eq(userRoles.userId, createdUser.id), inArray(userRoles.roleId, seedRoleIds)));
    const assignedRoleIds = (seedUser.roles ?? []).map((role) => {
      const roleId = seedRoles.get(roleNames[role]);
      if (!roleId) throw new Error(`Missing role ${roleNames[role]}`);
      return { userId: createdUser.id, roleId };
    });
    if (assignedRoleIds.length) {
      await tx.insert(userRoles).values(assignedRoleIds).onConflictDoNothing();
    }
  }

  return userIds;
}
