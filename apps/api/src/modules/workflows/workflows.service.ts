import { createHash } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  WorkflowActionResult,
  WorkflowHistoryEvent,
  WorkflowInstance as WorkflowInstanceResponse,
  WorkflowInstanceDetail,
  WorkflowTask as WorkflowTaskResponse,
} from '@project/contracts/workflow';
import type { Database } from '@project/db';
import { workflowEvents, workflowInstances, workflowTasks } from '@project/db/schema';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { AuthorizationService } from '../../auth/authorization.service.js';
import { DATABASE } from '../../database/database.constants.js';
import type {
  WorkflowAccess,
  WorkflowInstance,
  WorkflowReader,
  WorkflowRegistration,
  WorkflowSubject,
  WorkflowTask,
  WorkflowTransaction,
} from './workflow-definition.js';
import { WorkflowRegistry } from './workflow-registry.js';

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
      const [instance] = await tx
        .select()
        .from(workflowInstances)
        .where(eq(workflowInstances.id, target.instanceId))
        .for('update');
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

  async inbox(actorId: string): Promise<WorkflowTaskResponse[]> {
    const rows = await this.db
      .select({ task: workflowTasks, instance: workflowInstances })
      .from(workflowTasks)
      .innerJoin(workflowInstances, eq(workflowTasks.instanceId, workflowInstances.id))
      .where(eq(workflowTasks.status, 'pending'))
      .orderBy(asc(workflowTasks.openedAt), asc(workflowTasks.id));
    const visible = [];
    for (const { task, instance } of rows) {
      const context = this.access(this.db, actorId, instance);
      const registration = await this.visible(context);
      if (!registration) continue;
      const actions = await this.available(context, registration, task);
      if (actions.length) visible.push(this.taskView(task, instance, registration, actions));
    }
    return visible;
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
      history,
    };
  }

  async monitor(
    actorId: string,
    status?: WorkflowInstance['status'],
    step?: string,
  ): Promise<WorkflowInstanceResponse[]> {
    const rows = await this.db
      .select()
      .from(workflowInstances)
      .where(
        and(
          status ? eq(workflowInstances.status, status) : undefined,
          step ? eq(workflowInstances.currentStep, step) : undefined,
        ),
      )
      .orderBy(desc(workflowInstances.lastActivityAt), asc(workflowInstances.id));
    const visible = [];
    for (const row of rows) {
      const registration = await this.visible(this.access(this.db, actorId, row));
      if (registration) visible.push(this.instanceView(row, registration));
    }
    return visible;
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
  ) {
    if (
      task.status !== 'pending' ||
      context.instance.status !== 'running' ||
      context.instance.currentStep !== task.step
    )
      return [];
    if (task.assignedUserId && task.assignedUserId !== context.actorId) return [];
    const { eligible, actions } = registration.definition.steps[task.step];
    const { actorId, db, subject } = context;
    const eligibleActor =
      'permission' in eligible
        ? await this.authorization.can(
            actorId,
            eligible.permission,
            { type: `${subject.module}.${subject.type}`, id: subject.id },
            db,
          )
        : actorId === (await registration.requester(context));
    if (!eligibleActor) return [];
    const available: string[] = [];
    for (const action of Object.keys(actions)) {
      if (!registration.canAct || (await registration.canAct({ ...context, task, action })))
        available.push(action);
    }
    return available;
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

  private async findInstance(db: WorkflowReader, id: string) {
    const [instance] = await db
      .select()
      .from(workflowInstances)
      .where(eq(workflowInstances.id, id));
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
