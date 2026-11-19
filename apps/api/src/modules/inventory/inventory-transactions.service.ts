import { createHash } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PERMISSION } from '@project/authorization';
import type { Database } from '@project/db';
import {
  facilitiesRooms,
  fallbackInventoryCustodian,
  hrEmployees,
  inventoryAssets,
  inventoryBalances,
  inventoryConsumables,
  inventoryCustodies,
  inventorySharedAccounts,
  inventoryStorage,
  inventoryTransactions,
  inventoryTransactionLines,
} from '@project/db/schema';
import type { InventoryAssetSnapshot } from '@project/db/schema';
import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { AuthorizationService } from '../../auth/authorization.service.js';
import { DATABASE } from '../../database/database.constants.js';
import type { WorkflowTransaction as Tx } from '../workflows/workflow-definition.js';
import type { Party, TransactionInput } from './inventory.schemas.js';

type Asset = typeof inventoryAssets.$inferSelect;
type Custody = typeof inventoryCustodies.$inferSelect;
type Header = typeof inventoryTransactions.$inferInsert;
type Line = Omit<typeof inventoryTransactionLines.$inferInsert, 'transactionId' | 'line'>;
type Delta = { roomId: string; consumableId: string; quantity: number };

function snapshot(asset: Asset, custody?: Custody): InventoryAssetSnapshot {
  const { roomId, revision, status, condition } = asset;
  return {
    roomId,
    revision,
    status,
    condition,
    employeeId: custody?.employeeId ?? null,
    sharedAccountId: custody?.sharedAccountId ?? null,
  };
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') {
    return (
      '{' +
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, field]) => JSON.stringify(key) + ':' + canonical(field))
        .join(',') +
      '}'
    );
  }
  return JSON.stringify(value);
}

