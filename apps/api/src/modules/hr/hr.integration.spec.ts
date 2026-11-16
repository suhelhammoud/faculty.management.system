import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createDb } from '@project/db';
import { eq, sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import {
  user,
  roles,
  rolePermissions,
  userRoles,
  hrEmployees,
  hrEmploymentRecords,
  hrAuditLog,
  permissions,
} from '@project/db/schema';
import { DATABASE } from '../../database/database.constants.js';
import { AUTH, type Auth } from '../../auth/auth.provider.js';
import { AuthGuard } from '../../auth/auth.guard.js';
import { AuthorizationService } from '../../auth/authorization.service.js';
import { adminOriginProtection } from '../../auth/admin-origin-protection.js';
import { HrController } from './hr.controller.js';
import { HrEmployeesService } from './hr-employees.service.js';
import { HrReferenceService } from './hr-reference.service.js';
import { HR_PERMISSIONS, provisionHrPermissions } from './hr.permissions.js';
import { employeeQuery } from './hr.schemas.js';

// Opt in explicitly. The database name must end in _test; never use faculty_db.
const databaseName = process.env.HR_TEST_DATABASE_NAME;
describe.skipIf(!databaseName)('HR API integration (isolated PostgreSQL)', () => {
  let connection: ReturnType<typeof createDb>;
  let app: INestApplication;
  let employees: HrEmployeesService;
  const actorId = randomUUID();
  let caller: string | null = actorId;
  const origin = 'http://hr.test';
  const base = '/api/admin/hr';

  beforeAll(async () => {
    if (!databaseName?.endsWith('_test'))
      throw new Error('HR_TEST_DATABASE_NAME must end in _test');
    process.loadEnvFile('../../packages/db/.env');
    const url = new URL(process.env.DATABASE_URL!);
    url.pathname = `/${databaseName}`;
    connection = createDb(url.toString());
    const { db } = connection;
    await migrate(db, { migrationsFolder: '../../packages/db/drizzle' });
    // This database was explicitly designated for disposable integration testing.
    const names = await db.execute<{ tablename: string }>(
      sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`,
    );
    await db.execute(
      sql.raw(`TRUNCATE ${names.rows.map((r) => `"${r.tablename}"`).join(', ')} CASCADE`),
    );
    await db.insert(roles).values({ id: 'test-admin', name: 'Administrator' });
    // Exercise permission migration on an installation with an existing admin role.
    await db.execute(
      sql.raw(readFileSync('../../packages/db/drizzle/0001_hr-admin-permissions.sql', 'utf8')),
    );
    await db.insert(user).values({
      id: actorId,
      name: 'HR test admin',
      email: 'hr-test@accounts.invalid',
      approved: true,
      enabled: true,
      mustChangePassword: false,
    });
    await db.insert(userRoles).values({ userId: actorId, roleId: 'test-admin' });
    const auth = {
      api: { getSession: async () => (caller ? { user: { id: caller } } : null) },
    } as unknown as Auth;
    const module = await Test.createTestingModule({
      controllers: [HrController],
      providers: [
        HrEmployeesService,
        HrReferenceService,
        { provide: DATABASE, useValue: db },
        { provide: AUTH, useValue: auth },
      ],
    }).compile();
    employees = module.get(HrEmployeesService);
    app = module.createNestApplication();
    app.use(adminOriginProtection([origin]));
    app.useGlobalGuards(new AuthGuard(new Reflector(), auth, new AuthorizationService(db)));
    await app.init();
  }, 30000);

  afterAll(async () => {
    await app?.close();
    await connection?.pool.end();
  });

  it('provisions migration and fresh-bootstrap permissions idempotently', async () => {
    const { db } = connection;
    expect(await db.select().from(permissions)).toHaveLength(5);
    expect(await db.select().from(rolePermissions)).toHaveLength(10);
    await db.transaction((tx) => provisionHrPermissions(tx, 'test-admin'));
    await db.transaction((tx) => provisionHrPermissions(tx, 'test-admin'));
    expect(await db.select().from(rolePermissions)).toHaveLength(10);
    const freshRole = randomUUID();
    await db.insert(roles).values({ id: freshRole, name: 'Fresh bootstrap role' });
    await db.transaction((tx) => provisionHrPermissions(tx, freshRole));
    expect(
      await db.select().from(rolePermissions).where(eq(rolePermissions.roleId, freshRole)),
    ).toHaveLength(HR_PERMISSIONS.length);
  });

  it('enforces authentication, permissions, origin and validation', async () => {
    const api = request(app.getHttpServer());
    caller = null;
    await api.get(`${base}/employees`).expect(401);
    caller = randomUUID();
    await api.get(`${base}/employees`).expect(403);
    caller = actorId;
    await api.post(`${base}/employees`).send({}).expect(403);
    await api.post(`${base}/employees`).set('Origin', 'http://evil.test').send({}).expect(403);
    await api.post(`${base}/employees`).set('Origin', origin).send({}).expect(400);
    await api
      .post(`${base}/employees`)
      .set('Origin', origin)
      .send({ employeeNumber: '1', firstNameAr: 'A', lastNameAr: 'B', userId: actorId })
      .expect(400);
    await api.get(`${base}/employees/not-a-uuid`).expect(400);
    await api.get(`${base}/employees?pageSize=101`).expect(400);
    await api.get(`${base}/employees/${randomUUID()}`).expect(404);
  });

  it('maintains profiles, setup data and current employment with audit records', async () => {
    const api = request(app.getHttpServer());
    const post = (path: string, body: unknown) =>
      api.post(`${base}/${path}`).set('Origin', origin).send(body);
    const patch = (path: string, body: unknown) =>
      api.patch(`${base}/${path}`).set('Origin', origin).send(body);
    const profile = {
      employeeNumber: 'EMP-001',
      firstNameAr: 'سارة',
      lastNameAr: 'حسن',
      phoneNumber: '123',
    };
    const created = await post('employees', profile).expect(201);
    const id = created.body.employeeId;
    expect(created.body).not.toHaveProperty('userId');
    expect((await api.get(`${base}/employees/${id}`).expect(200)).body.employment).toBeNull();
    await post('employees', profile).expect(409);
    await patch(`employees/${id}`, {}).expect(400);
    await patch(`employees/${id}`, { phoneNumber: null }).expect(200);
    const category = (
      await post('staff-categories', { code: 'ADMIN', nameAr: 'إداري' }).expect(201)
    ).body;
    const category2 = (await post('staff-categories', { code: 'OTHER', nameAr: 'آخر' }).expect(201))
      .body;
    const position = (
      await post('positions', {
        categoryId: category.categoryId,
        code: 'CLERK',
        nameAr: 'كاتب',
        isAcademic: 1,
      }).expect(201)
    ).body;
    const updated = await patch(`positions/${position.positionId}`, { nameEn: 'Clerk' }).expect(
      200,
    );
    expect(updated.body.isAcademic).toBe(1);
    expect(
      (await api.get(`${base}/positions?categoryId=${category2.categoryId}`).expect(200)).body,
    ).toHaveLength(0);
    await post('academic-ranks', { code: 'R1', nameAr: 'رتبة', rankOrder: 6 }).expect(400);
    const rank = (
      await post('academic-ranks', { code: 'R1', nameAr: 'رتبة', rankOrder: 1 }).expect(201)
    ).body;
    const scheme = (await post('grade-schemes', { code: 'S1', nameAr: 'سلم' }).expect(201)).body;
    const grade = (
      await post('employment-grades', { schemeId: scheme.schemeId, gradeNumber: 1 }).expect(201)
    ).body;
    await post('employment-grades', { schemeId: scheme.schemeId, gradeNumber: 1 }).expect(409);
    const employment = {
      categoryId: category.categoryId,
      positionId: position.positionId,
      academicRankId: rank.rankId,
      gradeId: grade.gradeId,
      employmentRegime: 'Faculty staff',
      startDate: '2026-01-01',
    };
    const put = (body: unknown) =>
      api.put(`${base}/employees/${id}/employment`).set('Origin', origin).send(body);
    await put({ ...employment, categoryId: category2.categoryId }).expect(400);
    await put({ ...employment, endDate: '2025-01-01' }).expect(400);
    await put({ ...employment, gradeId: randomUUID() }).expect(400);
    const writes = await Promise.all([put(employment), put({ ...employment, department: 'HR' })]);
    expect(writes.map((r) => r.status)).toEqual([200, 200]);
    expect(writes[0].body.employmentRecordId).toBe(writes[1].body.employmentRecordId);
    expect(
      await connection.db
        .select()
        .from(hrEmploymentRecords)
        .where(eq(hrEmploymentRecords.employeeId, id)),
    ).toHaveLength(1);
    await patch(`positions/${position.positionId}`, { categoryId: category2.categoryId }).expect(
      400,
    );
    const list = (
      await api
        .get(
          `${base}/employees?search=سارة&categoryId=${category.categoryId}&positionId=${position.positionId}&employmentStatus=active&pageSize=1`,
        )
        .expect(200)
    ).body;
    expect(list.total).toBe(1);
    expect(list.records[0]).not.toHaveProperty('phoneNumber');
    expect(
      (await api.get(`${base}/employees?page=2&pageSize=1`).expect(200)).body.records,
    ).toHaveLength(0);
    expect(
      await connection.db.select().from(hrAuditLog).where(eq(hrAuditLog.employeeId, id)),
    ).toHaveLength(4);
  });

  it('rolls back data when its audit insert fails and preserves historical records', async () => {
    await expect(
      employees.create(
        { employeeNumber: 'ROLLBACK', firstNameAr: 'A', lastNameAr: 'B' },
        'missing-actor',
      ),
    ).rejects.toThrow();
    expect(
      await connection.db
        .select()
        .from(hrEmployees)
        .where(eq(hrEmployees.employeeNumber, 'ROLLBACK')),
    ).toHaveLength(0);
    const [current] = await connection.db.select().from(hrEmploymentRecords);
    await connection.db.insert(hrEmploymentRecords).values({
      ...current,
      employmentRecordId: randomUUID(),
      isCurrent: 0,
      employmentStatus: 'old',
    });
    await employees.putEmployment(
      current.employeeId,
      {
        categoryId: current.categoryId,
        positionId: current.positionId,
        startDate: '2026-01-01',
        employmentRegime: 'updated',
      },
      actorId,
    );
    const records = await connection.db.select().from(hrEmploymentRecords);
    expect(records).toHaveLength(2);
    expect(records.find((r) => r.isCurrent === 0)?.employmentStatus).toBe('old');
    expect((await employees.list(employeeQuery.parse({}))).total).toBe(1);
  });
});
