import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { PERMISSION } from '@project/authorization';
import { createDb } from '@project/db';
import {
  hrEmployees,
  inventoryAssets,
  inventoryCustodies,
  inventoryRemovalDecisions,
  permissions,
  rolePermissions,
  roles,
  user,
  userRoles,
  workflowEvents,
} from '@project/db/schema';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { adminOriginProtection } from '../../auth/admin-origin-protection.js';
import { AuthGuard } from '../../auth/auth.guard.js';
import type { Auth } from '../../auth/auth.provider.js';
import { AuthorizationService } from '../../auth/authorization.service.js';
import { DATABASE } from '../../database/database.constants.js';
import { InventoryRemovalController } from '../inventory/inventory-removal.controller.js';
import { InventoryRemovalService } from '../inventory/inventory-removal.service.js';
import type { WorkflowRegistration } from './workflow-definition.js';
import { WorkflowRegistry } from './workflow-registry.js';
import { WorkflowsController } from './workflows.controller.js';
import { WorkflowsService } from './workflows.service.js';

const testDatabase = process.env.WORKFLOWS_TEST_DATABASE_NAME;
const origin = 'https://workflows.test';
const actors = {
  requester: randomUUID(),
  reviewer: randomUUID(),
  reviewer2: randomUUID(),
  manager: randomUUID(),
  outsider: randomUUID(),
};
const actorRoles = {
  requester: randomUUID(),
  reviewer: randomUUID(),
  reviewer2: randomUUID(),
  manager: randomUUID(),
};
const employeeId = randomUUID();
const secondEmployee = randomUUID();
const taskApi = '/api/workflow/tasks';
const removalApi = '/api/inventory/workflow/removal-requests';

