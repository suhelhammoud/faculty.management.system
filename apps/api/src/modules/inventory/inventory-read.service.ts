import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Database } from '@project/db';
import {
  facilitiesRooms,
  user,
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
import { and, asc, desc, eq, exists, gte, ilike, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import type { z } from 'zod';
import { DATABASE } from '../../database/database.constants.js';
import { InventoryTransactionsService } from './inventory-transactions.service.js';
import type {
  assetQuery,
  historyQuery,
  myItemsQuery,
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

  async employeeProfile(actorId: string) {
    const [employee] = await this.db
      .select({ id: hrEmployees.employeeId })
      .from(hrEmployees)
      .where(eq(hrEmployees.userId, actorId));
    return employee;
  }

  async myItems(actorId: string, { limit, offset }: z.infer<typeof myItemsQuery>) {
    const employee = await this.employeeProfile(actorId);
    if (!employee) return { linkedEmployee: false, items: [] };
    const items = await this.db
      .select({
        id: inventoryAssets.id,
        tag: inventoryAssets.tag,
        name: inventoryAssets.name,
        condition: inventoryAssets.condition,
        room: facilitiesRooms.title,
        assignedAt: inventoryCustodies.openedAt,
      })
      .from(inventoryAssets)
      .innerJoin(inventoryCustodies, eq(inventoryCustodies.assetId, inventoryAssets.id))
      .innerJoin(hrEmployees, eq(hrEmployees.employeeId, inventoryCustodies.employeeId))
      .leftJoin(facilitiesRooms, eq(facilitiesRooms.roomId, inventoryAssets.roomId))
      .where(
        and(
          eq(hrEmployees.userId, actorId),
          isNull(inventoryCustodies.endedAt),
          eq(inventoryAssets.status, 'active'),
        ),
      )
      .orderBy(asc(inventoryAssets.tag))
      .limit(limit)
      .offset(offset);
    return { linkedEmployee: true, items };
  }

  private names() {
    return {
      nameEn: sql<string>`nullif(concat_ws(' ', ${hrEmployees.firstNameEn}, ${hrEmployees.lastNameEn}), '')`,
      nameAr: sql<string>`concat_ws(' ', ${hrEmployees.firstNameAr}, ${hrEmployees.lastNameAr})`,
    };
  }

  assets(query: z.infer<typeof assetQuery>) {
    const { q, category, employeeId, sharedAccountId, roomId, condition, status, offset, limit } =
      query;
    return this.db
      .select({
        asset: inventoryAssets,
        custody: inventoryCustodies,
        room: facilitiesRooms.title,
        isStorage: sql<boolean>`${inventoryStorage.roomId} is not null`,
        employee: { id: hrEmployees.employeeId, ...this.names() },
        sharedAccount: inventorySharedAccounts.name,
      })
      .from(inventoryAssets)
      .leftJoin(
        inventoryCustodies,
        and(eq(inventoryCustodies.assetId, inventoryAssets.id), isNull(inventoryCustodies.endedAt)),
      )
      .leftJoin(facilitiesRooms, eq(facilitiesRooms.roomId, inventoryAssets.roomId))
      .leftJoin(inventoryStorage, eq(inventoryStorage.roomId, inventoryAssets.roomId))
      .leftJoin(hrEmployees, eq(hrEmployees.employeeId, inventoryCustodies.employeeId))
      .leftJoin(
        inventorySharedAccounts,
        eq(inventorySharedAccounts.id, inventoryCustodies.sharedAccountId),
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
        room: facilitiesRooms.title,
      })
      .from(inventoryBalances)
      .innerJoin(inventoryConsumables, eq(inventoryConsumables.id, inventoryBalances.consumableId))
      .innerJoin(facilitiesRooms, eq(facilitiesRooms.roomId, inventoryBalances.roomId))
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
      .select({ ...this.historyFields(), actorName: user.name })
      .from(inventoryTransactions)
      .leftJoin(user, eq(user.id, inventoryTransactions.actorId))
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
      .select({ ...this.historyFields(), actorName: user.name })
      .from(inventoryTransactions)
      .leftJoin(user, eq(user.id, inventoryTransactions.actorId))
      .where(eq(inventoryTransactions.id, id));
    if (!header) throw new NotFoundException();
    const items = await this.db
      .select({
        line: inventoryTransactionLines,
        assetTag: inventoryAssets.tag,
        assetName: inventoryAssets.name,
        itemCode: inventoryConsumables.code,
        itemName: inventoryConsumables.name,
        unit: inventoryConsumables.unit,
      })
      .from(inventoryTransactionLines)
      .leftJoin(inventoryAssets, eq(inventoryAssets.id, inventoryTransactionLines.assetId))
      .leftJoin(
        inventoryConsumables,
        eq(inventoryConsumables.id, inventoryTransactionLines.consumableId),
      )
      .where(eq(inventoryTransactionLines.transactionId, id))
      .orderBy(asc(inventoryTransactionLines.line));
    const lines = items.map(({ line, ...labels }) => ({ ...line, ...labels }));
    const snapshots = lines
      .flatMap(({ before, after }) => [before, after])
      .filter((value) => value !== null);
    const ids = (values: (string | null)[]) => [
      ...new Set(values.filter((value): value is string => value !== null)),
    ];
    const roomIds = ids([
      header.sourceRoomId,
      header.destinationRoomId,
      ...snapshots.map((s) => s.roomId),
    ]);
    const employeeIds = ids([header.recipientEmployeeId, ...snapshots.map((s) => s.employeeId)]);
    const sharedIds = ids(snapshots.map((s) => s.sharedAccountId));
    const [rooms, employees, sharedAccounts] = await Promise.all([
      roomIds.length
        ? this.db
            .select({ id: facilitiesRooms.roomId, name: facilitiesRooms.title })
            .from(facilitiesRooms)
            .where(inArray(facilitiesRooms.roomId, roomIds))
        : [],
      employeeIds.length
        ? this.db
            .select({ id: hrEmployees.employeeId, ...this.names() })
            .from(hrEmployees)
            .where(inArray(hrEmployees.employeeId, employeeIds))
        : [],
      sharedIds.length
        ? this.db
            .select()
            .from(inventorySharedAccounts)
            .where(inArray(inventorySharedAccounts.id, sharedIds))
        : [],
    ]);
    return { ...header, items: lines, labels: { rooms, employees, sharedAccounts } };
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
        sharedAccount: inventorySharedAccounts.name,
      })
      .from(inventoryStorage)
      .innerJoin(facilitiesRooms, eq(inventoryStorage.roomId, facilitiesRooms.roomId))
      .innerJoin(
        inventorySharedAccounts,
        eq(inventoryStorage.sharedAccountId, inventorySharedAccounts.id),
      )
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
        ...this.names(),
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
