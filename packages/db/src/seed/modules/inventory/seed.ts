import { and, eq, isNull, or, sql } from 'drizzle-orm';
import {
  facilitiesBuildings,
  facilitiesRooms,
  hrEmployees,
  inventoryAssets,
  inventoryBalances,
  inventoryConsumables,
  inventoryCustodies,
  inventorySharedAccounts,
  inventoryStorage,
  inventoryTransactionLines,
  inventoryTransactions,
} from '../../../schema/index.js';
import type { InventoryAssetSnapshot } from '../../../schema/inventory/index.js';
import type { InventorySeed, SeedRoom } from '../../fixtures/local/types.js';
import { roomKey } from './validation.js';
import type { SeedTransaction } from '../../types.js';

type Asset = typeof inventoryAssets.$inferSelect;
type Entry = typeof inventoryTransactions.$inferInsert;

function snapshot(
  asset: Asset,
  party: Pick<InventoryAssetSnapshot, 'employeeId' | 'sharedAccountId'>,
): InventoryAssetSnapshot {
  const { roomId, revision, status, condition } = asset;
  return { roomId, revision, status, condition, ...party };
}

async function resolveRoom(tx: SeedTransaction, room: SeedRoom) {
  const [found] = await tx
    .select({ id: facilitiesRooms.roomId })
    .from(facilitiesRooms)
    .innerJoin(facilitiesBuildings, eq(facilitiesBuildings.buildingId, facilitiesRooms.buildingId))
    .where(
      and(
        eq(facilitiesBuildings.buildingCode, room.buildingCode),
        eq(facilitiesRooms.roomCode, room.roomCode),
        eq(facilitiesRooms.status, 'active'),
      ),
    );
  if (!found) throw new Error(`Could not resolve Inventory room ${roomKey(room)}`);
  return found.id;
}

async function alreadyPosted(
  tx: SeedTransaction,
  entry: Entry & { id: string; reference: string },
) {
  const rows = await tx
    .select()
    .from(inventoryTransactions)
    .where(
      or(
        eq(inventoryTransactions.id, entry.id),
        eq(inventoryTransactions.reference, entry.reference),
      ),
    );
  if (
    rows.some(
      (row) =>
        row.id !== entry.id ||
        row.reference !== entry.reference ||
        row.type !== entry.type ||
        row.actorId !== entry.actorId,
    )
  ) {
    throw new Error(`Inventory seed transaction collision for ${entry.reference}`);
  }
  return rows.length > 0;
}

