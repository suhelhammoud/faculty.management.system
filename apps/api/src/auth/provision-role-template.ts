import { eq, type Database } from '@project/db';
import { rolePermissions, roles } from '@project/db/schema';
import type { DefaultRoleTemplate } from '@project/authorization';

type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

export async function provisionRoleTemplate(
  tx: Transaction,
  administratorRoleId: string,
  template: DefaultRoleTemplate,
): Promise<void> {
  await tx
    .insert(roles)
    .values({ id: template.id, name: template.name, description: template.description })
    .onConflictDoNothing();
  const [role] = await tx.select().from(roles).where(eq(roles.name, template.name));
  if (!role) throw new Error(`Failed to provision default role ${template.name}`);
  await tx
    .insert(rolePermissions)
    .values(
      [administratorRoleId, role.id].flatMap((roleId) =>
        template.permissions.map((permission) => ({ roleId, permission })),
      ),
    )
    .onConflictDoNothing();
}
