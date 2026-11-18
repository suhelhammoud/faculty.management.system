import type { Database } from '@project/db';
import { HR_DEFAULT_ROLE, HR_PERMISSIONS } from '@project/authorization';
import { provisionRoleTemplate } from '../../auth/provision-role-template.js';
export { HR_PERMISSIONS } from '@project/authorization';
type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

export async function provisionHrPermissions(tx: Transaction, administratorRoleId: string) {
  await provisionRoleTemplate(tx, administratorRoleId, HR_DEFAULT_ROLE);
}
