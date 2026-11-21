import { assertSeedAccounts } from './ownership.js';
import { validatePassword } from '../validation.js';
import { ADMINISTRATOR_DEFAULT_ROLE, DEFAULT_ROLE_TEMPLATES } from '@project/authorization';
import { hashPassword } from 'better-auth/crypto';
import { eq, or } from 'drizzle-orm';
import type { SeedTransaction } from '../types.js';
import { account, rolePermissions, roles, user, userRoles } from '../../schema/auth/index.js';
import { seedPermissionCatalog } from './permissions.js';
import { moduleDemoAccess } from '../fixtures/local/auth.js';
import type { AdministratorSeed } from '../fixtures/local/types.js';

export async function seedLocalAccess(
  tx: SeedTransaction,
  administrator: AdministratorSeed,
  password: string,
): Promise<void> {
  validatePassword(password);
  await assertSeedAccounts(tx, [administrator]);
  const [existing] = await tx.select().from(user).where(eq(user.username, administrator.username));

  await seedPermissionCatalog(tx);
  const templates = [ADMINISTRATOR_DEFAULT_ROLE, ...DEFAULT_ROLE_TEMPLATES];
  let administratorRoleId: string | undefined;
  for (const template of templates) {
    await tx
      .insert(roles)
      .values({ id: template.id, name: template.name, description: template.description })
      .onConflictDoUpdate({
        target: roles.name,
        set: { description: template.description },
      });
    const [role] = await tx.select().from(roles).where(eq(roles.name, template.name));
    if (!role) throw new Error(`Failed to provision local role ${template.name}`);
    await tx
      .insert(rolePermissions)
      .values(template.permissions.map((permission) => ({ roleId: role.id, permission })))
      .onConflictDoNothing();
    if (template.name === ADMINISTRATOR_DEFAULT_ROLE.name) administratorRoleId = role.id;
  }
  for (const template of moduleDemoAccess.flatMap(({ roles }) => [...roles])) {
    const matches = await tx
      .select()
      .from(roles)
      .where(or(eq(roles.id, template.id), eq(roles.name, template.name)));
    if (matches.some((role) => role.id !== template.id || role.name !== template.name))
      throw new Error(`Demo seed role collision for ${template.name}`);
    await tx
      .insert(roles)
      .values({
        id: template.id,
        name: template.name,
        description: template.description,
      })
      .onConflictDoNothing();
    await tx
      .insert(rolePermissions)
      .values(template.permissions.map((permission) => ({ roleId: template.id, permission })))
      .onConflictDoNothing();
  }

  if (!administratorRoleId) throw new Error('Failed to provision local administrator role');

  const { accountId, ...profile } = administrator;
  await tx.insert(user).values(profile).onConflictDoNothing({ target: user.username });
  // Preserve credentials and account settings when local seeding is repeated.
  if (!existing) {
    await tx.insert(account).values({
      id: accountId,
      accountId: administrator.id,
      providerId: 'credential',
      userId: administrator.id,
      password: await hashPassword(password),
    });
  }
  await tx
    .insert(userRoles)
    .values({ userId: administrator.id, roleId: administratorRoleId })
    .onConflictDoNothing();
}
