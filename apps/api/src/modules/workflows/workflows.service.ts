import { createHash } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  WorkflowPage,
  WorkflowActionResult,
  WorkflowHistoryEvent,
  WorkflowInstance as WorkflowInstanceResponse,
  WorkflowInstanceDetail,
  WorkflowTask as WorkflowTaskResponse,
} from '@project/contracts/workflow';
import type { Database } from '@project/db';
import { workflowEvents, workflowInstances, workflowTasks } from '@project/db/schema';
import { and, asc, desc, eq, gt, isNull, or, sql } from 'drizzle-orm';
import { AuthorizationService } from '../../auth/authorization.service.js';
import { DATABASE } from '../../database/database.constants.js';
import type {
  WorkflowAccess,
  WorkflowEligibility,
  WorkflowInstance,
  WorkflowReader,
  WorkflowRegistration,
  WorkflowSubject,
  WorkflowTask,
  WorkflowTransaction,
} from './workflow-definition.js';
import { queueCursor, type QueuePosition } from './workflow-cursor.js';
import { WorkflowRegistry } from './workflow-registry.js';

export interface WorkflowQueueQuery {
  limit: number;
  cursor?: string;
  subjectModule?: string;
  status?: WorkflowInstance['status'];
  step?: string;
}

type QueueAccess = Awaited<ReturnType<NonNullable<WorkflowRegistration['queueAccess']>>>;
type QueueRow = { position: QueuePosition; instance: WorkflowInstance };
const scanLimit = 500;
const batchSize = 100;

function fingerprint(input: unknown): string {
  const canonical = JSON.stringify(input, (_key: string, value: unknown) => {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return value;
    return Object.fromEntries(
      Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
    );
  });
  return createHash('sha256')
    .update(canonical ?? 'undefined')
    .digest('hex');
}

interface StartCommand {
  definitionKey: string;
  actorId: string;
  idempotencyKey?: string;
  input: unknown;
  create(tx: WorkflowTransaction): Promise<{ subject: WorkflowSubject; domainReference?: string }>;
}

interface ActCommand {
  taskId: string;
  actorId: string;
  idempotencyKey?: string;
  action: string;
  comment?: string;
  input?: unknown;
}

type WithdrawCommand = Omit<ActCommand, 'taskId' | 'action'> & { instanceId: string };

interface Idempotency {
  actorId: string;
  scope: string;
  key?: string;
  hash: string;
}

