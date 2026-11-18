import { eq, type Database } from '@project/db';
import { permissions, roles, rolePermissions } from '@project/db/schema';

export const FACILITIES_PERMISSIONS = ['facilities:read', 'facilities:write'] as const;
type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

export async function provisionFacilitiesPermissions(tx: Transaction, administratorRoleId: string) {
  await tx
    .insert(permissions)
    .values(FACILITIES_PERMISSIONS.map((key) => ({ key })))
    .onConflictDoNothing();
  await tx
    .insert(roles)
    .values({ id: 'facilities-administrator', name: 'Facilities Administrator' })
    .onConflictDoNothing();
  const [facilitiesRole] = await tx
    .select()
    .from(roles)
    .where(eq(roles.name, 'Facilities Administrator'));
  await tx
    .insert(rolePermissions)
    .values(
      [administratorRoleId, facilitiesRole.id].flatMap((roleId) =>
        FACILITIES_PERMISSIONS.map((permission) => ({ roleId, permission })),
      ),
    )
    .onConflictDoNothing();
}
