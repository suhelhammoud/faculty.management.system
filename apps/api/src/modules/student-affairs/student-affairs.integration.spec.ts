import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { PERMISSION, ADMINISTRATOR_DEFAULT_ROLE } from '@project/authorization';
import { createDb } from '@project/db';
import {
  auditLog,
  permissions,
  rolePermissions,
  roles,
  studentAffairsPromotionGrants,
  students,
  user,
  userRoles,
} from '@project/db/schema';
import { eq, inArray, sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { adminOriginProtection } from '../../auth/admin-origin-protection.js';
import { AuthGuard } from '../../auth/auth.guard.js';
import type { Auth } from '../../auth/auth.provider.js';
import { AuthorizationService } from '../../auth/authorization.service.js';
import { DATABASE } from '../../database/database.constants.js';
import { StudentAffairsController } from './student-affairs.controller.js';
import { StudentAffairsService } from './student-affairs.service.js';

const databaseName = process.env.STUDENT_AFFAIRS_TEST_DATABASE_NAME;
const base = '/api/student-affairs';
const registry = `${base}/students`;
const grantPath = `${base}/promotion-grants`;
const origin = 'https://student-affairs.test';
const permissionsByRole = {
  staff: [PERMISSION.studentAffairs.read],
  admin: [PERMISSION.studentAffairs.read, PERMISSION.studentAffairs.administer],
  dean: [PERMISSION.studentAffairs.grantPromotions],
};
const actors = {
  first: randomUUID(),
  second: randomUUID(),
  third: randomUUID(),
  admin: randomUUID(),
  dean: randomUUID(),
  outsider: randomUUID(),
};
type Actor = keyof typeof actors;

it('requires explicit assignment of Student Affairs permissions after platform bootstrap', () => {
  for (const permission of Object.values(PERMISSION.studentAffairs))
    expect(ADMINISTRATOR_DEFAULT_ROLE.permissions).not.toContain(permission);
});

describe.skipIf(!databaseName)('Student Affairs HTTP API', () => {
  let connection: ReturnType<typeof createDb>;
  let app: INestApplication;
  const client = () => request(app.getHttpServer());
  const headers = (actor: Actor) => ({ origin, 'x-test-actor': actors[actor] });
  const profile = (currentStudyYear = 1) => ({
    academicId: `00${randomUUID()}`,
    firstName: 'ليلى',
    fatherName: 'خالد',
    lastName: 'أحمد',
    currentStudyYear,
    mobileNumber: '0123456789',
    gradeAverage: '91.25',
  });
  const assign = (target: Actor, year: number) =>
    client()
      .put(`${base}/staff-year-assignments/${actors[target]}/${year}`)
      .set(headers('admin'))
      .expect(204);
  const register = async (actor: Actor, year: number) => {
    const { body } = await client()
      .post(registry)
      .set(headers(actor))
      .send(profile(year))
      .expect(201);
    return body.studentId as string;
  };
  const changeYear = (id: string, year: number, actor: Actor = 'admin') =>
    client()
      .put(`${registry}/${id}/current-study-year`)
      .set(headers(actor))
      .send({ currentStudyYear: year });
  const expiry = () => new Date(Date.now() + 3_600_000).toISOString();
  const grant = (issuer: Actor, recipient: Actor, expiresAt = expiry()) =>
    client().post(grantPath).set(headers(issuer)).send({ userId: actors[recipient], expiresAt });
  const revoke = (id: string, actor: Actor = 'dean') =>
    client().delete(`${grantPath}/${id}`).set(headers(actor));

  beforeAll(async () => {
    if (!databaseName?.endsWith('_test')) throw new Error('Use a dedicated _test database');
    if (!process.env.DATABASE_URL) process.loadEnvFile('../../packages/db/.env.db');
    const url = new URL(process.env.DATABASE_URL!);
    url.pathname = `/${databaseName}`;
    connection = createDb(url.toString());
    await migrate(connection.db, { migrationsFolder: '../../packages/db/drizzle' });
    const { db } = connection;
    await db
      .insert(permissions)
      .values(Object.values(PERMISSION.studentAffairs).map((key) => ({ key, description: key })))
      .onConflictDoNothing();
    await db.insert(user).values(
      Object.entries(actors).map(([name, id]) => ({
        id,
        name,
        email: `${id}@student-affairs.invalid`,
        approved: true,
        mustChangePassword: false,
      })),
    );
    const staffRole = randomUUID();
    const adminRole = randomUUID();
    const deanRole = randomUUID();
    await db.insert(roles).values([staffRole, adminRole, deanRole].map((id) => ({ id, name: id })));
    await db
      .insert(rolePermissions)
      .values([
        ...permissionsByRole.staff.map((permission) => ({ roleId: staffRole, permission })),
        ...permissionsByRole.admin.map((permission) => ({ roleId: adminRole, permission })),
        ...permissionsByRole.dean.map((permission) => ({ roleId: deanRole, permission })),
      ]);
    await db.insert(userRoles).values([
      ...[actors.first, actors.second, actors.third].map((userId) => ({
        userId,
        roleId: staffRole,
      })),
      { userId: actors.admin, roleId: adminRole },
      { userId: actors.dean, roleId: deanRole },
    ]);
    const auth = {
      api: {
        getSession: async ({ headers }: { headers: Headers }) => {
          const id = headers.get('x-test-actor');
          return id ? { user: { id } } : null;
        },
      },
    } as unknown as Auth;
    const module = await Test.createTestingModule({
      controllers: [StudentAffairsController],
      providers: [
        StudentAffairsService,
        { provide: DATABASE, useValue: db },
        { provide: AuthorizationService, useValue: new AuthorizationService(db) },
      ],
    }).compile();
    app = module.createNestApplication();
    app.use(adminOriginProtection([origin], [base]));
    app.useGlobalGuards(new AuthGuard(new Reflector(), auth, new AuthorizationService(db)));
    await app.init();
    await assign('first', 1);
    await assign('second', 2);
    await assign('third', 1);
  }, 30_000);

  afterAll(async () => {
    await app?.close();
    await connection?.pool.end();
  });

  it('supports private cross-year reads, Arabic name search, and overlapping assignments', async () => {
    const values = profile();
    const { body } = await client().post(registry).set(headers('first')).send(values).expect(201);
    const path = `${registry}/${body.studentId}`;
    await client().get(path).expect(401);
    await client().get(path).set(headers('outsider')).expect(403);
    await client().get(path).set(headers('dean')).expect(403);
    await client()
      .get(path)
      .set(headers('second'))
      .expect(200)
      .expect((result) => {
        expect(result.body).toMatchObject({
          fatherName: values.fatherName,
          mobileNumber: values.mobileNumber,
        });
        expect(result.body).not.toHaveProperty('userId');
      });
    await client()
      .get(registry)
      .query({ studyYear: '1', search: 'ليلى أحمد', pageSize: '100' })
      .set(headers('second'))
      .expect(200)
      .expect((result) => {
        const match = result.body.records.find(
          (student: { academicId: string }) => student.academicId === values.academicId,
        );
        expect(match).toMatchObject({ fatherName: values.fatherName, currentStudyYear: 1 });
        expect(match).not.toHaveProperty('mobileNumber');
      });
    await client().patch(path).set(headers('second')).send({ notes: 'Denied' }).expect(403);
    await client().patch(path).set(headers('third')).send({ notes: 'Allowed' }).expect(200);
    await client()
      .patch(path)
      .set(headers('first'))
      .set('origin', 'https://other.test')
      .send({ notes: 'Denied' })
      .expect(403);
    await client().patch(path).set(headers('first')).send({ currentStudyYear: 2 }).expect(400);
    await client().post(registry).set(headers('first')).send(values).expect(409);
    await client().post(registry).set(headers('second')).send(profile(1)).expect(403);
    await client().post(registry).set(headers('first')).send(profile(6)).expect(400);
    const { fatherName: _fatherName, ...missingName } = profile();
    await client().post(registry).set(headers('first')).send(missingName).expect(400);
    const secondId = await register('first', 1);
    await client()
      .patch(`${registry}/${secondId}`)
      .set(headers('first'))
      .send({ academicId: values.academicId })
      .expect(409);
    const audit = await connection.db
      .select()
      .from(auditLog)
      .where(eq(auditLog.targetId, body.studentId));
    expect(audit.map(({ actorId }) => actorId).sort()).toEqual([actors.first, actors.third].sort());
  });

  it('preserves legacy records and revokes a year assignment without removing read access', async () => {
    const [old] = await connection.db
      .insert(students)
      .values({ academicId: randomUUID() })
      .returning();
    const path = `${registry}/${old.studentId}`;
    await client()
      .get(path)
      .set(headers('first'))
      .expect(200)
      .expect((result) => {
        expect(result.body).toMatchObject({
          firstName: null,
          fatherName: null,
          lastName: null,
          currentStudyYear: null,
        });
      });
    await client().patch(path).set(headers('first')).send({ firstName: 'Anna' }).expect(403);
    await changeYear(old.studentId, 1).expect(200);
    await assign('third', 3);
    await assign('third', 3);
    await client()
      .get(`${base}/staff-year-assignments`)
      .set(headers('admin'))
      .expect(200)
      .expect((result) =>
        expect(result.body).toContainEqual({ userId: actors.third, name: 'third', years: [1, 3] }),
      );
    await client()
      .delete(`${base}/staff-year-assignments/${actors.third}/3`)
      .set(headers('admin'))
      .expect(204);
    await client()
      .delete(`${base}/staff-year-assignments/${actors.third}/3`)
      .set(headers('admin'))
      .expect(204);
    await client().get(path).set(headers('third')).expect(200);
    await client().post(registry).set(headers('third')).send(profile(3)).expect(403);
  });

  it('limits grants to the dean and uses one window for multiple moves while preserving annual history', async () => {
    const id = await register('first', 1);
    const other = await register('first', 1);
    const years = `${registry}/${id}/academic-years`;
    const annual = { academicYear: '2026-2027', year: 1, remarks: 'Initial' };
    await client()
      .post(years)
      .set(headers('first'))
      .send({ ...annual, academicYear: '2026-2028' })
      .expect(400);
    await client()
      .post(years)
      .set(headers('second'))
      .send({ ...annual, year: 2 })
      .expect(403);
    await client().post(years).set(headers('first')).send(annual).expect(201);
    await client().post(years).set(headers('third')).send(annual).expect(409);
    await changeYear(id, 2).expect(403);
    await grant('admin', 'admin').expect(403);
    await grant('dean', 'first').expect(403);
    await grant('dean', 'admin', '2000-01-01T00:00:00Z').expect(400);
    const attempts = await Promise.all([grant('dean', 'admin'), grant('dean', 'admin')]);
    expect(attempts.map(({ status }) => status).sort()).toEqual([201, 409]);
    const idOfGrant = attempts.find(({ status }) => status === 201)!.body.id as string;
    try {
      await client()
        .get(`${grantPath}/current`)
        .set(headers('admin'))
        .expect(200)
        .expect((result) => expect(result.body.grant.id).toBe(idOfGrant));
      await changeYear(id, 2, 'first').expect(403);
      await changeYear(id, 2).expect(200);
      await changeYear(other, 3).expect(200);
      await client()
        .patch(`${registry}/${id}`)
        .set(headers('first'))
        .send({ notes: 'Denied' })
        .expect(403);
      await client()
        .patch(`${registry}/${id}`)
        .set(headers('second'))
        .send({ notes: 'Allowed' })
        .expect(200);
      await client()
        .patch(`${years}/2026-2027`)
        .set(headers('second'))
        .send({ remarks: 'Denied' })
        .expect(403);
      await client()
        .patch(`${years}/2026-2027`)
        .set(headers('first'))
        .send({ remarks: 'Corrected' })
        .expect(200);
      await client()
        .patch(`${years}/2026-2027`)
        .set(headers('first'))
        .send({ year: 2 })
        .expect(403);
      await client()
        .get(years)
        .set(headers('second'))
        .expect(200)
        .expect((result) => {
          expect(result.body).toMatchObject([{ year: 1, remarks: 'Corrected' }]);
        });
      await revoke(idOfGrant, 'admin').expect(403);
    } finally {
      await revoke(idOfGrant).expect(204);
    }
    await changeYear(id, 2).expect(200);
    await changeYear(id, 3).expect(403);
  });

  it('serializes revocation with a promotion and rejects expired grants', async () => {
    const id = await register('first', 1);
    const { body: first } = await grant('dean', 'admin').expect(201);
    const [move, cancellation] = await Promise.all([changeYear(id, 2), revoke(first.id)]);
    expect(cancellation.status).toBe(204);
    expect([200, 403]).toContain(move.status);
    await changeYear(id, 3).expect(403);
    const { body: second } = await grant('dean', 'admin').expect(201);
    await connection.db
      .update(studentAffairsPromotionGrants)
      .set({
        issuedAt: sql`clock_timestamp() - interval '2 hours'`,
        expiresAt: sql`clock_timestamp() - interval '1 hour'`,
      })
      .where(eq(studentAffairsPromotionGrants.id, second.id));
    await changeYear(id, 3).expect(403);
    const entries = await connection.db
      .select()
      .from(auditLog)
      .where(inArray(auditLog.actorId, [actors.admin, actors.dean]));
    const transitions = entries.filter(
      (entry) =>
        entry.action === 'student-affairs:current-year-change' &&
        JSON.parse(entry.targetId).studentId === id,
    );
    expect(transitions).toHaveLength(move.status === 200 ? 1 : 0);
    if (move.status === 200)
      expect(JSON.parse(transitions[0].targetId)).toMatchObject({
        previousYear: 1,
        currentStudyYear: 2,
        grantId: first.id,
      });
  });
});