@Injectable()
export class InventoryTransactionsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(AuthorizationService) private readonly auth: AuthorizationService,
  ) {}

  post(actorId: string, input: TransactionInput, idempotencyKey?: string) {
    return this.db.transaction(async (tx) => {
      const permission =
        input.type === 'disposal'
          ? PERMISSION.inventory.dispose
          : PERMISSION.inventory.postTransactions;
      if (!(await this.auth.can(actorId, permission, undefined, tx)))
        throw new ForbiddenException();
      let inputHash: string | undefined;
      if (idempotencyKey) {
        inputHash = createHash('sha256').update(canonical(input)).digest('hex');
        const lock = JSON.stringify(['inventory-post', actorId, idempotencyKey]);
        await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${lock}, 0))`);
        const [existing] = await tx
          .select()
          .from(inventoryTransactions)
          .where(
            and(
              eq(inventoryTransactions.actorId, actorId),
              eq(inventoryTransactions.idempotencyKey, idempotencyKey),
            ),
          );
        if (existing) {
          if (existing.inputHash !== inputHash)
            throw new ConflictException('Idempotency key already used with different input');
          return { id: existing.id, type: existing.type };
        }
      }

      const header: Header = {
        actorId,
        idempotencyKey,
        inputHash,
        type: input.type,
        name: input.name,
        reference: input.reference,
        eventDate: input.eventDate,
        notes: input.notes,
      };
      const lines: Line[] = [];
      const deltas: Delta[] = [];
      const existingIds = input.items.flatMap((item) => ('assetId' in item ? [item.assetId] : []));
      if (new Set(existingIds).size !== existingIds.length) {
        throw new BadRequestException('Each asset may appear only once per transaction');
      }
      const consumableIds = input.items.flatMap((item) =>
        'consumableId' in item ? [item.consumableId] : [],
      );
      if (new Set(consumableIds).size !== consumableIds.length)
        throw new BadRequestException('Each consumable may appear only once per transaction');
      const locked = await this.lockAssets(tx, existingIds);
      const byId = new Map(locked.map((asset) => [asset.id, asset]));
      let destination: Party | undefined;
      if ('sourceRoomId' in input) {
        await this.storage(tx, input.sourceRoomId, false);
        header.sourceRoomId = input.sourceRoomId;
      }
      if (
        input.type === 'receipt' ||
        input.type === 'asset-return' ||
        input.type === 'storage-relocation'
      ) {
        const location = await this.storage(tx, input.destinationRoomId, true);
        destination = { kind: 'shared', id: location.sharedAccountId };
        header.destinationRoomId = input.destinationRoomId;
      }
      if (input.type === 'storage-relocation' && input.sourceRoomId === input.destinationRoomId)
        throw new BadRequestException('Storage locations must differ');
      if ('recipient' in input) {
        destination = input.recipient;
        await this.validateParty(tx, destination);
        if (input.destinationRoomId) await this.checkRoom(tx, input.destinationRoomId);
        header.destinationRoomId = input.destinationRoomId;
        if (destination.kind === 'employee') header.recipientEmployeeId = destination.id;
      }
      if (input.type === 'receipt') header.source = input.source;
      if (input.type === 'consumable-issue') {
        await this.validateParty(tx, { kind: 'employee', id: input.employeeId });
        header.recipientEmployeeId = input.employeeId;
      }
      if (input.type === 'consumable-adjustment') {
        await this.storage(
          tx,
          input.roomId,
          input.items.some(({ delta }) => delta > 0),
        );
        header.sourceRoomId = input.roomId;
      }

      // Acquire unique tag locks in the same order for competing receipts.
      const ordered =
        input.type === 'receipt'
          ? [...input.items].sort((left, right) => {
              const leftTag = 'tag' in left ? left.tag : '';
              const rightTag = 'tag' in right ? right.tag : '';
              return leftTag < rightTag ? -1 : leftTag > rightTag ? 1 : 0;
            })
          : input.items;
      const conditions =
        input.type === 'condition-change'
          ? new Map(input.items.map((item) => [item.assetId, item]))
          : undefined;
      for (const item of ordered) {
        if ('tag' in item) {
          if (input.type !== 'receipt' || !destination)
            throw new Error('Missing receipt destination');
          const { kind: _kind, ...fields } = item;
          const asset = await this.createAsset(
            tx,
            { ...fields, roomId: input.destinationRoomId },
            destination,
          );
          lines.push({
            assetId: asset.id,
            after: snapshot(asset, await this.activeCustody(tx, asset.id)),
          });
        } else if ('consumableId' in item) {
          const { consumableId } = item;
          const quantity = 'delta' in item ? item.delta : item.quantity;
          if (input.type === 'receipt' || input.type === 'storage-relocation') {
            deltas.push({ consumableId, quantity, roomId: input.destinationRoomId });
          }
          if (input.type === 'consumable-issue' || input.type === 'storage-relocation') {
            deltas.push({ consumableId, quantity: -quantity, roomId: input.sourceRoomId });
          }
          if (input.type === 'consumable-adjustment') {
            deltas.push({ consumableId, quantity, roomId: input.roomId });
          }
          lines.push({
            consumableId,
            quantity,
            reason: 'reason' in item ? item.reason : undefined,
          });
        } else {
          const asset = byId.get(item.assetId)!;
          if (asset.revision !== item.expectedRevision)
            throw new ConflictException('Asset changed since it was loaded');
          const current = await this.activeCustody(tx, asset.id);
          const before = snapshot(asset, current);
          const changes: Partial<Asset> = {};
          let reason: string | undefined;
          if (input.type === 'disposal') {
            if (asset.status !== 'decommissioned')
              throw new ConflictException('Only decommissioned assets can be disposed');
            const [approval] = await tx
              .select({ id: inventoryTransactions.id })
              .from(inventoryTransactions)
              .innerJoin(
                inventoryTransactionLines,
                eq(inventoryTransactionLines.transactionId, inventoryTransactions.id),
              )
              .where(
                and(
                  eq(inventoryTransactions.type, 'committee-decision'),
                  eq(inventoryTransactionLines.assetId, asset.id),
                  eq(inventoryTransactionLines.outcome, 'approved-for-waste'),
                ),
              )
              .limit(1);
            if (!approval)
              throw new ConflictException(
                'A committee approval is required before physical disposal',
              );
            changes.status = 'disposed';
            changes.roomId = null;
          } else if (asset.status !== 'active') {
            throw new ConflictException('Only active assets can be moved or reclassified');
          }
          if (input.type === 'asset-issue' || input.type === 'storage-relocation') {
            if (asset.roomId !== input.sourceRoomId)
              throw new ConflictException('Asset is no longer at the source room');
          }
          if (input.type === 'asset-issue' && !current?.sharedAccountId)
            throw new ConflictException('Asset is not in shared custody');
          if ('from' in input) {
            const currentId =
              input.from.kind === 'employee' ? current?.employeeId : current?.sharedAccountId;
            if (currentId !== input.from.id)
              throw new ConflictException('Asset custody no longer matches the source');
          }
          if (
            input.type === 'asset-return' ||
            input.type === 'storage-relocation' ||
            'recipient' in input
          ) {
            if (input.destinationRoomId !== undefined) changes.roomId = input.destinationRoomId;
          }
          const conditionChange = conditions?.get(asset.id);
          if (conditionChange) {
            if (asset.condition === conditionChange.condition)
              throw new ConflictException('Asset already has this condition');
            changes.condition = conditionChange.condition;
            reason = conditionChange.reason;
          }
          if (
            input.type === 'asset-issue' ||
            input.type === 'asset-handover' ||
            input.type === 'asset-return'
          ) {
            await this.replaceCustody(tx, asset.id, destination!);
          }
          const updated = await this.updateAsset(tx, asset, changes);
          lines.push({
            assetId: asset.id,
            before,
            after: snapshot(updated, await this.activeCustody(tx, asset.id)),
            reason,
          });
        }
      }
      await this.applyDeltas(tx, deltas);
      return this.record(tx, header, lines);
    });
  }

  async registerLegacy(actorId: string, input: { tag: string; name: string; employeeId?: string }) {
    return this.db.transaction(async (tx) => {
      const party: Party = input.employeeId
        ? { kind: 'employee', id: input.employeeId }
        : { kind: 'shared', id: fallbackInventoryCustodian };
      await this.validateParty(tx, party);
      const { tag, name } = input;
      const asset = await this.createAsset(tx, { tag, name }, party);
      await this.record(tx, this.legacyHeader('asset-registration', actorId, 'Register asset'), [
        { assetId: asset.id, after: snapshot(asset, await this.activeCustody(tx, asset.id)) },
      ]);
      return asset;
    });
  }

  async changeLegacyCustody(actorId: string, assetId: string, employeeId: string | null) {
    return this.db.transaction(async (tx) => {
      const [asset] = await this.lockAssets(tx, [assetId]);
      if (asset.status !== 'active') throw new ConflictException('Asset has been decommissioned');
      const [storage] = asset.roomId
        ? await tx.select().from(inventoryStorage).where(eq(inventoryStorage.roomId, asset.roomId))
        : [];
      const party: Party = employeeId
        ? { kind: 'employee', id: employeeId }
        : { kind: 'shared', id: storage?.sharedAccountId ?? fallbackInventoryCustodian };
      await this.validateParty(tx, party);
      const before = snapshot(asset, await this.activeCustody(tx, assetId));
      await this.replaceCustody(tx, assetId, party);
      const updated = await this.updateAsset(tx, asset, {});
      await this.record(tx, this.legacyHeader('custody-change', actorId, 'Change asset custody'), [
        { assetId, before, after: snapshot(updated, await this.activeCustody(tx, assetId)) },
      ]);
    });
  }

  async lockAssets(tx: Tx, ids: string[]) {
    if (!ids.length) return [];
    const assets = await tx
      .select()
      .from(inventoryAssets)
      .where(inArray(inventoryAssets.id, ids))
      .orderBy(asc(inventoryAssets.id))
      .for('update');
    if (assets.length !== ids.length)
      throw new NotFoundException('One or more assets were not found');
    return assets;
  }

  async activeCustody(tx: Tx, assetId: string) {
    const [custody] = await tx
      .select()
      .from(inventoryCustodies)
      .where(and(eq(inventoryCustodies.assetId, assetId), isNull(inventoryCustodies.endedAt)));
    return custody;
  }

  async decommission(tx: Tx, asset: Asset, custody?: Custody) {
    const after = await this.updateAsset(tx, asset, { status: 'decommissioned' });
    await this.replaceCustody(tx, asset.id);
    return { before: snapshot(asset, custody), after: snapshot(after) };
  }

  async record(tx: Tx, header: Header, lines: Line[]) {
    const [entry] = await tx.insert(inventoryTransactions).values(header).returning({
      id: inventoryTransactions.id,
      type: inventoryTransactions.type,
    });
    await tx.insert(inventoryTransactionLines).values(
      lines.map((line, index) => ({
        ...line,
        transactionId: entry.id,
        line: index + 1,
      })),
    );
    return entry;
  }

  async checkRoom(tx: Tx, roomId: string) {
    const [room] = await tx
      .select()
      .from(facilitiesRooms)
      .where(eq(facilitiesRooms.roomId, roomId))
      .for('share');
    if (room?.status !== 'active')
      throw new BadRequestException('An active Facilities room is required');
  }

  async validateParty(tx: Tx, party: Party) {
    const rows =
      party.kind === 'employee'
        ? await tx
            .select({ id: hrEmployees.employeeId })
            .from(hrEmployees)
            .where(eq(hrEmployees.employeeId, party.id))
            .for('key share')
        : await tx
            .select({ id: inventorySharedAccounts.id })
            .from(inventorySharedAccounts)
            .where(eq(inventorySharedAccounts.id, party.id))
            .for('key share');
    if (!rows.length) throw new BadRequestException('Responsible party was not found');
  }

  private async storage(tx: Tx, roomId: string, inbound: boolean) {
    const [location] = await tx
      .select()
      .from(inventoryStorage)
      .where(eq(inventoryStorage.roomId, roomId))
      .for('share');
    if (!location || (inbound && !location.enabled))
      throw new BadRequestException('Storage location is unavailable');
    if (inbound) await this.checkRoom(tx, roomId);
    return location;
  }

  private async createAsset(tx: Tx, fields: typeof inventoryAssets.$inferInsert, party: Party) {
    const now = new Date();
    const [asset] = await tx
      .insert(inventoryAssets)
      .values({
        ...fields,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing({ target: inventoryAssets.tag })
      .returning();
    if (!asset) throw new ConflictException('Asset tag already exists');
    await this.replaceCustody(tx, asset.id, party);
    return asset;
  }

  private async updateAsset(tx: Tx, asset: Asset, changes: Partial<Asset>) {
    const [updated] = await tx
      .update(inventoryAssets)
      .set({
        ...changes,
        revision: asset.revision + 1,
        updatedAt: new Date(),
      })
      .where(eq(inventoryAssets.id, asset.id))
      .returning();
    return updated;
  }

  private async replaceCustody(tx: Tx, assetId: string, party?: Party) {
    const now = new Date();
    await tx
      .update(inventoryCustodies)
      .set({ endedAt: now })
      .where(and(eq(inventoryCustodies.assetId, assetId), isNull(inventoryCustodies.endedAt)));
    if (party)
      await tx.insert(inventoryCustodies).values({
        assetId,
        openedAt: now,
        employeeId: party.kind === 'employee' ? party.id : null,
        sharedAccountId: party.kind === 'shared' ? party.id : null,
      });
  }

  private legacyHeader(
    type: 'asset-registration' | 'custody-change',
    actorId: string,
    name: string,
  ): Header {
    return { type, actorId, name, eventDate: new Date().toISOString().slice(0, 10) };
  }

  private async applyDeltas(tx: Tx, deltas: Delta[]) {
    const grouped = new Map<string, Delta>();
    for (const delta of deltas) {
      const key = delta.consumableId + ':' + delta.roomId;
      const previous = grouped.get(key);
      grouped.set(key, { ...delta, quantity: delta.quantity + (previous?.quantity ?? 0) });
    }
    const changes = [...grouped.entries()].sort(([left], [right]) => left.localeCompare(right));
    for (const [, { consumableId, roomId, quantity }] of changes) {
      const [item] = await tx
        .select({ id: inventoryConsumables.id })
        .from(inventoryConsumables)
        .where(eq(inventoryConsumables.id, consumableId))
        .for('key share');
      if (!item) throw new BadRequestException('Consumable was not found');
      await tx.insert(inventoryBalances).values({ consumableId, roomId }).onConflictDoNothing();
      const key = and(
        eq(inventoryBalances.consumableId, consumableId),
        eq(inventoryBalances.roomId, roomId),
      );
      const [balance] = await tx.select().from(inventoryBalances).where(key).for('update');
      const next = balance.quantity + quantity;
      if (next < 0) throw new ConflictException('Insufficient stock');
      if (next > 2147483647) throw new ConflictException('Stock limit exceeded');
      await tx.update(inventoryBalances).set({ quantity: next }).where(key);
    }
  }
}
