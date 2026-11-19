import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Database } from '@project/db';
import {
  facilitiesRooms,
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
import { and, asc, desc, eq, exists, gte, ilike, isNull, lte, or, sql } from 'drizzle-orm';
import type { z } from 'zod';
import { DATABASE } from '../../database/database.constants.js';
import { InventoryTransactionsService } from './inventory-transactions.service.js';
import type {
  assetQuery,
  historyQuery,
  referenceQuery,
  stockQuery,
  storageInput,
} from './inventory.schemas.js';

function pattern(query: string) {
  return '%' + query.replace(/[\\%_]/g, '\\$&') + '%';
}

@Injectable()
export class InventoryReadService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(InventoryTransactionsService)
    private readonly transactions: InventoryTransactionsService,
  ) {}

  assets(query: z.infer<typeof assetQuery>) {
    const { q, category, employeeId, sharedAccountId, roomId, condition, status, offset, limit } =
      query;
    return this.db
      .select({ asset: inventoryAssets, custody: inventoryCustodies })
      .from(inventoryAssets)
      .leftJoin(
        inventoryCustodies,
        and(eq(inventoryCustodies.assetId, inventoryAssets.id), isNull(inventoryCustodies.endedAt)),
      )
      .where(
        and(
          q
            ? or(
                ilike(inventoryAssets.tag, pattern(q)),
                ilike(inventoryAssets.name, pattern(q)),
                ilike(inventoryAssets.category, pattern(q)),
              )
            : undefined,
          category ? eq(inventoryAssets.category, category) : undefined,
          roomId ? eq(inventoryAssets.roomId, roomId) : undefined,
          employeeId ? eq(inventoryCustodies.employeeId, employeeId) : undefined,
          sharedAccountId ? eq(inventoryCustodies.sharedAccountId, sharedAccountId) : undefined,
          condition ? eq(inventoryAssets.condition, condition) : undefined,
          status ? eq(inventoryAssets.status, status) : undefined,
        ),
      )
      .orderBy(asc(inventoryAssets.tag))
      .limit(limit)
      .offset(offset);
  }

  stock({ q, roomId, consumableId, offset, limit }: z.infer<typeof stockQuery>) {
    return this.db
      .select({
        roomId: inventoryBalances.roomId,
        quantity: inventoryBalances.quantity,
        item: inventoryConsumables,
      })
      .from(inventoryBalances)
      .innerJoin(inventoryConsumables, eq(inventoryConsumables.id, inventoryBalances.consumableId))
      .where(
        and(
          q
            ? or(
                ilike(inventoryConsumables.code, pattern(q)),
                ilike(inventoryConsumables.name, pattern(q)),
              )
            : undefined,
          roomId ? eq(inventoryBalances.roomId, roomId) : undefined,
          consumableId ? eq(inventoryBalances.consumableId, consumableId) : undefined,
        ),
      )
      .orderBy(asc(inventoryConsumables.code), asc(inventoryBalances.roomId))
      .limit(limit)
      .offset(offset);
  }

  history({
    type,
    from,
    to,
    actorId,
    assetId,
    consumableId,
    reference,
    offset,
    limit,
  }: z.infer<typeof historyQuery>) {
    const matching = (item: ReturnType<typeof eq>) =>
      exists(
        this.db
          .select({ one: sql`1` })
          .from(inventoryTransactionLines)
          .where(and(eq(inventoryTransactionLines.transactionId, inventoryTransactions.id), item)),
      );
    return this.db
      .select(this.historyFields())
      .from(inventoryTransactions)
      .where(
        and(
          type ? eq(inventoryTransactions.type, type) : undefined,
          from ? gte(inventoryTransactions.eventDate, from) : undefined,
          to ? lte(inventoryTransactions.eventDate, to) : undefined,
          actorId ? eq(inventoryTransactions.actorId, actorId) : undefined,
          reference ? ilike(inventoryTransactions.reference, pattern(reference)) : undefined,
          assetId ? matching(eq(inventoryTransactionLines.assetId, assetId)) : undefined,
          consumableId
            ? matching(eq(inventoryTransactionLines.consumableId, consumableId))
            : undefined,
        ),
      )
      .orderBy(desc(inventoryTransactions.eventDate), desc(inventoryTransactions.id))
      .limit(limit)
      .offset(offset);
  }

  async detail(id: string) {
    const [header] = await this.db
      .select(this.historyFields())
      .from(inventoryTransactions)
      .where(eq(inventoryTransactions.id, id));
    if (!header) throw new NotFoundException();
    const items = await this.db
      .select()
      .from(inventoryTransactionLines)
      .where(eq(inventoryTransactionLines.transactionId, id))
      .orderBy(asc(inventoryTransactionLines.line));
    return { ...header, items };
  }

  rooms({ q, limit, offset }: z.infer<typeof referenceQuery>) {
    return this.db
      .select({
        id: facilitiesRooms.roomId,
        code: facilitiesRooms.roomCode,
        name: facilitiesRooms.title,
        status: facilitiesRooms.status,
        storage: inventoryStorage,
      })
      .from(facilitiesRooms)
      .leftJoin(inventoryStorage, eq(inventoryStorage.roomId, facilitiesRooms.roomId))
      .where(
        q
          ? or(
              ilike(facilitiesRooms.roomCode, pattern(q)),
              ilike(facilitiesRooms.title, pattern(q)),
            )
          : undefined,
      )
      .orderBy(asc(facilitiesRooms.roomCode), asc(facilitiesRooms.roomId))
      .limit(limit)
      .offset(offset);
  }

  storage({ q, limit, offset }: z.infer<typeof referenceQuery>) {
    return this.db
      .select({
        roomId: inventoryStorage.roomId,
        code: facilitiesRooms.roomCode,
        name: facilitiesRooms.title,
        roomStatus: facilitiesRooms.status,
        enabled: inventoryStorage.enabled,
        sharedAccountId: inventoryStorage.sharedAccountId,
      })
      .from(inventoryStorage)
      .innerJoin(facilitiesRooms, eq(inventoryStorage.roomId, facilitiesRooms.roomId))
      .where(
        q
          ? or(
              ilike(facilitiesRooms.roomCode, pattern(q)),
              ilike(facilitiesRooms.title, pattern(q)),
            )
          : undefined,
      )
      .orderBy(asc(facilitiesRooms.roomCode), asc(inventoryStorage.roomId))
      .limit(limit)
      .offset(offset);
  }

  shared({ q, limit, offset }: z.infer<typeof referenceQuery>) {
    return this.db
      .select()
      .from(inventorySharedAccounts)
      .where(q ? ilike(inventorySharedAccounts.name, pattern(q)) : undefined)
      .orderBy(asc(inventorySharedAccounts.name))
      .limit(limit)
      .offset(offset);
  }

  employees({ q, limit, offset }: z.infer<typeof referenceQuery>) {
    const english = sql<string>`concat_ws(' ', ${hrEmployees.firstNameEn}, ${hrEmployees.lastNameEn})`;
    const arabic = sql<string>`concat_ws(' ', ${hrEmployees.firstNameAr}, ${hrEmployees.lastNameAr})`;
    return this.db
      .select({
        id: hrEmployees.employeeId,
        number: hrEmployees.employeeNumber,
        name: sql<string>`coalesce(nullif(${english}, ''), ${arabic})`,
      })
      .from(hrEmployees)
      .where(
        q
          ? or(
              ilike(hrEmployees.employeeNumber, pattern(q)),
              ilike(english, pattern(q)),
              ilike(arabic, pattern(q)),
            )
          : undefined,
      )
      .orderBy(asc(hrEmployees.employeeNumber))
      .limit(limit)
      .offset(offset);
  }

  consumables({ q, limit, offset }: z.infer<typeof referenceQuery>) {
    return this.db
      .select()
      .from(inventoryConsumables)
      .where(
        q
          ? or(
              ilike(inventoryConsumables.code, pattern(q)),
              ilike(inventoryConsumables.name, pattern(q)),
            )
          : undefined,
      )
      .orderBy(asc(inventoryConsumables.code))
      .limit(limit)
      .offset(offset);
  }

  async configureStorage(
    roomId: string,
    { enabled, sharedAccountId }: z.infer<typeof storageInput>,
  ) {
    return this.db.transaction(async (tx) => {
      if (enabled) await this.transactions.checkRoom(tx, roomId);
      else {
        const [existing] = await tx
          .select()
          .from(inventoryStorage)
          .where(eq(inventoryStorage.roomId, roomId));
        if (!existing) throw new NotFoundException('Storage location was not found');
      }
      await this.transactions.validateParty(tx, { kind: 'shared', id: sharedAccountId });
      const fields = { enabled: enabled ? 1 : 0, sharedAccountId };
      const [row] = await tx
        .insert(inventoryStorage)
        .values({ roomId, ...fields })
        .onConflictDoUpdate({ target: inventoryStorage.roomId, set: fields })
        .returning();
      return row;
    });
  }

  async createShared(name: string) {
    const [row] = await this.db
      .insert(inventorySharedAccounts)
      .values({ name })
      .onConflictDoNothing()
      .returning();
    if (!row) throw new ConflictException('Shared account name already exists');
    return row;
  }

  async createConsumable(input: typeof inventoryConsumables.$inferInsert) {
    const [row] = await this.db
      .insert(inventoryConsumables)
      .values(input)
      .onConflictDoNothing()
      .returning();
    if (!row) throw new ConflictException('Consumable code already exists');
    return row;
  }

  private historyFields() {
    const {
      id,
      type,
      name,
      reference,
      eventDate,
      recordedAt,
      actorId,
      source,
      sourceRoomId,
      destinationRoomId,
      recipientEmployeeId,
      notes,
      decisionId,
    } = inventoryTransactions;
    return {
      id,
      type,
      name,
      reference,
      eventDate,
      recordedAt,
      actorId,
      source,
      sourceRoomId,
      destinationRoomId,
      recipientEmployeeId,
      notes,
      decisionId,
    };
  }
}
