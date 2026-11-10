import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Delete,
  NotFoundException,
  ConflictException,
  Inject,
  Param,
  Post,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { hashPassword, verifyPassword } from 'better-auth/crypto';
import { fromNodeHeaders } from 'better-auth/node';
import { and, eq, desc, gte, lte, count, type Database } from '@project/db';
import {
  user,
  account,
  session,
  roles,
  userRoles,
  rolePermissions,
  auditLog,
  resourceAcl,
  permissions,
} from '@project/db/schema';
import type { Request } from 'express';
import { DATABASE } from '../database/database.constants.js';
import { AUTH, type Auth } from './auth.provider.js';
import { Public, RequirePermission } from './auth.guard.js';
function value(body: Record<string, unknown>, key: string) {
  const v = body?.[key];
  if (typeof v !== 'string' || !v.trim()) throw new BadRequestException(key);
  return v;
}
function password(body: Record<string, unknown>, key = 'password') {
  const p = value(body, key);
  if (p.length < 12 || p.length > 128)
    throw new BadRequestException('Password must have 12–128 characters');
  return p;
}
@Controller('api/admin')
export class AdminController {
  constructor(
    @Inject(DATABASE) private db: Database,
    @Inject(AUTH) private auth: Auth,
  ) {}
  private async actor(req: Request) {
    const s = await this.auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    if (!s) throw new ForbiddenException();
    return s.user.id;
  }
  @Get('users')
  @RequirePermission('users:read')
  list() {
    return this.db
      .select({
        id: user.id,
        username: user.username,
        name: user.name,
        approved: user.approved,
        enabled: user.enabled,
        mustChangePassword: user.mustChangePassword,
      })
      .from(user);
  }
  @Post('users')
  @RequirePermission('users:create')
  async create(@Body() body: Record<string, unknown>, @Req() req: Request) {
    const username = value(body, 'username').toLowerCase();
    if (!/^[a-z0-9_]{3,30}$/.test(username))
      throw new BadRequestException('Invalid username');
    const hash = await hashPassword(password(body));
    const id = randomUUID();
    const actorId = await this.actor(req);
    await this.db.transaction(async (tx) => {
      await tx.insert(user).values({
        id,
        username,
        displayUsername: username,
        name: value(body, 'name'),
        email: `${id}@accounts.invalid`,
      });
      await tx.insert(account).values({
        id: randomUUID(),
        accountId: id,
        providerId: 'credential',
        userId: id,
        password: hash,
      });
      await tx.insert(auditLog).values({
        id: randomUUID(),
        actorId,
        action: 'users:create',
        targetId: id,
      });
    });
    return { id };
  }
  @Post('users/:id/approve')
  @RequirePermission('users:approve', 'users')
  async approve(@Param('id') id: string, @Req() req: Request) {
    const actorId = await this.actor(req);
    await this.db.transaction(async (tx) => {
      await tx.update(user).set({ approved: true }).where(eq(user.id, id));
      await tx.insert(auditLog).values({
        id: randomUUID(),
        actorId,
        action: 'users:approve',
        targetId: id,
      });
    });
    return { success: true };
  }
  @Post('users/:id/reset-password')
  @RequirePermission('users:reset-password', 'users')
  async reset(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    const hash = await hashPassword(password(body));
    const actorId = await this.actor(req);
    await this.db.transaction(async (tx) => {
      await tx.select().from(user).where(eq(user.id, id)).for('update');
      await tx
        .update(user)
        .set({ mustChangePassword: true })
        .where(eq(user.id, id));
      await tx
        .update(account)
        .set({ password: hash })
        .where(
          and(eq(account.userId, id), eq(account.providerId, 'credential')),
        );
      await tx.delete(session).where(eq(session.userId, id));
      await tx.insert(auditLog).values({
        id: randomUUID(),
        actorId,
        action: 'users:reset-password',
        targetId: id,
      });
    });
    return { success: true };
  }
  @Get('roles')
  @RequirePermission('roles:read')
  listRoles() {
    return this.db.select().from(roles);
  }
  @Get('roles/:id/permissions')
  @RequirePermission('roles:read', 'roles')
  async listRolePermissions(@Param('id') id: string) {
    const [role] = await this.db
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.id, id));
    if (!role) throw new NotFoundException('Role not found');
    return this.db
      .select({ key: rolePermissions.permission })
      .from(rolePermissions)
      .where(eq(rolePermissions.roleId, id))
      .orderBy(rolePermissions.permission);
  }
  @Post('roles')
  @RequirePermission('roles:create')
  async createRole(@Body() body: Record<string, unknown>, @Req() req: Request) {
    const id = randomUUID();
    const actorId = await this.actor(req);
    await this.db.transaction(async (tx) => {
      await tx.insert(roles).values({ id, name: value(body, 'name') });
      await tx.insert(auditLog).values({
        id: randomUUID(),
        actorId,
        action: 'roles:create',
        targetId: id,
      });
    });
    return { id };
  }
  @Post('roles/:id/permissions')
  @RequirePermission('roles:update', 'roles')
  async grant(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    const permission = value(body, 'permission');
    const actorId = await this.actor(req);
    const { AuthorizationService } = await import('./authorization.service.js');
    if (!(await new AuthorizationService(this.db).can(actorId, permission)))
      throw new ForbiddenException(
        'Cannot delegate a permission you do not hold',
      );
    await this.db.transaction(async (tx) => {
      await tx
        .insert(rolePermissions)
        .values({ roleId: id, permission })
        .onConflictDoNothing();
      await tx.insert(auditLog).values({
        id: randomUUID(),
        actorId,
        action: 'roles:grant-permission',
        targetId: id,
      });
    });
    return { success: true };
  }
  @Post('users/:id/roles')
  @RequirePermission('users:assign-roles', 'users')
  async assign(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    const roleId = value(body, 'roleId');
    const actorId = await this.actor(req);
    const grants = await this.db
      .select()
      .from(rolePermissions)
      .where(eq(rolePermissions.roleId, roleId));
    const { AuthorizationService } = await import('./authorization.service.js');
    for (const grant of grants)
      if (
        !(await new AuthorizationService(this.db).can(
          actorId,
          grant.permission,
        ))
      )
        throw new ForbiddenException();
    await this.db.transaction(async (tx) => {
      await tx
        .insert(userRoles)
        .values({ userId: id, roleId })
        .onConflictDoNothing();
      await tx.insert(auditLog).values({
        id: randomUUID(),
        actorId,
        action: 'users:assign-role',
        targetId: id,
      });
    });
    return { success: true };
  }
  private async protectAdministrator(
    tx: Parameters<Parameters<Database['transaction']>[0]>[0],
  ) {
    const people = await tx.select().from(user);
    const assignments = await tx.select().from(userRoles);
    const grants = await tx.select().from(rolePermissions);
    const required = [
      'users:create',
      'users:approve',
      'users:assign-roles',
      'roles:update',
    ];
    const usable = people.some((person) => {
      if (!person.enabled || !person.approved || person.mustChangePassword)
        return false;
      const ids = new Set(
        assignments.filter((a) => a.userId === person.id).map((a) => a.roleId),
      );
      const keys = new Set(
        grants.filter((g) => ids.has(g.roleId)).map((g) => g.permission),
      );
      return required.every((key) => keys.has(key));
    });
    if (!usable)
      throw new ConflictException(
        'Cannot remove the last usable administrator',
      );
  }

  @Post('users/:id/disable')
  @RequirePermission('users:approve', 'users')
  async disable(@Param('id') id: string, @Req() req: Request) {
    const actorId = await this.actor(req);
    await this.db.transaction(
      async (tx) => {
        const changed = await tx
          .update(user)
          .set({ enabled: false, updatedAt: new Date() })
          .where(eq(user.id, id))
          .returning({ id: user.id });
        if (!changed.length) throw new NotFoundException('User not found');
        await this.protectAdministrator(tx);
        await tx.delete(session).where(eq(session.userId, id));
        await tx.insert(auditLog).values({
          id: randomUUID(),
          actorId,
          action: 'users:disable',
          targetId: id,
        });
      },
      { isolationLevel: 'serializable' },
    );
    return { success: true };
  }

  @Post('users/:id/enable')
  @RequirePermission('users:approve', 'users')
  async enable(@Param('id') id: string, @Req() req: Request) {
    const actorId = await this.actor(req);
    await this.db.transaction(async (tx) => {
      const changed = await tx
        .update(user)
        .set({ enabled: true, updatedAt: new Date() })
        .where(eq(user.id, id))
        .returning({ id: user.id });
      if (!changed.length) throw new NotFoundException('User not found');
      await tx.insert(auditLog).values({
        id: randomUUID(),
        actorId,
        action: 'users:enable',
        targetId: id,
      });
    });
    return { success: true };
  }

  @Delete('users/:id/roles/:roleId')
  @RequirePermission('users:assign-roles', 'users')
  async removeRole(
    @Param('id') id: string,
    @Param('roleId') roleId: string,
    @Req() req: Request,
  ) {
    const actorId = await this.actor(req);
    await this.db.transaction(
      async (tx) => {
        const removed = await tx
          .delete(userRoles)
          .where(and(eq(userRoles.userId, id), eq(userRoles.roleId, roleId)))
          .returning();
        if (!removed.length)
          throw new NotFoundException('Role assignment not found');
        await this.protectAdministrator(tx);
        await tx.delete(session).where(eq(session.userId, id));
        await tx.insert(auditLog).values({
          id: randomUUID(),
          actorId,
          action: 'users:remove-role',
          targetId: `${id}:${roleId}`,
        });
      },
      { isolationLevel: 'serializable' },
    );
    return { success: true };
  }

  @Delete('roles/:id')
  @RequirePermission('roles:update', 'roles')
  async deleteRole(@Param('id') id: string, @Req() req: Request) {
    const actorId = await this.actor(req);
    await this.db.transaction(
      async (tx) => {
        const affected = await tx
          .select()
          .from(userRoles)
          .where(eq(userRoles.roleId, id));
        const removed = await tx
          .delete(roles)
          .where(eq(roles.id, id))
          .returning();
        if (!removed.length) throw new NotFoundException('Role not found');
        await this.protectAdministrator(tx);
        for (const assignment of affected)
          await tx.delete(session).where(eq(session.userId, assignment.userId));
        await tx.insert(auditLog).values({
          id: randomUUID(),
          actorId,
          action: 'roles:delete',
          targetId: id,
        });
      },
      { isolationLevel: 'serializable' },
    );
    return { success: true };
  }

  @Get('permissions')
  @RequirePermission('roles:read')
  listPermissions() {
    return this.db.select().from(permissions).orderBy(permissions.key);
  }

  @Get('audit-log')
  @RequirePermission('audit:read')
  async listAuditLog(@Req() req: Request) {
    const params = new URLSearchParams(req.url.split('?')[1] ?? '');
    const page = Number(params.get('page') ?? 1);
    const pageSize = Number(params.get('pageSize') ?? 25);
    if (
      !Number.isInteger(page) ||
      page < 1 ||
      !Number.isInteger(pageSize) ||
      pageSize < 1 ||
      pageSize > 100
    )
      throw new BadRequestException(
        'page must be positive and pageSize must be between 1 and 100',
      );
    const actor = params.get('actor')?.trim();
    const action = params.get('action')?.trim();
    const fromValue = params.get('from');
    const toValue = params.get('to');
    const from = fromValue ? new Date(fromValue) : undefined;
    const to = toValue ? new Date(toValue) : undefined;
    if (
      (from && !Number.isFinite(from.getTime())) ||
      (to && !Number.isFinite(to.getTime())) ||
      (from && to && from > to)
    )
      throw new BadRequestException('Invalid date range');
    const filters = [
      ...(actor ? [eq(auditLog.actorId, actor)] : []),
      ...(action ? [eq(auditLog.action, action)] : []),
      ...(from ? [gte(auditLog.createdAt, from)] : []),
      ...(to ? [lte(auditLog.createdAt, to)] : []),
    ];
    const where = filters.length ? and(...filters) : undefined;
    const [records, [{ total }]] = await Promise.all([
      this.db
        .select({
          id: auditLog.id,
          actorId: auditLog.actorId,
          actorUsername: user.username,
          actorName: user.name,
          action: auditLog.action,
          targetId: auditLog.targetId,
          createdAt: auditLog.createdAt,
        })
        .from(auditLog)
        .leftJoin(user, eq(auditLog.actorId, user.id))
        .where(where)
        .orderBy(desc(auditLog.createdAt), desc(auditLog.id))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      this.db.select({ total: count() }).from(auditLog).where(where),
    ]);
    return { records, page, pageSize, total };
  }

  @Delete('roles/:id/permissions/:permission')
  @RequirePermission('roles:update', 'roles')
  async removePermission(
    @Param('id') id: string,
    @Param('permission') permission: string,
    @Req() req: Request,
  ) {
    const actorId = await this.actor(req);
    await this.db.transaction(
      async (tx) => {
        const removed = await tx
          .delete(rolePermissions)
          .where(
            and(
              eq(rolePermissions.roleId, id),
              eq(rolePermissions.permission, permission),
            ),
          )
          .returning();
        if (!removed.length)
          throw new NotFoundException('Role permission not found');
        await this.protectAdministrator(tx);
        const affected = await tx
          .select()
          .from(userRoles)
          .where(eq(userRoles.roleId, id));
        for (const assignment of affected)
          await tx.delete(session).where(eq(session.userId, assignment.userId));
        await tx.insert(auditLog).values({
          id: randomUUID(),
          actorId,
          action: 'roles:remove-permission',
          targetId: JSON.stringify({ roleId: id, permission }),
        });
      },
      { isolationLevel: 'serializable' },
    );
    return { success: true };
  }

  @Get('users/:id/acl')
  @RequirePermission('users:assign-roles', 'users')
  async listAcl(@Param('id') id: string) {
    const [person] = await this.db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.id, id));
    if (!person) throw new NotFoundException('User not found');
    return this.db.select().from(resourceAcl).where(eq(resourceAcl.userId, id));
  }

  @Post('users/:id/acl')
  @RequirePermission('users:assign-roles', 'users')
  async addAcl(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    const resourceType = value(body, 'resourceType');
    const resourceId = value(body, 'resourceId');
    const permission = value(body, 'permission');
    const effect = value(body, 'effect');
    if (effect !== 'allow' && effect !== 'deny')
      throw new BadRequestException('effect must be allow or deny');
    if (
      !['users', 'roles'].includes(resourceType) ||
      !permission.startsWith(resourceType + ':')
    )
      throw new BadRequestException(
        'Unsupported resource type or mismatched permission',
      );
    const actorId = await this.actor(req);
    const { AuthorizationService } = await import('./authorization.service.js');
    if (
      !(await new AuthorizationService(this.db).can(actorId, permission, {
        type: resourceType,
        id: resourceId,
      }))
    )
      throw new ForbiddenException('Cannot manage access you do not hold');
    const aclId = randomUUID();
    await this.db.transaction(async (tx) => {
      const [person] = await tx
        .select({ id: user.id })
        .from(user)
        .where(eq(user.id, id));
      if (!person) throw new NotFoundException('User not found');
      const [known] = await tx
        .select()
        .from(permissions)
        .where(eq(permissions.key, permission));
      if (!known) throw new BadRequestException('Unknown permission');
      const table = resourceType === 'users' ? user : roles;
      const [resource] = await tx
        .select({ id: table.id })
        .from(table)
        .where(eq(table.id, resourceId));
      if (!resource) throw new NotFoundException('Resource not found');
      await tx.insert(resourceAcl).values({
        id: aclId,
        userId: id,
        resourceType,
        resourceId,
        permission,
        effect,
      });
      await tx.insert(auditLog).values({
        id: randomUUID(),
        actorId,
        action: 'acl:' + effect,
        targetId: JSON.stringify({
          id: aclId,
          userId: id,
          resourceType,
          resourceId,
          permission,
        }),
      });
    });
    return { id: aclId };
  }

  @Delete('users/:id/acl/:aclId')
  @RequirePermission('users:assign-roles', 'users')
  async removeAcl(
    @Param('id') id: string,
    @Param('aclId') aclId: string,
    @Req() req: Request,
  ) {
    const actorId = await this.actor(req);
    const [rule] = await this.db
      .select()
      .from(resourceAcl)
      .where(and(eq(resourceAcl.id, aclId), eq(resourceAcl.userId, id)));
    if (!rule) throw new NotFoundException('ACL entry not found');
    const { AuthorizationService } = await import('./authorization.service.js');
    if (
      !(await new AuthorizationService(this.db).can(actorId, rule.permission, {
        type: rule.resourceType,
        id: rule.resourceId,
      }))
    )
      throw new ForbiddenException('Cannot manage access you do not hold');
    await this.db.transaction(async (tx) => {
      const removed = await tx
        .delete(resourceAcl)
        .where(and(eq(resourceAcl.id, aclId), eq(resourceAcl.userId, id)))
        .returning();
      if (!removed.length) throw new NotFoundException('ACL entry not found');
      await tx.insert(auditLog).values({
        id: randomUUID(),
        actorId,
        action: 'acl:remove',
        targetId: JSON.stringify(rule),
      });
    });
    return { success: true };
  }

  @Post('change-password')
  @Public()
  async change(@Body() body: Record<string, unknown>, @Req() req: Request) {
    const actorId = await this.actor(req);
    const origin = req.headers.origin;
    if (
      !origin ||
      !this.auth.options.trustedOrigins ||
      !Array.isArray(this.auth.options.trustedOrigins) ||
      !this.auth.options.trustedOrigins.includes(origin)
    )
      throw new ForbiddenException('Untrusted origin');
    const next = password(body, 'newPassword');
    const current = value(body, 'currentPassword');
    if (current === next)
      throw new BadRequestException('Choose a different password');
    await this.db.transaction(async (tx) => {
      const [person] = await tx
        .select()
        .from(user)
        .where(eq(user.id, actorId))
        .for('update');
      if (!person?.enabled) throw new ForbiddenException();
      const [credential] = await tx
        .select()
        .from(account)
        .where(
          and(
            eq(account.userId, actorId),
            eq(account.providerId, 'credential'),
          ),
        );
      if (
        !credential?.password ||
        !(await verifyPassword({
          hash: credential.password,
          password: current,
        }))
      )
        throw new ForbiddenException('Invalid password');
      await tx
        .update(account)
        .set({ password: await hashPassword(next) })
        .where(eq(account.id, credential.id));
      await tx
        .update(user)
        .set({ mustChangePassword: false })
        .where(eq(user.id, actorId));
      await tx.delete(session).where(eq(session.userId, actorId));
    });
    return { success: true, signInRequired: true };
  }
}