@Injectable()
export class WorkflowsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(WorkflowRegistry) private readonly registry: WorkflowRegistry,
    @Inject(AuthorizationService) private readonly authorization: AuthorizationService,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

  async start(command: StartCommand): Promise<WorkflowActionResult> {
    return this.db.transaction(async (tx) => {
      if (!(await this.authorization.isActive(command.actorId, tx))) throw new ForbiddenException();
      const retry = {
        actorId: command.actorId,
        scope: `start:${command.definitionKey}`,
        key: command.idempotencyKey,
        hash: fingerprint(command.input),
      };
      if (retry.key) {
        const lock = JSON.stringify([retry.actorId, retry.scope, retry.key]);
        await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${lock}, 0))`);
      }
      const replay = await this.replay(tx, retry);
      if (replay) return replay;
      const registration = this.registry.current(command.definitionKey);
      if (!registration) throw new BadRequestException('Unknown active workflow definition');
      const { subject, domainReference } = await command.create(tx);
      const { definition } = registration;
      if (
        subject.module !== definition.key.split('.')[0] ||
        subject.type !== registration.subjectType
      ) {
        throw new Error('Workflow subject does not match its registration');
      }
      const [instance] = await tx
        .insert(workflowInstances)
        .values({
          definitionKey: definition.key,
          definitionVersion: definition.version,
          status: 'running',
          currentStep: definition.initialStep,
          startedBy: command.actorId,
          subjectModule: subject.module,
          subjectType: subject.type,
          subjectId: subject.id,
        })
        .returning();
      const context = this.access(tx, command.actorId, instance);
      if (!(await registration.canView(context))) throw new ForbiddenException();
      const task = await this.openTask(tx, context, registration, definition.initialStep);
      const result = { instanceId: instance.id, taskId: task.id, status: instance.status };
      await this.record(tx, result, task.id, 'started', retry, undefined, domainReference);
      return result;
    });
  }

  async act(command: ActCommand): Promise<WorkflowActionResult> {
    return this.db.transaction(async (tx) => {
      const [target] = await tx
        .select({ instanceId: workflowTasks.instanceId })
        .from(workflowTasks)
        .where(eq(workflowTasks.id, command.taskId));
      if (!target) throw new NotFoundException();
      const instance = await this.findInstance(tx, target.instanceId, true);
      if (!instance) throw new NotFoundException();
      const [task] = await tx
        .select()
        .from(workflowTasks)
        .where(eq(workflowTasks.id, command.taskId))
        .for('update');
      const context = this.access(tx, command.actorId, instance);
      const registration = await this.visible(context);
      if (!registration) throw new NotFoundException();
      if (!(await this.authorization.isActive(command.actorId, tx))) throw new ForbiddenException();

      const retry = {
        actorId: command.actorId,
        scope: `task:${task.id}`,
        key: command.idempotencyKey,
        hash: fingerprint({
          action: command.action,
          comment: command.comment,
          input: command.input,
        }),
      };
      const replay = await this.replay(tx, retry);
      if (replay) return replay;
      if (
        instance.status !== 'running' ||
        task.status !== 'pending' ||
        task.step !== instance.currentStep
      ) {
        throw new ConflictException('This task is no longer pending');
      }

      const actions = await this.available(context, registration, task);
      if (!actions.includes(command.action)) throw new ForbiddenException('Action is unavailable');
      const transition = registration.definition.steps[task.step].actions[command.action];
      const effect = await registration.apply({
        ...context,
        db: tx,
        task,
        transition,
        action: command.action,
        comment: command.comment,
        input: command.input,
      });

      const now = new Date();
      await tx
        .update(workflowTasks)
        .set({ status: 'completed', completedAt: now })
        .where(eq(workflowTasks.id, task.id));
      const status: WorkflowActionResult['status'] =
        'finish' in transition ? transition.finish : 'running';
      const nextStep = 'next' in transition ? transition.next : null;
      const [updated] = await tx
        .update(workflowInstances)
        .set({
          status,
          currentStep: nextStep,
          lastActivityAt: now,
          completedAt: nextStep ? null : now,
        })
        .where(eq(workflowInstances.id, instance.id))
        .returning();
      const next = nextStep
        ? await this.openTask(tx, this.access(tx, command.actorId, updated), registration, nextStep)
        : undefined;
      const result = { instanceId: instance.id, taskId: next?.id ?? null, status };
      await this.record(
        tx,
        result,
        task.id,
        command.action,
        retry,
        command.comment,
        effect?.domainReference,
      );
      return result;
    });
  }

  async withdraw(command: WithdrawCommand): Promise<WorkflowActionResult> {
    return this.db.transaction(async (tx) => {
      const { instanceId, actorId, idempotencyKey, comment, input } = command;
      const instance = await this.findInstance(tx, instanceId, true);
      if (!instance) throw new NotFoundException();
      const context = this.access(tx, actorId, instance);
      const registration = await this.visible(context);
      if (!registration) throw new NotFoundException();
      if (!(await this.authorization.isActive(actorId, tx))) throw new ForbiddenException();

      const retry = {
        actorId,
        scope: `withdraw:${instanceId}`,
        key: idempotencyKey,
        hash: fingerprint({ comment, input }),
      };
      const replay = await this.replay(tx, retry);
      if (replay) return replay;
      if (instance.status !== 'running') {
        throw new ConflictException('This workflow is no longer running');
      }
      if (!(await this.canWithdraw(context, registration))) {
        throw new ForbiddenException('Withdrawal is unavailable');
      }

      const [task] = await tx
        .select()
        .from(workflowTasks)
        .where(and(eq(workflowTasks.instanceId, instanceId), eq(workflowTasks.status, 'pending')))
        .for('update');
      if (!task || task.step !== instance.currentStep) {
        throw new ConflictException('This workflow has no pending task');
      }
      const effect = await registration.apply({
        ...context,
        db: tx,
        task,
        transition: { finish: 'cancelled' },
        action: 'withdraw',
        comment,
        input,
      });

      const now = new Date();
      await tx
        .update(workflowTasks)
        .set({ status: 'cancelled', completedAt: now })
        .where(eq(workflowTasks.id, task.id));
      await tx
        .update(workflowInstances)
        .set({ status: 'cancelled', currentStep: null, completedAt: now, lastActivityAt: now })
        .where(eq(workflowInstances.id, instanceId));
      const result = { instanceId, taskId: null, status: 'cancelled' } as const;
      await this.record(tx, result, task.id, 'withdraw', retry, comment, effect?.domainReference);
      return result;
    });
  }

  inbox(actorId: string, query: WorkflowQueueQuery): Promise<WorkflowPage<WorkflowTaskResponse>> {
    return this.queue(
      actorId,
      'inbox',
      query,
      async (after, limit) => {
        const rows = await this.db
          .select({
            task: workflowTasks,
            instance: workflowInstances,
            time: sql<string>`to_char(${workflowTasks.openedAt} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
          })
          .from(workflowTasks)
          .innerJoin(workflowInstances, eq(workflowTasks.instanceId, workflowInstances.id))
          .where(
            and(
              eq(workflowTasks.status, 'pending'),
              eq(workflowInstances.status, 'running'),
              eq(workflowTasks.step, workflowInstances.currentStep),
              or(isNull(workflowTasks.assignedUserId), eq(workflowTasks.assignedUserId, actorId)),
              query.subjectModule
                ? eq(workflowInstances.subjectModule, query.subjectModule)
                : undefined,
              after
                ? or(
                    sql`${workflowTasks.openedAt} > ${after.time}::timestamptz`,
                    and(
                      sql`${workflowTasks.openedAt} = ${after.time}::timestamptz`,
                      gt(workflowTasks.id, after.id),
                    ),
                  )
                : undefined,
            ),
          )
          .orderBy(asc(workflowTasks.openedAt), asc(workflowTasks.id))
          .limit(limit);
        return rows.map(({ time, ...row }) => ({ ...row, position: { time, id: row.task.id } }));
      },
      async ({ instance, task }, registration, batch) => {
        const context = this.access(this.db, actorId, instance);
        const eligible = registration.definition.steps[task.step].eligible;
        const batchEligible =
          batch &&
          ('requester' in eligible
            ? batch.requesters.get(instance.subjectId) === actorId
            : batch.permits(eligible.permission, instance.subjectId));
        const actions = await this.available(context, registration, task, batchEligible);
        return actions.length ? this.taskView(task, instance, registration, actions) : undefined;
      },
    );
  }

  async task(id: string, actorId: string): Promise<WorkflowTaskResponse> {
    const [row] = await this.db
      .select({ task: workflowTasks, instance: workflowInstances })
      .from(workflowTasks)
      .innerJoin(workflowInstances, eq(workflowTasks.instanceId, workflowInstances.id))
      .where(eq(workflowTasks.id, id));
    if (!row) throw new NotFoundException();
    const context = this.access(this.db, actorId, row.instance);
    const registration = await this.visible(context);
    if (!registration) throw new NotFoundException();
    return this.taskView(
      row.task,
      row.instance,
      registration,
      await this.available(context, registration, row.task),
    );
  }

  async instance(id: string, actorId: string): Promise<WorkflowInstanceDetail> {
    const row = await this.findInstance(this.db, id);
    if (!row) throw new NotFoundException();
    const context = this.access(this.db, actorId, row);
    const registration = await this.visible(context);
    if (!registration) throw new NotFoundException();
    const rows = await this.db
      .select()
      .from(workflowEvents)
      .where(eq(workflowEvents.instanceId, id))
      .orderBy(asc(workflowEvents.occurredAt), asc(workflowEvents.id));
    const history: WorkflowHistoryEvent[] = [];
    for (const event of rows) {
      if (registration.canViewEvent && !(await registration.canViewEvent(context, event))) continue;
      const showComment = registration.canViewComment
        ? await registration.canViewComment(context, event)
        : event.actorId === actorId;
      history.push({
        id: event.id,
        taskId: event.taskId,
        actorId: event.actorId,
        action: event.action,
        occurredAt: event.occurredAt.toISOString(),
        comment: showComment ? event.comment : null,
      });
    }
    const [currentTask] = await this.db
      .select({ id: workflowTasks.id })
      .from(workflowTasks)
      .where(and(eq(workflowTasks.instanceId, id), eq(workflowTasks.status, 'pending')));
    return {
      ...this.instanceView(row, registration),
      currentTaskId: currentTask?.id ?? null,
      canWithdraw: !!currentTask && (await this.canWithdraw(context, registration)),
      history,
    };
  }

  monitor(
    actorId: string,
    query: WorkflowQueueQuery,
  ): Promise<WorkflowPage<WorkflowInstanceResponse>> {
    return this.queue(
      actorId,
      'monitor',
      query,
      async (after, limit) => {
        const rows = await this.db
          .select({
            instance: workflowInstances,
            time: sql<string>`to_char(${workflowInstances.lastActivityAt} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
          })
          .from(workflowInstances)
          .where(
            and(
              query.status ? eq(workflowInstances.status, query.status) : undefined,
              query.step ? eq(workflowInstances.currentStep, query.step) : undefined,
              query.subjectModule
                ? eq(workflowInstances.subjectModule, query.subjectModule)
                : undefined,
              after
                ? or(
                    sql`${workflowInstances.lastActivityAt} < ${after.time}::timestamptz`,
                    and(
                      sql`${workflowInstances.lastActivityAt} = ${after.time}::timestamptz`,
                      gt(workflowInstances.id, after.id),
                    ),
                  )
                : undefined,
            ),
          )
          .orderBy(desc(workflowInstances.lastActivityAt), asc(workflowInstances.id))
          .limit(limit);
        return rows.map(({ instance, time }) => ({
          instance,
          position: { time, id: instance.id },
        }));
      },
      async ({ instance }, registration) => this.instanceView(instance, registration),
    );
  }

  private async queue<Row extends QueueRow, Result>(
    actorId: string,
    kind: 'inbox' | 'monitor',
    query: WorkflowQueueQuery,
    fetch: (after: QueuePosition | undefined, limit: number) => Promise<Row[]>,
    resolve: (
      row: Row,
      registration: WorkflowRegistration,
      batch?: QueueAccess,
    ) => Promise<Result | undefined>,
  ): Promise<WorkflowPage<Result>> {
    const cursor = queueCursor(
      this.config.getOrThrow<string>('BETTER_AUTH_SECRET'),
      JSON.stringify([kind, actorId, query.subjectModule, query.status, query.step]),
    );
    let after = cursor.decode(query.cursor);
    let examined = 0;
    let hasMore = true;
    const records: Result[] = [];
    while (hasMore && examined < scanLimit && records.length < query.limit) {
      const take = Math.min(batchSize, scanLimit - examined);
      const candidates = await fetch(after, take + 1);
      const rows = candidates.slice(0, take);
      const registrations = rows.map(({ instance }) =>
        this.registry.get(instance.definitionKey, instance.definitionVersion),
      );
      const idsByRegistration = new Map<WorkflowRegistration, string[]>();
      for (const [index, registration] of registrations.entries()) {
        if (!registration?.queueAccess) continue;
        const ids = idsByRegistration.get(registration) ?? [];
        ids.push(rows[index].instance.subjectId);
        idsByRegistration.set(registration, ids);
      }
      const batched = new Map(
        await Promise.all(
          [...idsByRegistration].map(
            async ([registration, ids]) =>
              [registration, await registration.queueAccess!(this.db, actorId, ids)] as const,
          ),
        ),
      );
      hasMore = candidates.length > take;
      for (const [index, row] of rows.entries()) {
        examined += 1;
        after = row.position;
        const registration = registrations[index];
        if (!registration) continue;
        const batch = batched.get(registration);
        const visible = batch
          ? batch.requesters.has(row.instance.subjectId)
          : await registration.canView(this.access(this.db, actorId, row.instance));
        if (!visible) continue;
        const result = await resolve(row, registration, batch);
        if (result !== undefined) records.push(result);
        if (records.length === query.limit) {
          hasMore ||= index + 1 < rows.length;
          break;
        }
      }
    }
    return { records, nextCursor: hasMore && after ? cursor.encode(after) : null };
  }

  private access(db: WorkflowReader, actorId: string, instance: WorkflowInstance): WorkflowAccess {
    return {
      db,
      actorId,
      instance,
      subject: {
        module: instance.subjectModule,
        type: instance.subjectType,
        id: instance.subjectId,
      },
    };
  }

  private async visible(context: WorkflowAccess) {
    const { definitionKey, definitionVersion } = context.instance;
    const registration = this.registry.get(definitionKey, definitionVersion);
    return registration && (await registration.canView(context)) ? registration : undefined;
  }

  private async available(
    context: WorkflowAccess,
    registration: WorkflowRegistration,
    task: WorkflowTask,
    batchEligible?: boolean,
  ) {
    if (
      task.status !== 'pending' ||
      context.instance.status !== 'running' ||
      context.instance.currentStep !== task.step
    )
      return [];
    if (task.assignedUserId && task.assignedUserId !== context.actorId) return [];
    const { eligible, actions } = registration.definition.steps[task.step];
    if (!(batchEligible ?? (await this.isEligible(context, registration, eligible)))) return [];
    const available: string[] = [];
    for (const action of Object.keys(actions)) {
      if (!registration.canAct || (await registration.canAct({ ...context, task, action })))
        available.push(action);
    }
    return available;
  }

  private async canWithdraw(context: WorkflowAccess, registration: WorkflowRegistration) {
    const { status, currentStep } = context.instance;
    if (status !== 'running' || !currentStep) return false;
    const eligible = registration.definition.steps[currentStep]?.withdraw;
    return eligible ? this.isEligible(context, registration, eligible) : false;
  }

  private async isEligible(
    context: WorkflowAccess,
    registration: WorkflowRegistration,
    eligible: WorkflowEligibility,
  ) {
    const { actorId, db, subject } = context;
    if ('requester' in eligible) return actorId === (await registration.requester(context));
    return this.authorization.can(
      actorId,
      eligible.permission,
      { type: `${subject.module}.${subject.type}`, id: subject.id },
      db,
    );
  }

  private async openTask(
    tx: WorkflowTransaction,
    context: WorkflowAccess,
    registration: WorkflowRegistration,
    step: string,
  ) {
    const assignedUserId = await registration.assign?.(context, step);
    const [task] = await tx
      .insert(workflowTasks)
      .values({
        instanceId: context.instance.id,
        step,
        assignedUserId,
        status: 'pending',
        openedAt: sql`clock_timestamp()`,
      })
      .returning();
    return task;
  }

  private async findInstance(db: WorkflowReader, id: string, lock = false) {
    const query = db.select().from(workflowInstances).where(eq(workflowInstances.id, id));
    const [instance] = await (lock ? query.for('update') : query);
    return instance;
  }

  private async replay(tx: WorkflowTransaction, retry: Idempotency) {
    if (!retry.key) return undefined;
    const [event] = await tx
      .select()
      .from(workflowEvents)
      .where(
        and(
          eq(workflowEvents.actorId, retry.actorId),
          eq(workflowEvents.idempotencyScope, retry.scope),
          eq(workflowEvents.idempotencyKey, retry.key),
        ),
      );
    if (!event) return undefined;
    const instance = await this.findInstance(tx, event.instanceId);
    if (!instance || !(await this.visible(this.access(tx, retry.actorId, instance))))
      throw new NotFoundException();
    if (event.inputHash !== retry.hash)
      throw new ConflictException('Idempotency key was already used for different input');
    return event.result ?? undefined;
  }

  private async record(
    tx: WorkflowTransaction,
    result: WorkflowActionResult,
    taskId: string,
    action: string,
    retry: Idempotency,
    comment?: string,
    domainReference?: string,
  ) {
    await tx.insert(workflowEvents).values({
      instanceId: result.instanceId,
      taskId,
      action,
      actorId: retry.actorId,
      comment,
      domainReference,
      occurredAt: sql`clock_timestamp()`,
      ...(retry.key
        ? {
            idempotencyScope: retry.scope,
            idempotencyKey: retry.key,
            inputHash: retry.hash,
            result,
          }
        : {}),
    });
  }

  private instanceView(
    row: WorkflowInstance,
    registration: WorkflowRegistration,
  ): WorkflowInstanceResponse {
    return {
      id: row.id,
      definitionKey: row.definitionKey,
      definitionVersion: row.definitionVersion,
      subjectModule: row.subjectModule,
      subjectType: row.subjectType,
      subjectId: row.subjectId,
      startedBy: row.startedBy,
      status: row.status,
      currentStep: row.currentStep,
      startedAt: row.startedAt.toISOString(),
      lastActivityAt: row.lastActivityAt.toISOString(),
      completedAt: row.completedAt?.toISOString() ?? null,
      title: registration.definition.title,
      description: registration.definition.description,
    };
  }

  private taskView(
    task: WorkflowTask,
    row: WorkflowInstance,
    registration: WorkflowRegistration,
    actions: string[],
  ): WorkflowTaskResponse {
    const step = registration.definition.steps[task.step];
    return {
      id: task.id,
      instanceId: task.instanceId,
      step: task.step,
      assignedUserId: task.assignedUserId,
      status: task.status,
      openedAt: task.openedAt.toISOString(),
      completedAt: task.completedAt?.toISOString() ?? null,
      instance: this.instanceView(row, registration),
      title: step.title,
      instructions: step.instructions,
      actions,
    };
  }
}
