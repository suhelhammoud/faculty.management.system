import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { PERMISSION, PERMISSION_CATALOG } from '@project/authorization';
import { createDb } from '@project/db';
import { auditLog, permissions, roles, rolePermissions, userRoles, user } from '@project/db/schema';
import { eq, sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { AuthGuard } from '../../auth/auth.guard.js';
import type { Auth } from '../../auth/auth.provider.js';
import { AuthorizationService } from '../../auth/authorization.service.js';
import { adminOriginProtection } from '../../auth/admin-origin-protection.js';
import { DATABASE } from '../../database/database.constants.js';
import { FacultyPositionsController } from './faculty-positions.controller.js';
import { FacultyPositionsService } from './faculty-positions.service.js';

const connectionString = process.env.FACULTY_POSITIONS_TEST_DATABASE_URL;
describe.skipIf(!connectionString)('Faculty Positions API integration', () => {
  const databaseName = `faculty_positions_${randomUUID().replaceAll('-', '')}_test`;
  const origin = 'http://faculty.test';
  const path = '/api/admin/faculty-positions';
  let control: ReturnType<typeof createDb> | undefined;
  let isolated: ReturnType<typeof createDb> | undefined;
  let created = false;
  let app: INestApplication | undefined;

  beforeAll(async () => {
    const url = new URL(connectionString!);
    if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
      throw new Error('Use a loopback PostgreSQL connection');
    }
    control = createDb(url.toString());
    await control.db.execute(sql.raw(`CREATE DATABASE "${databaseName}"`));
    created = true;
    url.pathname = '/' + databaseName;
    isolated = createDb(url.toString());
    const { db } = isolated;
    await migrate(db, { migrationsFolder: '../../packages/db/drizzle' });
    await db.insert(user).values([
      {
        id: 'admin',
        name: 'Administrator',
        email: 'admin@example.invalid',
        approved: true,
        mustChangePassword: false,
      },
      {
        id: 'reader',
        name: 'Reader',
        email: 'reader@example.invalid',
        approved: true,
        mustChangePassword: false,
      },
      { id: 'colleague', name: 'Colleague', email: 'colleague@example.invalid', approved: true },
      {
        id: 'disabled',
        name: 'Disabled',
        email: 'disabled@example.invalid',
        approved: true,
        enabled: false,
      },
      { id: 'unapproved', name: 'Unapproved', email: 'unapproved@example.invalid' },
    ]);
    await db.insert(permissions).values([...PERMISSION_CATALOG]);
    await db.insert(roles).values([
      { id: 'manager', name: 'Manager' },
      { id: 'reader', name: 'Reader' },
    ]);
    await db.insert(rolePermissions).values([
      { roleId: 'manager', permission: PERMISSION.facultyPositions.read },
      { roleId: 'manager', permission: PERMISSION.facultyPositions.manage },
      { roleId: 'reader', permission: PERMISSION.facultyPositions.read },
    ]);
    await db.insert(userRoles).values([
      { userId: 'admin', roleId: 'manager' },
      { userId: 'reader', roleId: 'reader' },
    ]);
    const auth = {
      api: {
        getSession: async ({ headers }: { headers: Headers }) => {
          const id = headers.get('x-test-caller');
          return id ? { user: { id } } : null;
        },
      },
    } as unknown as Auth;
    const module = await Test.createTestingModule({
      controllers: [FacultyPositionsController],
      providers: [
        FacultyPositionsService,
        AuthorizationService,
        { provide: DATABASE, useValue: db },
      ],
    }).compile();
    app = module.createNestApplication();
    app.use(adminOriginProtection([origin]));
    app.useGlobalGuards(new AuthGuard(new Reflector(), auth, module.get(AuthorizationService)));
    await app.init();
  }, 30000);

  afterAll(async () => {
    try {
      await app?.close();
      await isolated?.pool.end();
      if (created) await control?.db.execute(sql.raw(`DROP DATABASE "${databaseName}"`));
    } finally {
      await control?.pool.end();
    }
  });

  it('manages positions and preserves history and permissions across concurrent handovers', async () => {
    const api = request(app!.getHttpServer());
    const catalog = (caller: string) => api.get(path).set('x-test-caller', caller);
    const {
      body: { positions, canManage },
    } = await catalog('reader').expect(200);
    expect(canManage).toBe(false);
    expect(positions).toHaveLength(11);
    expect(
      positions.every(
        (position: { currentAppointment: unknown }) => position.currentAppointment === null,
      ),
    ).toBe(true);
    expect(
      await isolated!.db.select().from(userRoles).where(eq(userRoles.userId, 'colleague')),
    ).toEqual([]);
    await api.get(path).expect(401);

    const create = (caller: string) =>
      api
        .post(path)
        .set('Origin', origin)
        .set('x-test-caller', caller)
        .send({ code: 'head-library', titleEn: 'Head of the Library' });
    await create('reader').expect(403);
    const {
      body: { id },
    } = await create('admin').expect(201);
    await create('admin').expect(409);
    await api
      .patch(`${path}/${id}`)
      .set('Origin', origin)
      .set('x-test-caller', 'admin')
      .send({ titleEn: 'Library Director' })
      .expect(200);

    const put = (
      userId: string | null,
      expectedAppointmentId: string | null,
      caller = 'admin',
      appointmentDate?: string,
    ) =>
      api
        .put(`${path}/${id}/holder`)
        .set('Origin', origin)
        .set('x-test-caller', caller)
        .send({ userId, expectedAppointmentId, appointmentDate });

    await put('colleague', null, 'reader').expect(403);
    await put('disabled', null).expect(400);
    await put('unapproved', null).expect(400);
    await put('admin', null, 'admin', '2026-02-30').expect(400);
    const {
      body: { appointmentId: first },
    } = await put('admin', null, 'admin', '2026-10-19').expect(200);
    const attempts = await Promise.all([put('colleague', first), put('reader', first)]);
    expect(attempts.map(({ status }) => status).sort((left, right) => left - right)).toEqual([
      200, 409,
    ]);
    const second = attempts.find(({ status }) => status === 200)!.body.appointmentId;
    const current = (await catalog('admin').expect(200)).body.positions.find(
      (position: { id: string }) => position.id === id,
    );
    expect(current).toMatchObject({
      titleEn: 'Library Director',
      currentAppointment: { id: second },
    });
    await put(null, second).expect(200);

    const { body: history } = await api
      .get(`${path}/${id}/appointments`)
      .set('x-test-caller', 'reader')
      .expect(200);
    expect(history).toHaveLength(2);
    const outgoing = history.find((entry: { id: string }) => entry.id === first);
    const incoming = history.find((entry: { id: string }) => entry.id === second);
    expect(outgoing.appointmentDate).toBe('2026-10-19');
    expect(incoming.appointmentDate).toBe(incoming.startedAt.slice(0, 10));
    expect(outgoing.endedAt).toBe(incoming.startedAt);
    expect(incoming.endedAt).toBeTruthy();
    const audit = await isolated!.db
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, 'faculty-positions:update-holder'));
    expect(audit).toHaveLength(3);
    expect(audit.every(({ actorId }) => actorId === 'admin')).toBe(true);
    expect(await isolated!.db.select().from(userRoles)).toHaveLength(2);
  });
});
