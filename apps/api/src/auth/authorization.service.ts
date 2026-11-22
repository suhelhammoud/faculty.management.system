import { randomUUID } from 'node:crypto';
import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { and, eq } from '@project/db';
import type { Database } from '@project/db';
import {
  auditLog,
  elevatedGrants,
  resourceAcl,
  rolePermissions,
  userRoles,
  user,
} from '@project/db/schema';
import { gt, inArray, isNull, or, sql } from 'drizzle-orm';
import { DATABASE } from '../database/database.constants.js';

export type ResourceScope = { type: string; id: string };
type Reader = Pick<Database, 'select'>;

function usableGrant() {
  return and(
    isNull(elevatedGrants.revokedAt),
    gt(elevatedGrants.remainingUses, 0),
    gt(elevatedGrants.expiresAt, sql`clock_timestamp()`),
  );
}

export function evaluatePermission(effects: string[], roleGranted: boolean): boolean {
  if (effects.includes('deny')) return false;
  return effects.includes('allow') || roleGranted;
}

@Injectable()
export class AuthorizationService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}
  async isActive(userId: string, db: Reader = this.db): Promise<boolean> {
    const [person] = await db.select().from(user).where(eq(user.id, userId));
    return Boolean(person?.approved && person.enabled && !person.mustChangePassword);
  }
  async can(
    userId: string,
    permission: string,
    resource?: ResourceScope,
    db: Reader = this.db,
  ): Promise<boolean> {
    return (await this.permissionAccess(userId, permission, resource, db)) === 'allowed';
  }

  async canMany(
    userId: string,
    permissions: readonly string[],
    resourceType: string,
    resourceIds: readonly string[],
    db: Reader = this.db,
  ): Promise<(permission: string, resourceId: string) => boolean> {
    if (!permissions.length || !resourceIds.length || !(await this.isActive(userId, db))) {
      return () => false;
    }
    const [roleGrants, rules] = await Promise.all([
      db
        .select({ permission: rolePermissions.permission })
        .from(userRoles)
        .innerJoin(rolePermissions, eq(userRoles.roleId, rolePermissions.roleId))
        .where(and(eq(userRoles.userId, userId), inArray(rolePermissions.permission, permissions))),
      db
        .select({
          permission: resourceAcl.permission,
          id: resourceAcl.resourceId,
          effect: resourceAcl.effect,
        })
        .from(resourceAcl)
        .where(
          and(
            eq(resourceAcl.userId, userId),
            eq(resourceAcl.resourceType, resourceType),
            inArray(resourceAcl.resourceId, resourceIds),
            inArray(resourceAcl.permission, permissions),
          ),
        ),
    ]);
    const granted = new Set(roleGrants.map(({ permission }) => permission));
    const resourceSet = new Set(resourceIds);
    const permissionSet = new Set(permissions);
    const effects = new Map<string, string[]>();
    const effectKey = (permission: string, id: string) => JSON.stringify([permission, id]);
    for (const { permission, id, effect } of rules) {
      const key = effectKey(permission, id);
      const matching = effects.get(key) ?? [];
      matching.push(effect);
      effects.set(key, matching);
    }
    return (permission, id) =>
      resourceSet.has(id) &&
      permissionSet.has(permission) &&
      evaluatePermission(effects.get(effectKey(permission, id)) ?? [], granted.has(permission));
  }

  async canAttempt(userId: string, permission: string, resource?: ResourceScope): Promise<boolean> {
    const access = await this.permissionAccess(userId, permission, resource, this.db);
    if (access === 'allowed') return true;
    if (access === 'blocked') return false;
    return (await this.grantCandidates(this.db, userId, permission, resource)).length > 0;
  }

  async prepareAttempt(userId: string, permission: string, resource?: ResourceScope) {
    const access = await this.permissionAccess(userId, permission, resource, this.db);
    if (access === 'allowed') return async () => {};
    if (
      access === 'blocked' ||
      !(await this.grantCandidates(this.db, userId, permission, resource)).length
    ) {
      throw new ForbiddenException();
    }

    return async () => {
      await this.db.transaction(async (tx) => {
        const [candidate] = await this.grantCandidates(tx, userId, permission, resource).for(
          'update',
        );
        const currentAccess = await this.permissionAccess(userId, permission, resource, tx);
        if (currentAccess === 'allowed') return;
        if (currentAccess === 'blocked' || !candidate) throw new ForbiddenException();
        const [claimed] = await tx
          .update(elevatedGrants)
          .set({ remainingUses: sql`${elevatedGrants.remainingUses} - 1` })
          .where(and(eq(elevatedGrants.id, candidate.id), usableGrant()))
          .returning({ id: elevatedGrants.id });
        if (!claimed) throw new ForbiddenException();
        await tx.insert(auditLog).values({
          id: randomUUID(),
          actorId: userId,
          action: 'elevated-grants:use',
          targetId: JSON.stringify({ grantId: claimed.id, permission, resource }),
        });
      });
    };
  }

  private grantCandidates(
    db: Reader,
    userId: string,
    permission: string,
    resource?: ResourceScope,
  ) {
    const globalScope = isNull(elevatedGrants.resourceType);
    const scope = resource
      ? or(
          globalScope,
          and(
            eq(elevatedGrants.resourceType, resource.type),
            eq(elevatedGrants.resourceId, resource.id),
          ),
        )
      : globalScope;
    return db
      .select({ id: elevatedGrants.id })
      .from(elevatedGrants)
      .where(
        and(
          eq(elevatedGrants.userId, userId),
          eq(elevatedGrants.permission, permission),
          scope,
          usableGrant(),
        ),
      )
      .orderBy(
        sql`${elevatedGrants.resourceId} is null`,
        elevatedGrants.expiresAt,
        elevatedGrants.id,
      )
      .limit(1);
  }

  async permissionAccess(
    userId: string,
    permission: string,
    resource: ResourceScope | undefined,
    db: Reader,
  ) {
    if (!(await this.isActive(userId, db))) return 'blocked';
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
    if (rules.some((rule) => rule.effect === 'deny')) return 'blocked';
    if (rules.some((rule) => rule.effect === 'allow')) return 'allowed';
    const grants = await db
      .select({ permission: rolePermissions.permission })
      .from(userRoles)
      .innerJoin(rolePermissions, eq(rolePermissions.roleId, userRoles.roleId))
      .where(and(eq(userRoles.userId, userId), eq(rolePermissions.permission, permission)))
      .limit(1);
    return grants.length > 0 ? 'allowed' : 'missing';
  }
}