describe.skipIf(!testDatabase)('Workflows HTTP integration', () => {
  let connection: ReturnType<typeof createDb>;
  let app: INestApplication;
  const client = () => request(app.getHttpServer());
  const headers = (actorId: string) => ({ origin, 'x-test-actor': actorId });
  type WorkflowResult = { instanceId: string; taskId: string; status: string };
  const started = (body: unknown) => body as WorkflowResult;
  const bodyFor = (ids: string[]) => ({
    items: ids.map((assetId) => ({ assetId, reason: 'Damaged' })),
  });

  beforeAll(async () => {
    if (!testDatabase?.endsWith('_test'))
      throw new Error('WORKFLOWS_TEST_DATABASE_NAME must end in _test');
    if (!process.env.DATABASE_URL) process.loadEnvFile('../../packages/db/.env.db');
    const url = new URL(process.env.DATABASE_URL!);
    url.pathname = `/${testDatabase}`;
    connection = createDb(url.toString());
    const { db } = connection;
    await migrate(db, { migrationsFolder: '../../packages/db/drizzle' });

    const permissionGrants = PERMISSION.inventory;
    await db
      .insert(permissions)
      .values(
        [...Object.values(permissionGrants), PERMISSION.workflow.monitor].map((key) => ({
          key,
          description: key,
        })),
      )
      .onConflictDoNothing();
    await db.insert(user).values(
      Object.entries(actors).map(([name, id]) => ({
        id,
        name,
        email: `${id}@workflow.invalid`,
        approved: true,
        mustChangePassword: false,
      })),
    );
    await db.insert(roles).values(Object.values(actorRoles).map((id) => ({ id, name: id })));
    await db.insert(userRoles).values([
      { userId: actors.requester, roleId: actorRoles.requester },
      { userId: actors.reviewer, roleId: actorRoles.reviewer },
      { userId: actors.reviewer2, roleId: actorRoles.reviewer2 },
      { userId: actors.manager, roleId: actorRoles.manager },
    ]);
    await db.insert(rolePermissions).values([
      { roleId: actorRoles.requester, permission: permissionGrants.requestRemoval },
      { roleId: actorRoles.reviewer, permission: permissionGrants.reviewRemoval },
      { roleId: actorRoles.reviewer, permission: permissionGrants.decideRemoval },
      { roleId: actorRoles.reviewer, permission: PERMISSION.workflow.monitor },
      { roleId: actorRoles.reviewer2, permission: permissionGrants.reviewRemoval },
      { roleId: actorRoles.manager, permission: permissionGrants.manageAssets },
    ]);
    await db.insert(hrEmployees).values(
      [employeeId, secondEmployee].map((id) => ({
        employeeId: id,
        employeeNumber: id,
        firstNameAr: 'أحمد',
        lastNameAr: 'علي',
      })),
    );

    const auth = {
      api: {
        getSession: async ({ headers }: { headers: Headers }) => {
          const id = headers.get('x-test-actor');
          return id ? { user: { id } } : null;
        },
      },
    } as unknown as Auth;
    const module = await Test.createTestingModule({
      controllers: [WorkflowsController, InventoryRemovalController],
      providers: [
        WorkflowsService,
        WorkflowRegistry,
        InventoryRemovalService,
        { provide: DATABASE, useValue: db },
        { provide: AuthorizationService, useValue: new AuthorizationService(db) },
      ],
    }).compile();
    app = module.createNestApplication();
    app.use(adminOriginProtection([origin], ['/api/workflow', '/api/inventory/workflow']));
    app.useGlobalGuards(new AuthGuard(new Reflector(), auth, new AuthorizationService(db)));
    await app.init();
  }, 30_000);

  afterAll(async () => {
    await app?.close();
    await connection?.pool.end();
  });

  async function asset() {
    const response = await client()
      .post('/api/inventory/workflow/assets')
      .set(headers(actors.manager))
      .send({ tag: randomUUID(), name: 'Projector', employeeId })
      .expect(201);
    return (response.body as { id: string }).id;
  }

  async function start(ids: string[], key = randomUUID()) {
    const response = await client()
      .post(removalApi)
      .set(headers(actors.requester))
      .set('Idempotency-Key', key)
      .send(bodyFor(ids))
      .expect(201);
    return started(response.body);
  }

  function action(taskId: string, actorId: string, payload: object, key = randomUUID()) {
    return client()
      .post(`${taskApi}/${taskId}/actions`)
      .set(headers(actorId))
      .set('Idempotency-Key', key)
      .send(payload);
  }

  function decisions(ids: string[]) {
    return {
      action: 'record-decision',
      input: {
        name: 'November committee',
        reference: randomUUID(),
        decidedOn: '2026-11-18',
        items: ids.map((assetId, index) => ({
          assetId,
          outcome: ['approved-for-waste', 'rejected', 'deferred'][index],
          reason: 'Committee finding',
        })),
      },
    };
  }

  it('replays starts, serializes concurrent reviewers, and applies mixed outcomes atomically', async () => {
    const ids = [await asset(), await asset(), await asset()];
    const key = randomUUID();
    const [first, replayed] = await Promise.all([start(ids, key), start(ids, key)]);
    expect(replayed).toEqual(first);
    await client()
      .post(removalApi)
      .set(headers(actors.requester))
      .set('Idempotency-Key', key)
      .send(bodyFor(ids.slice(0, 1)))
      .expect(409);
    await client().get(taskApi).expect(401);
    const inbox = await client().get(taskApi).set(headers(actors.outsider)).expect(200);
    expect(inbox.body).toEqual([]);
    await client().get(`${taskApi}/${first.taskId}`).set(headers(actors.outsider)).expect(404);
    await client()
      .get(`/api/workflow/instances/${first.instanceId}`)
      .set(headers(actors.outsider))
      .expect(404);
    await client().get('/api/workflow/instances').set(headers(actors.requester)).expect(403);
    const monitor = await client()
      .get('/api/workflow/instances?status=running&step=review')
      .set(headers(actors.reviewer))
      .expect(200);
    expect(monitor.body).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: first.instanceId })]),
    );
    await client()
      .post(`/API/WORKFLOW/tasks/${first.taskId}/actions`)
      .set('x-test-actor', actors.reviewer)
      .send({ action: 'forward' })
      .expect(403);

    const candidates = [
      { actorId: actors.reviewer, key: randomUUID() },
      { actorId: actors.reviewer2, key: randomUUID() },
    ];
    const done = await Promise.all(
      candidates.map(({ actorId, key }) =>
        action(first.taskId, actorId, { action: 'forward' }, key),
      ),
    );
    expect(done.map((response) => response.status).sort()).toEqual([200, 409]);
    const winnerIndex = done.findIndex((response) => response.status === 200);
    const winner = candidates[winnerIndex];
    const committee = started(done[winnerIndex].body);
    const retried = await action(
      first.taskId,
      winner.actorId,
      { action: 'forward' },
      winner.key,
    ).expect(200);
    expect(retried.body).toEqual(committee);
    await action(committee.taskId, actors.reviewer, decisions(ids)).expect(200);
    const { db } = connection;
    const statuses = await db
      .select()
      .from(inventoryAssets)
      .where(inArray(inventoryAssets.id, ids));
    expect(statuses.find(({ id }) => id === ids[0])?.status).toBe('decommissioned');
    expect(statuses.filter(({ status }) => status === 'active')).toHaveLength(2);
    const active = await db
      .select()
      .from(inventoryCustodies)
      .where(and(inArray(inventoryCustodies.assetId, ids), isNull(inventoryCustodies.endedAt)));
    expect(active.map(({ assetId }) => assetId).sort()).toEqual(ids.slice(1).sort());
    const history = await client()
      .get(`/api/workflow/instances/${first.instanceId}`)
      .set(headers(actors.requester))
      .expect(200);
    expect(history.body).toMatchObject({
      status: 'completed',
      history: [{ action: 'started' }, { action: 'forward' }, { action: 'record-decision' }],
    });
  });

  it('rolls back a stale decision and preserves the reviewed revision when returned', async () => {
    const ids = [await asset(), await asset()].sort();
    const review = await start(ids);
    const committee = started(
      (await action(review.taskId, actors.reviewer, { action: 'forward' }).expect(200)).body,
    );
    await client()
      .patch(`/api/inventory/workflow/assets/${ids[1]}/custody`)
      .set(headers(actors.manager))
      .send({ employeeId: secondEmployee })
      .expect(204);
    const attempt = decisions(ids);
    attempt.input.items[1].outcome = 'approved-for-waste';
    await action(committee.taskId, actors.reviewer, attempt).expect(409);
    const { db } = connection;
    const assets = await db.select().from(inventoryAssets).where(inArray(inventoryAssets.id, ids));
    expect(assets.map(({ status }) => status)).toEqual(['active', 'active']);
    const eventsAfterConflict = await db
      .select()
      .from(workflowEvents)
      .where(eq(workflowEvents.instanceId, review.instanceId));
    expect(eventsAfterConflict).toHaveLength(2);
    const next = started(
      (
        await action(committee.taskId, actors.reviewer, {
          action: 'return',
          comment: 'Check custody',
        }).expect(200)
      ).body,
    );
    await action(next.taskId, actors.outsider, { action: 'resubmit', input: bodyFor(ids) }).expect(
      404,
    );
    await action(next.taskId, actors.requester, { action: 'resubmit', input: bodyFor(ids) }).expect(
      200,
    );
    const instance = await client()
      .get(`/api/workflow/instances/${review.instanceId}`)
      .set(headers(actors.requester))
      .expect(200);
    expect(instance.body).toMatchObject({
      currentStep: 'review',
      history: expect.arrayContaining([
        expect.objectContaining({ action: 'return', comment: 'Check custody' }),
      ]),
    });
    const subjectId = (instance.body as { subjectId: string }).subjectId;
    const detail = await client()
      .get(`${removalApi}/${subjectId}`)
      .set(headers(actors.requester))
      .expect(200);
    expect(detail.body).toMatchObject({
      currentRevision: 2,
      items: [{ revision: 1 }, { revision: 1 }, { revision: 2 }, { revision: 2 }],
      decision: null,
    });
    expect(
      await db
        .select()
        .from(inventoryRemovalDecisions)
        .where(eq(inventoryRemovalDecisions.requestId, subjectId)),
    ).toEqual([]);
  });

  it('rechecks a permission after the task has been opened', async () => {
    const open = await start([await asset()]);
    await client().get(`${taskApi}/${open.taskId}`).set(headers(actors.reviewer2)).expect(200);
    await connection.db
      .delete(rolePermissions)
      .where(
        and(
          eq(rolePermissions.roleId, actorRoles.reviewer2),
          eq(rolePermissions.permission, PERMISSION.inventory.reviewRemoval),
        ),
      );
    await action(open.taskId, actors.reviewer2, { action: 'forward' }).expect(404);
    await action(open.taskId, actors.reviewer, { action: 'forward' }).expect(200);
  });

  it('uses the pinned handler after activating a newer definition', async () => {
    const { db } = connection;
    const authorization = new AuthorizationService(db);
    const calls: number[] = [];
    const registration = (version: number, active: boolean): WorkflowRegistration => ({
      definition: {
        key: 'exams.batch-approval',
        version,
        title: 'Batch approval',
        description: 'Review an exam batch',
        initialStep: 'review',
        steps: {
          review: {
            title: 'Review',
            instructions: 'Review the batch',
            eligible: { permission: PERMISSION.workflow.monitor },
            actions: { approve: { finish: 'completed' } },
          },
        },
      },
      active,
      subjectType: 'batch',
      canView: async ({ actorId }) => actorId === actors.reviewer,
      requester: async () => null,
      apply: async () => {
        calls.push(version);
      },
    });
    const startBatch = (service: WorkflowsService) =>
      service.start({
        definitionKey: 'exams.batch-approval',
        actorId: actors.reviewer,
        input: {},
        create: async () => ({ subject: { module: 'exams', type: 'batch', id: randomUUID() } }),
      });
    const originalRegistry = new WorkflowRegistry();
    originalRegistry.register(registration(1, true));
    originalRegistry.onApplicationBootstrap();
    const original = await startBatch(new WorkflowsService(db, originalRegistry, authorization));

    const updatedRegistry = new WorkflowRegistry();
    updatedRegistry.register(registration(1, false));
    updatedRegistry.register(registration(2, true));
    updatedRegistry.onApplicationBootstrap();
    const updated = new WorkflowsService(db, updatedRegistry, authorization);
    const latest = await startBatch(updated);
    for (const { taskId } of [original, latest]) {
      if (!taskId) throw new Error('The batch has no review task');
      await updated.act({ taskId, actorId: actors.reviewer, action: 'approve' });
    }
    expect(calls).toEqual([1, 2]);
  });
});
