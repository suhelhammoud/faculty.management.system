import type { Database } from '@project/db';
import { FACILITIES_DEFAULT_ROLE, FACILITIES_PERMISSIONS } from '@project/authorization';
import { provisionRoleTemplate } from '../../auth/provision-role-template.js';
export { FACILITIES_PERMISSIONS } from '@project/authorization';

type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

export async function provisionFacilitiesPermissions(tx: Transaction, administratorRoleId: string) {
  await provisionRoleTemplate(tx, administratorRoleId, FACILITIES_DEFAULT_ROLE);
}