export async function seedInventory(tx: SeedTransaction, seed: InventorySeed, actorId: string) {
  for (const fixture of seed.sharedAccounts) {
    const existing = await tx
      .select()
      .from(inventorySharedAccounts)
      .where(
        or(
          eq(inventorySharedAccounts.id, fixture.id),
          eq(inventorySharedAccounts.name, fixture.name),
        ),
      );
    if (existing.some(({ id, name }) => id !== fixture.id || name !== fixture.name))
      throw new Error(`Inventory seed shared account collision for ${fixture.name}`);
    if (!existing.length) await tx.insert(inventorySharedAccounts).values(fixture);
  }

  const consumableIds = new Map<string, string>();
  for (const fixture of seed.consumables) {
    const existing = await tx
      .select()
      .from(inventoryConsumables)
      .where(
        or(eq(inventoryConsumables.id, fixture.id), eq(inventoryConsumables.code, fixture.code)),
      );
    if (existing.some(({ id, code }) => id !== fixture.id || code !== fixture.code))
      throw new Error(`Inventory seed consumable collision for ${fixture.code}`);
    if (!existing.length) await tx.insert(inventoryConsumables).values(fixture);
    consumableIds.set(fixture.code, fixture.id);
  }

  const storageIds = new Map<string, string>();
  for (const fixture of seed.storage) {
    const roomId = await resolveRoom(tx, fixture);
    await tx
      .insert(inventoryStorage)
      .values({ roomId, sharedAccountId: fixture.sharedAccountId })
      .onConflictDoNothing({ target: inventoryStorage.roomId });
    storageIds.set(roomKey(fixture), roomId);
  }

  const openingAssets = new Map<string, { id: string; roomId: string }>();
  for (const { room, assets, stock, ...receipt } of seed.receipts) {
    const roomId = storageIds.get(roomKey(room))!;
    const header = { ...receipt, type: 'receipt', actorId, destinationRoomId: roomId } as const;
    const posted = await alreadyPosted(tx, header);
    for (const fixture of assets) {
      const matches = await tx
        .select({ id: inventoryAssets.id, tag: inventoryAssets.tag })
        .from(inventoryAssets)
        .where(or(eq(inventoryAssets.id, fixture.id), eq(inventoryAssets.tag, fixture.tag)));
      if (
        matches.some(({ id, tag }) => id !== fixture.id || tag !== fixture.tag) ||
        (posted ? matches.length !== 1 : matches.length !== 0)
      ) {
        throw new Error(
          `Inventory seed asset collision or missing opening asset for ${fixture.tag}`,
        );
      }
      openingAssets.set(fixture.tag, { id: fixture.id, roomId });
    }
    if (posted) continue;

    const [storage] = await tx
      .select()
      .from(inventoryStorage)
      .where(eq(inventoryStorage.roomId, roomId));
    if (!storage?.enabled)
      throw new Error(`Inventory seed storage is disabled for ${receipt.reference}`);
    await tx.insert(inventoryTransactions).values(header);
    const now = new Date();
    let line = 0;
    for (const fields of assets) {
      const [asset] = await tx
        .insert(inventoryAssets)
        .values({
          ...fields,
          roomId,
          acquisitionReference: receipt.reference,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      const party = { sharedAccountId: storage.sharedAccountId, employeeId: null };
      await tx.insert(inventoryCustodies).values({ assetId: asset.id, ...party, openedAt: now });
      await tx.insert(inventoryTransactionLines).values({
        transactionId: receipt.id,
        line: ++line,
        assetId: asset.id,
        after: snapshot(asset, party),
      });
    }
    for (const { code, quantity } of stock) {
      const consumableId = consumableIds.get(code)!;
      await tx
        .insert(inventoryBalances)
        .values({ consumableId, roomId, quantity })
        .onConflictDoUpdate({
          target: [inventoryBalances.consumableId, inventoryBalances.roomId],
          set: { quantity: sql`${inventoryBalances.quantity} + excluded.quantity` },
        });
      await tx.insert(inventoryTransactionLines).values({
        transactionId: receipt.id,
        line: ++line,
        consumableId,
        quantity,
      });
    }
  }

  for (const { assetTag, employeeNumber, room, ...issue } of seed.issues) {
    const source = openingAssets.get(assetTag)!;
    const header = { ...issue, type: 'asset-issue', actorId, sourceRoomId: source.roomId } as const;
    if (await alreadyPosted(tx, header)) continue;

    const [asset] = await tx
      .select()
      .from(inventoryAssets)
      .where(eq(inventoryAssets.id, source.id))
      .for('update');
    const [custody] = await tx
      .select()
      .from(inventoryCustodies)
      .where(and(eq(inventoryCustodies.assetId, source.id), isNull(inventoryCustodies.endedAt)));
    if (
      !asset ||
      asset.status !== 'active' ||
      asset.revision !== 1 ||
      asset.roomId !== source.roomId ||
      !custody?.sharedAccountId
    ) {
      throw new Error(
        `Inventory opening issue ${issue.reference} cannot modify an asset that has already changed`,
      );
    }
    const [employee] = await tx
      .select({ id: hrEmployees.employeeId })
      .from(hrEmployees)
      .where(eq(hrEmployees.employeeNumber, employeeNumber));
    if (!employee) throw new Error(`Could not resolve Inventory employee ${employeeNumber}`);
    const party = { employeeId: employee.id, sharedAccountId: null };
    const roomId = room ? await resolveRoom(tx, room) : null;
    const now = new Date();
    await tx.insert(inventoryTransactions).values({
      ...header,
      destinationRoomId: roomId,
      recipientEmployeeId: employee.id,
    });
    await tx
      .update(inventoryCustodies)
      .set({ endedAt: now })
      .where(eq(inventoryCustodies.id, custody.id));
    await tx.insert(inventoryCustodies).values({ assetId: asset.id, openedAt: now, ...party });
    const [updated] = await tx
      .update(inventoryAssets)
      .set({ roomId, revision: 2, updatedAt: now })
      .where(eq(inventoryAssets.id, asset.id))
      .returning();
    await tx.insert(inventoryTransactionLines).values({
      transactionId: issue.id,
      line: 1,
      assetId: asset.id,
      before: snapshot(asset, { employeeId: null, sharedAccountId: custody.sharedAccountId }),
      after: snapshot(updated, party),
    });
  }

  return {
    assetCount: openingAssets.size,
    consumableCount: consumableIds.size,
    storageCount: storageIds.size,
  };
}
