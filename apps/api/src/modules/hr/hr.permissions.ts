import { eq, type Database } from '@project/db';
import { permissions, roles, rolePermissions } from '@project/db/schema';
export const HR_PERMISSIONS = [
  'hr-employees:read',
  'hr-employees:create',
  'hr-employees:update',
  'hr-reference-data:read',
  'hr-reference-data:write',
] as const;
type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

export async function provisionHrPermissions(tx: Transaction, administratorRoleId: string) {
  await tx
    .insert(permissions)
    .values(HR_PERMISSIONS.map((key) => ({ key })))
    .onConflictDoNothing();
  await tx
    .insert(roles)
    .values({ id: 'hr-administrator', name: 'HR Administrator' })
    .onConflictDoNothing();
  const [hrRole] = await tx.select().from(roles).where(eq(roles.name, 'HR Administrator'));
  await tx
    .insert(rolePermissions)
    .values(
      [administratorRoleId, hrRole.id].flatMap((roleId) =>
        HR_PERMISSIONS.map((permission) => ({ roleId, permission })),
      ),
    )
    .onConflictDoNothing();
}
