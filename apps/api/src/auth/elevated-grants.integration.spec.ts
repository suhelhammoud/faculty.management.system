import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { PERMISSION } from '@project/authorization';
import { createDb, eq } from '@project/db';
import {
  auditLog,
  elevatedGrants,
  permissions,
  resourceAcl,
  rolePermissions,
  roles,
  user,
  userRoles,
} from '@project/db/schema';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DATABASE } from '../database/database.constants.js';
import { AdminController } from './admin.controller.js';
import { AuthGuard } from './auth.guard.js';
import { AUTH, type Auth } from './auth.provider.js';
import { AuthorizationService } from './authorization.service.js';
import { ElevatedGrantsController } from './elevated-grants.controller.js';

const databaseName = process.env.ELEVATED_GRANTS_TEST_DATABASE_NAME;
const issuer = randomUUID();
const recipient = randomUUID();
const target = randomUUID();
const unrelated = randomUUID();
const issuerRole = randomUUID();
const existingUsername = `test_${issuer.slice(0, 8)}`;
const grantsPath = `/api/admin/users/${recipient}/elevated-grants`;

describe.skipIf(!databaseName)('Elevated grants HTTP integration', () => {
  let connection: ReturnType<typeof createDb>;
  let app: INestApplication;
  const client = () => request(app.getHttpServer());
  const header = (actor: string) => ({ 'x-test-actor': actor });
  const issue = (
    permission: string,
    options: { resourceId?: string; maxUses?: number; expiresAt?: string } = {},
  ) =>
    client()
      .post(grantsPath)
      .set(header(issuer))
      .send({
        permission,
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        maxUses: 1,
        ...options,
      });
  const approve = (id: string, actor = recipient) =>
    client().post(`/api/admin/users/${id}/approve`).set(header(actor));
  const list = async () => {
    const response = await client().get(grantsPath).set(header(issuer)).expect(200);
    return response.body.grants as {
      id: string;
      remainingUses: number;
      revokedAt: string | null;
    }[];
  };

  beforeAll(async () => {
    if (!databaseName?.endsWith('_test')) throw new Error('Use a dedicated test database');
    if (!process.env.DATABASE_URL) process.loadEnvFile('../../packages/db/.env.db');
    const url = new URL(process.env.DATABASE_URL!);
    url.pathname = `/${databaseName}`;
    connection = createDb(url.toString());
    const { db } = connection;
    await migrate(db, { migrationsFolder: '../../packages/db/drizzle' });
    const keys = [PERMISSION.users.assignRoles, PERMISSION.users.approve, PERMISSION.users.create];
    await db
      .insert(permissions)
      .values(keys.map((key) => ({ key })))
      .onConflictDoNothing();
    await db.insert(user).values(
      [issuer, recipient, target, unrelated].map((id) => ({
        id,
        name: id,
        email: `${id}@accounts.invalid`,
        username: id === issuer ? existingUsername : null,
        approved: true,
        enabled: true,
        mustChangePassword: false,
      })),
    );
    await db.insert(roles).values({ id: issuerRole, name: issuerRole });
    await db
      .insert(rolePermissions)
      .values(keys.map((permission) => ({ roleId: issuerRole, permission })));
    await db.insert(userRoles).values({ userId: issuer, roleId: issuerRole });
    const auth = {
      api: {
        getSession: async ({ headers }: { headers: Headers }) => ({
          user: { id: headers.get('x-test-actor') },
        }),
      },
    } as unknown as Auth;
    const module = await Test.createTestingModule({
      controllers: [AdminController, ElevatedGrantsController],
      providers: [
        AuthorizationService,
        { provide: DATABASE, useValue: db },
        { provide: AUTH, useValue: auth },
      ],
    }).compile();
    app = module.createNestApplication({ logger: false });
    app.useGlobalGuards(new AuthGuard(new Reflector(), auth, module.get(AuthorizationService)));
    await app.init();
  }, 30_000);

  afterAll(async () => {
    await app?.close();
    await connection?.pool.end();
  });

  it('spends one scoped use across concurrent requests', async () => {
    const { body: grant } = await issue(PERMISSION.users.approve, { resourceId: target }).expect(
      201,
    );
    await approve(unrelated).expect(403);
    const attempts = await Promise.all([approve(target), approve(target)]);
    expect(attempts.map((response) => response.status).sort((a, b) => a - b)).toEqual([201, 403]);
    expect((await list()).find(({ id }) => id === grant.id)?.remainingUses).toBe(0);
    const audit = await connection.db
      .select()
      .from(auditLog)
      .where(eq(auditLog.actorId, recipient));
    expect(audit.filter(({ action }) => action === 'elevated-grants:use')).toHaveLength(1);
  });

  it('spends a validated attempt when the action fails', async () => {
    const { body: grant } = await issue(PERMISSION.users.create).expect(201);
    const create = (body: object) =>
      client().post('/api/admin/users').set(header(recipient)).send(body);
    await create({ username: 'x' }).expect(400);
    expect((await list()).find(({ id }) => id === grant.id)?.remainingUses).toBe(1);
    await create({
      username: existingUsername,
      password: 'temporary-test-password',
      name: 'Duplicate',
    }).expect(500);
    expect((await list()).find(({ id }) => id === grant.id)?.remainingUses).toBe(0);
    await create({
      username: `other_${target.slice(0, 8)}`,
      password: 'temporary-test-password',
      name: 'Other',
    }).expect(403);
  });

  it('honors expiry, revocation, and record denies', async () => {
    await issue(PERMISSION.users.approve, { expiresAt: new Date(0).toISOString() }).expect(400);
    const { body: grant } = await issue(PERMISSION.users.approve, {
      resourceId: unrelated,
      maxUses: 2,
    }).expect(201);
    const ruleId = randomUUID();
    await connection.db.insert(resourceAcl).values({
      id: ruleId,
      userId: recipient,
      resourceType: 'users',
      resourceId: unrelated,
      permission: PERMISSION.users.approve,
      effect: 'allow',
    });
    await approve(unrelated).expect(201);
    expect((await list()).find(({ id }) => id === grant.id)?.remainingUses).toBe(2);
    await connection.db
      .update(resourceAcl)
      .set({ effect: 'deny' })
      .where(eq(resourceAcl.id, ruleId));
    await approve(unrelated).expect(403);
    expect((await list()).find(({ id }) => id === grant.id)?.remainingUses).toBe(2);
    await connection.db.delete(resourceAcl).where(eq(resourceAcl.id, ruleId));
    await client().delete(`${grantsPath}/${grant.id}`).set(header(issuer)).expect(200);
    await approve(unrelated).expect(403);
    expect((await list()).find(({ id }) => id === grant.id)?.revokedAt).toBeTruthy();
    const { body: expired } = await issue(PERMISSION.users.approve, {
      resourceId: unrelated,
    }).expect(201);
    await connection.db
      .update(elevatedGrants)
      .set({ expiresAt: new Date(0) })
      .where(eq(elevatedGrants.id, expired.id));
    await approve(unrelated).expect(403);
    expect((await list()).find(({ id }) => id === expired.id)?.remainingUses).toBe(1);
  });
});
