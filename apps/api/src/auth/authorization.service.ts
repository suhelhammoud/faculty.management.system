import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from '@project/db';
import type { Database } from '@project/db';
import {
  resourceAcl,
  rolePermissions,
  userRoles,
  user,
} from '@project/db/schema';
import { DATABASE } from '../database/database.constants.js';

export function evaluatePermission(
  effects: string[],
  roleGranted: boolean,
): boolean {
  if (effects.includes('deny')) return false;
  return effects.includes('allow') || roleGranted;
}

@Injectable()
export class AuthorizationService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}
  async can(
    userId: string,
    permission: string,
    resource?: { type: string; id: string },
  ): Promise<boolean> {
    const [person] = await this.db
      .select()
      .from(user)
      .where(eq(user.id, userId));
    if (!person?.approved || !person.enabled || person.mustChangePassword)
      return false;
    const rules = resource
      ? await this.db
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
    const grants = await this.db
      .select({ permission: rolePermissions.permission })
      .from(userRoles)
      .innerJoin(rolePermissions, eq(rolePermissions.roleId, userRoles.roleId))
      .where(
        and(
          eq(userRoles.userId, userId),
          eq(rolePermissions.permission, permission),
        ),
      )
      .limit(1);
    return grants.length > 0;
  }
}
