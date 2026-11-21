import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  type OnModuleInit,
} from '@nestjs/common';
import { PERMISSION } from '@project/authorization';
import type { Database } from '@project/db';
import {
  inventoryAssets,
  inventoryRemovalDecisions,
  inventoryRemovalItems,
  inventoryRemovalRequests,
  workflowInstances,
} from '@project/db/schema';
import { and, asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { AuthorizationService } from '../../auth/authorization.service.js';
import { DATABASE } from '../../database/database.constants.js';
import type {
  WorkflowAction,
  WorkflowReader,
  WorkflowTransaction,
} from '../workflows/workflow-definition.js';
import { WorkflowRegistry } from '../workflows/workflow-registry.js';
import { WorkflowsService } from '../workflows/workflows.service.js';
import { inventoryRemoval } from './inventory-removal.definition.js';
import { asset, committeeDecision, proposal } from './inventory-removal.schemas.js';
import { InventoryTransactionsService } from './inventory-transactions.service.js';

const subjectType = 'removal-request';
const committeeWithdrawal = z.strictObject({ committeeUndecided: z.literal(true) });
function validate<T>(schema: z.ZodType<T>, value: unknown) {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new BadRequestException(result.error.issues.map(({ message }) => message));
  return result.data;
}

@Injectable()
export class InventoryRemovalService implements OnModuleInit {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(AuthorizationService) private readonly auth: AuthorizationService,
    @Inject(WorkflowRegistry) private readonly registry: WorkflowRegistry,
    @Inject(WorkflowsService) private readonly workflows: WorkflowsService,
    @Inject(InventoryTransactionsService)
    private readonly transactions: InventoryTransactionsService,
  ) {}

  onModuleInit() {
    this.registry.register({
      definition: inventoryRemoval,
      subjectType,
      active: true,
      canView: ({ db, actorId, subject }) => this.canView(db, actorId, subject.id),
      requester: async ({ db, subject }) =>
        (await this.request(db, subject.id))?.requesterId ?? null,
      canViewComment: async () => true,
      apply: (context) => this.apply(context),
    });
  }

  start(actorId: string, input: z.infer<typeof proposal>, idempotencyKey?: string) {
    return this.workflows.start({
      definitionKey: inventoryRemoval.key,
      actorId,
      idempotencyKey,
      input,
      create: async (tx) => {
        if (!(await this.auth.can(actorId, PERMISSION.inventory.requestRemoval, undefined, tx))) {
          throw new ForbiddenException();
        }
        const [request] = await tx
          .insert(inventoryRemovalRequests)
          .values({ requesterId: actorId })
          .returning();
        await this.saveItems(tx, request.id, 1, input.items);
        return {
          subject: { module: 'inventory', type: subjectType, id: request.id },
          domainReference: '1',
        };
      },
    });
  }

  async details(id: string, actorId: string) {
    if (!(await this.canView(this.db, actorId, id))) throw new NotFoundException();
    const request = await this.request(this.db, id);
    const [instance] = await this.db
      .select({ id: workflowInstances.id })
      .from(workflowInstances)
      .where(
        and(
          eq(workflowInstances.subjectModule, 'inventory'),
          eq(workflowInstances.subjectType, subjectType),
          eq(workflowInstances.subjectId, id),
        ),
      );
    const items = await this.db
      .select({
        assetId: inventoryRemovalItems.assetId,
        tag: inventoryAssets.tag,
        name: inventoryAssets.name,
        condition: inventoryAssets.condition,
        revision: inventoryRemovalItems.revision,
        reason: inventoryRemovalItems.reason,
        outcome: inventoryRemovalItems.outcome,
        decisionReason: inventoryRemovalItems.decisionReason,
      })
      .from(inventoryRemovalItems)
      .innerJoin(inventoryAssets, eq(inventoryAssets.id, inventoryRemovalItems.assetId))
      .where(eq(inventoryRemovalItems.requestId, id))
      .orderBy(asc(inventoryRemovalItems.revision), asc(inventoryAssets.tag));
    const [decision] = await this.db
      .select()
      .from(inventoryRemovalDecisions)
      .where(eq(inventoryRemovalDecisions.requestId, id));
    return { ...request, instanceId: instance.id, items, decision: decision ?? null };
  }

  async listAssets(actorId: string, requestId?: string) {
    const allowed = await Promise.all([
      this.auth.can(actorId, PERMISSION.inventory.requestRemoval),
      this.auth.can(actorId, PERMISSION.inventory.manageAssets),
    ]);
    if (!allowed.some(Boolean)) {
      const [revision] = requestId
        ? await this.db
            .select({ id: inventoryRemovalRequests.id })
            .from(inventoryRemovalRequests)
            .innerJoin(
              workflowInstances,
              eq(workflowInstances.subjectId, inventoryRemovalRequests.id),
            )
            .where(
              and(
                eq(inventoryRemovalRequests.id, requestId),
                eq(inventoryRemovalRequests.requesterId, actorId),
                eq(workflowInstances.subjectModule, 'inventory'),
                eq(workflowInstances.subjectType, subjectType),
                eq(workflowInstances.status, 'running'),
                eq(workflowInstances.currentStep, 'revise'),
              ),
            )
        : [];
      if (!revision) throw new ForbiddenException();
    }
    return this.db
      .select({
        id: inventoryAssets.id,
        tag: inventoryAssets.tag,
        name: inventoryAssets.name,
        status: inventoryAssets.status,
      })
      .from(inventoryAssets)
      .orderBy(asc(inventoryAssets.tag));
  }

  registerAsset(actorId: string, input: z.infer<typeof asset>) {
    return this.transactions.registerLegacy(actorId, input);
  }

  changeCustody(actorId: string, id: string, employeeId: string | null) {
    return this.transactions.changeLegacyCustody(actorId, id, employeeId);
  }

  private async canView(db: WorkflowReader, actorId: string, id: string) {
    const request = await this.request(db, id);
    if (!request) return false;
    if (request.requesterId === actorId) return true;
    const resource = { type: `inventory.${subjectType}`, id };
    return (
      (await this.auth.can(actorId, PERMISSION.inventory.reviewRemoval, resource, db)) ||
      (await this.auth.can(actorId, PERMISSION.inventory.decideRemoval, resource, db)) ||
      (await this.auth.can(actorId, PERMISSION.inventory.withdrawRemoval, resource, db))
    );
  }

  private async request(db: WorkflowReader, id: string) {
    const [request] = await db
      .select()
      .from(inventoryRemovalRequests)
      .where(eq(inventoryRemovalRequests.id, id));
    return request;
  }

  private async apply({ db, subject, actorId, task, action, comment, input }: WorkflowAction) {
    const request = await this.request(db, subject.id);
    if (!request) throw new NotFoundException();
    if (
      action === 'withdraw' &&
      task.step === 'committee-decision' &&
      !committeeWithdrawal.safeParse(input).success
    ) {
      throw new BadRequestException('Confirm that the committee has not made a decision');
    }
    if (action === 'return' && !comment?.trim())
      throw new BadRequestException('Enter a reason for returning the request');
    if (action === 'resubmit') {
      const revision = request.currentRevision + 1;
      await this.saveItems(db, subject.id, revision, validate(proposal, input).items);
      await db
        .update(inventoryRemovalRequests)
        .set({ currentRevision: revision })
        .where(eq(inventoryRemovalRequests.id, subject.id));
      return { domainReference: String(revision) };
    }
    if (action === 'record-decision') {
      return {
        domainReference: await this.recordDecision(
          db,
          request,
          actorId,
          validate(committeeDecision, input),
        ),
      };
    }
    return { domainReference: String(request.currentRevision) };
  }

  private async saveItems(
    tx: WorkflowTransaction,
    requestId: string,
    revision: number,
    items: z.infer<typeof proposal>['items'],
  ) {
    const assets = await this.transactions.lockAssets(
      tx,
      items.map(({ assetId }) => assetId),
    );
    const values = [];
    for (const item of items) {
      const asset = assets.find(({ id }) => id === item.assetId)!;
      if (asset.status !== 'active')
        throw new ConflictException('A proposed asset has been decommissioned');
      const custody = await this.transactions.activeCustody(tx, asset.id);
      values.push({
        ...item,
        requestId,
        revision,
        assetRevision: asset.revision,
        custodyId: custody?.id,
      });
    }
    await tx.insert(inventoryRemovalItems).values(values);
  }

  private async recordDecision(
    tx: WorkflowTransaction,
    request: typeof inventoryRemovalRequests.$inferSelect,
    actorId: string,
    input: z.infer<typeof committeeDecision>,
  ) {
    const matchRevision = and(
      eq(inventoryRemovalItems.requestId, request.id),
      eq(inventoryRemovalItems.revision, request.currentRevision),
    );
    const proposal = await tx.select().from(inventoryRemovalItems).where(matchRevision);
    if (
      proposal.length !== input.items.length ||
      input.items.some((line) => !proposal.some(({ assetId }) => assetId === line.assetId))
    ) {
      throw new BadRequestException('Record exactly one decision for every proposed asset');
    }

    const approved = input.items.filter(({ outcome }) => outcome === 'approved-for-waste');
    const assets = approved.length
      ? await this.transactions.lockAssets(
          tx,
          approved.map(({ assetId }) => assetId),
        )
      : [];
    const stateChanges = new Map<
      string,
      Awaited<ReturnType<InventoryTransactionsService['decommission']>>
    >();
    for (const row of assets) {
      const original = proposal.find(({ assetId }) => assetId === row.id)!;
      const custody = await this.transactions.activeCustody(tx, row.id);
      if (
        row.status !== 'active' ||
        row.revision !== original.assetRevision ||
        (custody?.id ?? null) !== original.custodyId
      ) {
        throw new ConflictException(
          'A proposed asset changed during review. Return the request for revision.',
        );
      }
      stateChanges.set(row.id, await this.transactions.decommission(tx, row, custody));
    }

    for (const line of input.items) {
      await tx
        .update(inventoryRemovalItems)
        .set({ outcome: line.outcome, decisionReason: line.reason })
        .where(and(matchRevision, eq(inventoryRemovalItems.assetId, line.assetId)));
    }
    const [decision] = await tx
      .insert(inventoryRemovalDecisions)
      .values({
        requestId: request.id,
        revision: request.currentRevision,
        actorId,
        name: input.name,
        reference: input.reference,
        decidedOn: input.decidedOn,
      })
      .returning({ id: inventoryRemovalDecisions.id });
    await this.transactions.record(
      tx,
      {
        type: 'committee-decision',
        name: input.name,
        reference: input.reference,
        eventDate: input.decidedOn,
        actorId,
        decisionId: decision.id,
      },
      input.items.map(({ assetId, outcome, reason }) => ({
        assetId,
        outcome,
        reason,
        ...stateChanges.get(assetId),
      })),
    );
    return decision.id;
  }
}
