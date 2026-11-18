import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from '@project/db';
import type { Database } from '@project/db';
import { resourceAcl, rolePermissions, userRoles, user } from '@project/db/schema';
import { DATABASE } from '../database/database.constants.js';

export function evaluatePermission(effects: string[], roleGranted: boolean): boolean {
  if (effects.includes('deny')) return false;
  return effects.includes('allow') || roleGranted;
}

@Injectable()
export class AuthorizationService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}
  async isActive(userId: string, db: Pick<Database, 'select'> = this.db): Promise<boolean> {
    const [person] = await db.select().from(user).where(eq(user.id, userId));
    return Boolean(person?.approved && person.enabled && !person.mustChangePassword);
  }
  async can(
    userId: string,
    permission: string,
    resource?: { type: string; id: string },
    db: Pick<Database, 'select'> = this.db,
  ): Promise<boolean> {
    if (!(await this.isActive(userId, db))) return false;
    const rules = resource
      ? await db
          .select()
          .from(resourceAcl)
          .where(
            and(
              eq(resourceAcl.userId, userId),
              eq(resourceAcl.permission, permission),
              eq(resourceAcl.resourceType, resource.type),
              eq(resourceAcl.resourceId, resource.id),
            ),
          )
      : [];
    if (rules.some((rule) => rule.effect === 'deny')) return false;
    if (rules.some((rule) => rule.effect === 'allow')) return true;
    const grants = await db
      .select({ permission: rolePermissions.permission })
      .from(userRoles)
      .innerJoin(rolePermissions, eq(rolePermissions.roleId, userRoles.roleId))
      .where(and(eq(userRoles.userId, userId), eq(rolePermissions.permission, permission)))
      .limit(1);
    return grants.length > 0;
  }
}
