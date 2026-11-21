import { sql } from 'drizzle-orm';
import { check, index, integer, pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core';
import { user } from './users.js';

export const roles = pgTable('roles', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  description: text('description'),
});

export const permissions = pgTable('permissions', {
  key: text('key').primaryKey(),
  description: text('description'),
});

export const userRoles = pgTable(
  'user_roles',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    roleId: text('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.roleId] })],
);

export const rolePermissions = pgTable(
  'role_permissions',
  {
    roleId: text('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    permission: text('permission')
      .notNull()
      .references(() => permissions.key, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.roleId, t.permission] })],
);

export const resourceAcl = pgTable(
  'resource_acl',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    resourceType: text('resource_type').notNull(),
    resourceId: text('resource_id').notNull(),
    permission: text('permission')
      .notNull()
      .references(() => permissions.key),
    effect: text('effect', { enum: ['allow', 'deny'] }).notNull(),
  },
  (t) => [index('acl_lookup').on(t.userId, t.resourceType, t.resourceId, t.permission)],
);

export const elevatedGrants = pgTable(
  'elevated_grants',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    permission: text('permission')
      .notNull()
      .references(() => permissions.key),
    resourceType: text('resource_type'),
    resourceId: text('resource_id'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    maxUses: integer('max_uses').notNull(),
    remainingUses: integer('remaining_uses').notNull(),
    grantedBy: text('granted_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (t) => [
    index('elevated_grants_lookup').on(t.userId, t.permission, t.expiresAt),
    check('elevated_grants_scope', sql`(${t.resourceType} is null) = (${t.resourceId} is null)`),
    check(
      'elevated_grants_uses',
      sql`${t.maxUses} > 0 and ${t.remainingUses} between 0 and ${t.maxUses}`,
    ),
  ],
);

export const auditLog = pgTable('audit_log', {
  id: text('id').primaryKey(),
  actorId: text('actor_id').notNull(),
  action: text('action').notNull(),
  targetId: text('target_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
