import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { PERMISSION } from '@project/authorization';
import type { WorkflowActionResult } from '@project/contracts/workflow';
import { createDb } from '@project/db';
import {
  facilitiesBuildings,
  facilitiesFloors,
  facilitiesRooms,
  facilitiesRoomTypes,
  hrEmployees,
  inventoryAssets,
  inventoryCustodies,
  inventoryRemovalDecisions,
  inventoryTransactions,
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
import { InventoryController } from '../inventory/inventory.controller.js';
import { InventoryReadService } from '../inventory/inventory-read.service.js';
import { InventoryTransactionsService } from '../inventory/inventory-transactions.service.js';
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
  const started = (body: unknown) => {
    const result = body as WorkflowActionResult;
    if (result.status !== 'running' || !result.taskId) throw new Error('Expected a pending task');
    return { ...result, taskId: result.taskId, status: result.status };
  };
  const isoTimestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
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
      { roleId: actorRoles.manager, permission: permissionGrants.read },
      { roleId: actorRoles.manager, permission: permissionGrants.configure },
      { roleId: actorRoles.manager, permission: permissionGrants.postTransactions },
      { roleId: actorRoles.reviewer, permission: permissionGrants.dispose },
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
      controllers: [WorkflowsController, InventoryRemovalController, InventoryController],
      providers: [
        WorkflowsService,
        WorkflowRegistry,
        InventoryRemovalService,
        InventoryReadService,
        InventoryTransactionsService,
        { provide: DATABASE, useValue: db },
        { provide: AuthorizationService, useValue: new AuthorizationService(db) },
      ],
    }).compile();
    app = module.createNestApplication();
    app.use(adminOriginProtection([origin], ['/api/workflow', '/api/inventory']));
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
    const task = await client()
      .get(`${taskApi}/${first.taskId}`)
      .set(headers(actors.reviewer))
      .expect(200);
    expect(task.body).toEqual({
      id: first.taskId,
      instanceId: first.instanceId,
      step: 'review',
      assignedUserId: null,
      status: 'pending',
      openedAt: expect.stringMatching(isoTimestamp),
      completedAt: null,
      title: expect.any(String),
      instructions: expect.any(String),
      actions: ['forward', 'return', 'reject'],
      instance: {
        id: first.instanceId,
        definitionKey: 'inventory.removal',
        definitionVersion: 1,
        subjectModule: 'inventory',
        subjectType: 'removal-request',
        subjectId: expect.any(String),
        startedBy: actors.requester,
        status: 'running',
        currentStep: 'review',
        startedAt: expect.stringMatching(isoTimestamp),
        lastActivityAt: expect.stringMatching(isoTimestamp),
        completedAt: null,
        title: expect.any(String),
        description: expect.any(String),
      },
    });
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
    const recorded = decisions(ids);
    const decisionKey = randomUUID();
    await action(committee.taskId, actors.reviewer, recorded, decisionKey).expect(200);
    await action(committee.taskId, actors.reviewer, recorded, decisionKey).expect(200);
    const ledger = await client()
      .get('/api/inventory/transactions')
      .query({ type: 'committee-decision', assetId: ids[0] })
      .set(headers(actors.manager))
      .expect(200);
    expect(ledger.body).toHaveLength(1);
    const entry = await client()
      .get(`/api/inventory/transactions/${ledger.body[0].id}`)
      .set(headers(actors.manager))
      .expect(200);
    expect(entry.body.items.map(({ outcome }: { outcome: string }) => outcome)).toEqual([
      'approved-for-waste',
      'rejected',
      'deferred',
    ]);
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
    const disposal = {
      type: 'disposal',
      eventDate: '2026-11-19',
      name: 'Waste pickup',
      reference: 'pickup',
      items: [{ assetId: ids[0], expectedRevision: 2 }],
    };
    await client()
      .post('/api/inventory/transactions')
      .set(headers(actors.manager))
      .send(disposal)
      .expect(403);
    await client()
      .post('/api/inventory/transactions')
      .set(headers(actors.reviewer))
      .send(disposal)
      .expect(201);
    await client()
      .post('/api/inventory/transactions')
      .set(headers(actors.reviewer))
      .send({ ...disposal, items: [{ assetId: ids[1], expectedRevision: 1 }] })
      .expect(409);
    const [disposed] = await db
      .select()
      .from(inventoryAssets)
      .where(eq(inventoryAssets.id, ids[0]));
    expect(disposed).toMatchObject({ status: 'disposed', roomId: null });
    const history = await client()
      .get(`/api/workflow/instances/${first.instanceId}`)
      .set(headers(actors.requester))
      .expect(200);
    expect(history.body).toMatchObject({
      status: 'completed',
      currentStep: null,
      completedAt: expect.stringMatching(isoTimestamp),
      currentTaskId: null,
      history: [
        {
          action: 'started',
          taskId: first.taskId,
          occurredAt: expect.stringMatching(isoTimestamp),
          comment: null,
        },
        { action: 'forward', taskId: first.taskId },
        { action: 'record-decision', taskId: committee.taskId },
      ],
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

  it('routes a review return only to the requester and routes a new review after resubmission', async () => {
    const ids = [await asset()];
    const review = await start(ids);
    await action(review.taskId, actors.reviewer, { action: 'return' }).expect(400);
    const revision = started(
      (
        await action(review.taskId, actors.reviewer, {
          action: 'return',
          comment: 'Add details',
        }).expect(200)
      ).body,
    );
    const inbox = async (actor: string) =>
      (await client().get(taskApi).set(headers(actor)).expect(200)).body;
    const revisionTask = expect.objectContaining({
      id: revision.taskId,
      step: 'revise',
      actions: ['resubmit'],
    });
    expect(await inbox(actors.requester)).toContainEqual(revisionTask);
    expect(await inbox(actors.reviewer)).not.toContainEqual(revisionTask);
    const next = started(
      (
        await action(revision.taskId, actors.requester, {
          action: 'resubmit',
          input: bodyFor(ids),
        }).expect(200)
      ).body,
    );
    expect(await inbox(actors.reviewer)).toContainEqual(
      expect.objectContaining({ id: next.taskId, step: 'review' }),
    );
  });

  it('posts mixed receipts, retains custody across relocation, and serializes stock deductions', async () => {
    const { db } = connection;
    const [building] = await db
      .insert(facilitiesBuildings)
      .values({ buildingCode: randomUUID(), title: 'Inventory test' })
      .returning();
    const [floor] = await db
      .insert(facilitiesFloors)
      .values({ buildingId: building.buildingId, floorNumber: 1 })
      .returning();
    const [roomType] = await db
      .insert(facilitiesRoomTypes)
      .values({ name: randomUUID() })
      .returning();
    const [store, other] = await db
      .insert(facilitiesRooms)
      .values(
        ['Store', 'Annex'].map((title) => ({
          roomCode: title,
          title,
          buildingId: building.buildingId,
          floorId: floor.floorId,
          roomTypeId: roomType.roomTypeId,
        })),
      )
      .returning();
    const manager = headers(actors.manager);
    const prefix = '/api/inventory';
    const shared = (
      await client()
        .post(prefix + '/shared-accounts')
        .set(manager)
        .send({ name: randomUUID() })
        .expect(201)
    ).body;
    for (const room of [store, other])
      await client()
        .put(prefix + '/storage/' + room.roomId)
        .set(manager)
        .send({ sharedAccountId: shared.id })
        .expect(200);
    const storageList = await client().get('/api/inventory/storage').set(manager).expect(200);
    expect(storageList.body).toContainEqual(
      expect.objectContaining({ roomId: store.roomId, sharedAccount: shared.name }),
    );
    const item = (
      await client()
        .post(prefix + '/consumables')
        .set(manager)
        .send({
          name: 'Paper',
          code: randomUUID(),
          unit: 'ream',
        })
        .expect(201)
    ).body;
    const tag = randomUUID();
    const header = { eventDate: '2026-11-19', name: 'Inventory test' };
    const receipt = {
      ...header,
      type: 'receipt',
      source: 'purchase',
      reference: randomUUID(),
      destinationRoomId: store.roomId,
      items: [
        { kind: 'asset', tag, name: 'Projector' },
        { kind: 'consumable', consumableId: item.id, quantity: 5 },
      ],
    };
    const post = (body: object, key = randomUUID()) =>
      client()
        .post(prefix + '/transactions')
        .set(manager)
        .set('Idempotency-Key', key)
        .send(body);
    await client()
      .post(prefix + '/transactions')
      .set('x-test-actor', actors.manager)
      .send(receipt)
      .expect(403);
    const key = randomUUID();
    const [first, retry] = await Promise.all([
      post(receipt, key).expect(201),
      post(receipt, key).expect(201),
    ]);
    expect(retry.body).toEqual(first.body);
    await post({ ...receipt, name: 'Changed' }, key).expect(409);
    const [received] = (
      await client()
        .get(prefix + '/assets')
        .query({ q: tag })
        .set(manager)
        .expect(200)
    ).body;
    expect(received).toMatchObject({
      asset: { roomId: store.roomId },
      custody: { sharedAccountId: shared.id },
    });
    const assetId = received.asset.id;
    const stock = () =>
      client()
        .get(prefix + '/stock')
        .query({ consumableId: item.id, roomId: store.roomId })
        .set(manager)
        .expect(200);
    expect((await stock()).body).toMatchObject([{ quantity: 5 }]);
    const issue = {
      ...header,
      type: 'asset-issue',
      sourceRoomId: store.roomId,
      recipient: { kind: 'employee', id: employeeId },
      items: [{ assetId, expectedRevision: 1 }],
    };
    await post(issue).expect(201);
    const move = {
      ...header,
      type: 'storage-relocation',
      sourceRoomId: store.roomId,
      destinationRoomId: other.roomId,
      items: [
        { kind: 'asset', assetId, expectedRevision: 2 },
        { kind: 'consumable', consumableId: item.id, quantity: 9 },
      ],
    };
    await post(move).expect(409);
    const getAsset = async () =>
      (
        await client()
          .get(prefix + '/assets')
          .query({ q: tag })
          .set(manager)
          .expect(200)
      ).body[0];
    expect(await getAsset()).toMatchObject({
      asset: { revision: 2, roomId: store.roomId },
      custody: { employeeId },
    });
    await post({ ...move, items: move.items.slice(0, 1) }).expect(201);
    expect(await getAsset()).toMatchObject({
      asset: { roomId: other.roomId },
      custody: { employeeId },
    });
    await post({
      ...header,
      type: 'asset-handover',
      from: { kind: 'employee', id: employeeId },
      recipient: { kind: 'employee', id: secondEmployee },
      items: [{ assetId, expectedRevision: 3 }],
    }).expect(201);
    expect(await getAsset()).toMatchObject({
      asset: { roomId: other.roomId },
      custody: { employeeId: secondEmployee },
    });
    await post({
      ...header,
      type: 'asset-return',
      from: { kind: 'employee', id: secondEmployee },
      destinationRoomId: store.roomId,
      items: [{ assetId, expectedRevision: 4 }],
    }).expect(201);
    await post({
      ...header,
      type: 'condition-change',
      items: [
        { assetId, expectedRevision: 5, condition: 'malfunctioning', reason: 'Lamp failure' },
      ],
    }).expect(201);
    expect(await getAsset()).toMatchObject({
      asset: { roomId: store.roomId, condition: 'malfunctioning', revision: 6 },
      custody: { sharedAccountId: shared.id },
    });
    const consumableIssue = {
      ...header,
      type: 'consumable-issue',
      sourceRoomId: store.roomId,
      employeeId,
      items: [{ consumableId: item.id, quantity: 4 }],
    };
    const prior = await db
      .select()
      .from(inventoryCustodies)
      .where(eq(inventoryCustodies.employeeId, employeeId));
    const responses = await Promise.all([post(consumableIssue), post(consumableIssue)]);
    expect(responses.map(({ status }) => status).sort()).toEqual([201, 409]);
    expect((await stock()).body).toMatchObject([{ quantity: 1 }]);
    expect(
      await db
        .select()
        .from(inventoryCustodies)
        .where(eq(inventoryCustodies.employeeId, employeeId)),
    ).toEqual(prior);
    expect(
      await db
        .select()
        .from(inventoryTransactions)
        .where(eq(inventoryTransactions.idempotencyKey, key)),
    ).toHaveLength(1);
  });

  it('lists only the signed-in employee’s current assets without inventory read access', async () => {
    const { db } = connection;
    await db
      .update(hrEmployees)
      .set({ userId: actors.outsider })
      .where(eq(hrEmployees.employeeId, employeeId));
    await db
      .update(hrEmployees)
      .set({ userId: actors.requester })
      .where(eq(hrEmployees.employeeId, secondEmployee));
    const id = await asset();
    const mine = '/api/inventory/my-items';
    await client().get(mine).expect(401);
    await client().get('/api/inventory/assets').set(headers(actors.outsider)).expect(403);
    const initial = (await client().get(mine).set(headers(actors.outsider)).expect(200)).body;
    expect(initial).toMatchObject({
      linkedEmployee: true,
      items: expect.arrayContaining([
        expect.objectContaining({ id, tag: expect.any(String), assignedAt: expect.any(String) }),
      ]),
    });
    expect(
      (await client().get('/api/inventory/capabilities').set(headers(actors.outsider)).expect(200))
        .body,
    ).toMatchObject({ hasEmployeeProfile: true, read: false });
    await client()
      .get(mine + '?employeeId=' + secondEmployee)
      .set(headers(actors.outsider))
      .expect(400);
    const unlinked = await client().get(mine).set(headers(actors.manager)).expect(200);
    expect(unlinked.body).toEqual({ linkedEmployee: false, items: [] });
    await client()
      .patch('/api/inventory/workflow/assets/' + id + '/custody')
      .set(headers(actors.manager))
      .send({ employeeId: secondEmployee })
      .expect(204);
    const after = (await client().get(mine).set(headers(actors.outsider)).expect(200)).body;
    expect(after.items).not.toContainEqual(expect.objectContaining({ id }));
    const recipient = (await client().get(mine).set(headers(actors.requester)).expect(200)).body;
    expect(recipient.items).toContainEqual(expect.objectContaining({ id }));
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
