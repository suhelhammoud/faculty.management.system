import { assertSeedAccounts, demoIdentity } from './ownership.js';
import { validatePassword, validateUsers } from '../validation.js';
import { inventoryDemoRoles } from '../fixtures/local/inventory-roles.js';
import { inventoryDemoUsers } from '../fixtures/local/auth.js';
import { DEFAULT_ROLE_TEMPLATES } from '@project/authorization';
import type { AuthSeedUser, SeedRoleId } from '../fixtures/local/types.js';
import { hashPassword } from 'better-auth/crypto';
import { and, eq, inArray } from 'drizzle-orm';
import type { SeedTransaction } from '../types.js';
import { account, roles, user, userRoles } from '../../schema/auth/index.js';

export async function seedAuth(
  tx: SeedTransaction,
  seedUsers: AuthSeedUser[],
  password: string,
): Promise<Map<string, string>> {
  validatePassword(password);
  validateUsers(seedUsers);
  await assertSeedAccounts(tx, seedUsers.map(demoIdentity));

  const seedRoles = new Map<SeedRoleId, string>();
  for (const template of DEFAULT_ROLE_TEMPLATES) {
    const [role] = await tx.select().from(roles).where(eq(roles.name, template.name)).limit(1);
    if (!role)
      throw new Error(
        `${template.name} role is missing; provision local access before seeding users`,
      );
    seedRoles.set(template.id, role.id);
  }

  const sharedRoleIds = [...seedRoles.values()];
  const inventoryRoleIds = inventoryDemoRoles.map(({ id }) => id);
  for (const id of inventoryRoleIds) seedRoles.set(id, id);
  const inventoryUsernames = new Set(inventoryDemoUsers.map(({ username }) => username));

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
        setWhere: eq(user.id, `seed-${seedUser.username}`),
      })
      .returning({ id: user.id });
    if (!createdUser) throw new Error(`Seed account collision for ${seedUser.username}`);
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
    const seedRoleIds = inventoryUsernames.has(seedUser.username)
      ? inventoryRoleIds
      : sharedRoleIds;
    await tx
      .delete(userRoles)
      .where(and(eq(userRoles.userId, createdUser.id), inArray(userRoles.roleId, seedRoleIds)));
    const assignedRoleIds = (seedUser.roles ?? []).map((role) => {
      const roleId = seedRoles.get(role);
      if (!roleId) throw new Error(`Missing role ${role}`);
      return { userId: createdUser.id, roleId };
    });
    if (assignedRoleIds.length) {
      await tx.insert(userRoles).values(assignedRoleIds).onConflictDoNothing();
    }
  }

  return userIds;
}
