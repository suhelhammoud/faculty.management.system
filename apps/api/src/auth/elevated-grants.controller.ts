import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { ELEVATED_PERMISSION_SCOPES, PERMISSION } from '@project/authorization';
import { and, desc, eq, type Database } from '@project/db';
import { auditLog, elevatedGrants, inventoryAssets, permissions, user } from '@project/db/schema';
import { isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { DATABASE } from '../database/database.constants.js';
import { ActorId, RequirePermission } from './auth.guard.js';
import { AuthorizationService } from './authorization.service.js';

const grantInput = z.object({
  permission: z.string().min(1),
  resourceId: z.string().trim().min(1).optional(),
  expiresAt: z.iso.datetime({ offset: true }).transform((date) => new Date(date)),
  maxUses: z.number().int().min(1).max(2_147_483_647),
});

@Controller('api/admin/users/:id/elevated-grants')
export class ElevatedGrantsController {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(AuthorizationService) private readonly auth: AuthorizationService,
  ) {}

  @Get()
  @RequirePermission(PERMISSION.users.assignRoles, 'users')
  async list(@Param('id') id: string) {
    await this.requireUser(id);
    const catalog = await this.db.select().from(permissions).orderBy(permissions.key);
    const grants = await this.db
      .select()
      .from(elevatedGrants)
      .where(eq(elevatedGrants.userId, id))
      .orderBy(desc(elevatedGrants.createdAt), elevatedGrants.id);
    return {
      grants,
      eligiblePermissions: catalog.flatMap(({ key, description }) => {
        const resourceType = ELEVATED_PERMISSION_SCOPES.get(key);
        return resourceType === undefined ? [] : [{ key, description, resourceType }];
      }),
    };
  }

  @Post()
  @RequirePermission(PERMISSION.users.assignRoles, 'users')
  async issue(@Param('id') id: string, @ActorId() actorId: string, @Body() body: unknown) {
    const input = grantInput.safeParse(body);
    if (!input.success) {
      throw new BadRequestException(
        'Provide a permission, an expiry with a time zone, and a positive whole number of attempts',
      );
    }
    const { permission, resourceId, expiresAt, maxUses } = input.data;
    const supportedScope = ELEVATED_PERMISSION_SCOPES.get(permission);
    if (supportedScope === undefined || (resourceId && !supportedScope)) {
      throw new BadRequestException('This permission does not support the requested elevation');
    }
    const resource =
      resourceId && supportedScope
        ? {
            id: supportedScope === 'inventory.asset' ? resourceId.toLowerCase() : resourceId,
            type: supportedScope,
          }
        : undefined;
    if (!(await this.auth.can(actorId, permission, resource))) {
      throw new ForbiddenException('Cannot delegate a permission you do not hold');
    }
    await this.requireUser(id);
    if (resource?.type === 'users') await this.requireUser(resource.id);
    if (resource?.type === 'inventory.asset') {
      if (!z.uuid().safeParse(resource.id).success)
        throw new BadRequestException('Invalid asset ID');
      const [asset] = await this.db
        .select({ id: inventoryAssets.id })
        .from(inventoryAssets)
        .where(eq(inventoryAssets.id, resource.id));
      if (!asset) throw new NotFoundException('Asset not found');
    }
    const grantId = randomUUID();
    return this.db.transaction(async (tx) => {
      const { rows } = await tx.execute<{ future: boolean }>(
        sql`select ${expiresAt.toISOString()}::timestamptz > clock_timestamp() as future`,
      );
      if (!rows[0].future) throw new BadRequestException('Expiry must be in the future');
      const [grant] = await tx
        .insert(elevatedGrants)
        .values({
          id: grantId,
          userId: id,
          permission,
          resourceType: resource?.type,
          resourceId: resource?.id,
          expiresAt,
          maxUses,
          remainingUses: maxUses,
          grantedBy: actorId,
        })
        .returning();
      await tx.insert(auditLog).values({
        id: randomUUID(),
        actorId,
        action: 'elevated-grants:issue',
        targetId: JSON.stringify({ grantId, userId: id, permission, resource, expiresAt, maxUses }),
      });
      return grant;
    });
  }

  @Delete(':grantId')
  @RequirePermission(PERMISSION.users.assignRoles, 'users')
  async revoke(
    @Param('id') id: string,
    @Param('grantId') grantId: string,
    @ActorId() actorId: string,
  ) {
    const target = and(eq(elevatedGrants.id, grantId), eq(elevatedGrants.userId, id));
    const [grant] = await this.db.select().from(elevatedGrants).where(target);
    if (!grant) throw new NotFoundException('Elevated grant not found');
    const scope =
      grant.resourceType && grant.resourceId
        ? { type: grant.resourceType, id: grant.resourceId }
        : undefined;
    if (!(await this.auth.can(actorId, grant.permission, scope))) {
      throw new ForbiddenException('Cannot manage a permission you do not hold');
    }
    await this.db.transaction(async (tx) => {
      const [revoked] = await tx
        .update(elevatedGrants)
        .set({ revokedAt: sql`clock_timestamp()` })
        .where(and(target, isNull(elevatedGrants.revokedAt)))
        .returning({ id: elevatedGrants.id });
      if (revoked) {
        await tx.insert(auditLog).values({
          id: randomUUID(),
          actorId,
          action: 'elevated-grants:revoke',
          targetId: JSON.stringify({ grantId, userId: id }),
        });
      }
    });
    return { success: true };
  }

  private async requireUser(id: string) {
    const [person] = await this.db.select({ id: user.id }).from(user).where(eq(user.id, id));
    if (!person) throw new NotFoundException('User not found');
  }
}
