import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Database } from '@project/db';
import { and, desc, eq, isNotNull, isNull } from 'drizzle-orm';
import {
  facilitiesRooms,
  hrEmployees,
  inventoryAssets,
  inventoryCustodies,
  inventoryDiscrepancies,
  user,
} from '@project/db/schema';
import { alias } from 'drizzle-orm/pg-core';
import type { z } from 'zod';
import { DATABASE } from '../../database/database.constants.js';
import type { discrepancyInput, discrepancyQuery } from './inventory.schemas.js';

@Injectable()
export class InventoryDiscrepanciesService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  submit(actorId: string, { assetId, category, details }: z.infer<typeof discrepancyInput>) {
    return this.db.transaction(async (tx) => {
      // Custody changes lock the asset before updating its assignment.
      const [asset] = await tx
        .select({
          revision: inventoryAssets.revision,
          roomId: inventoryAssets.roomId,
          condition: inventoryAssets.condition,
        })
        .from(inventoryAssets)
        .where(and(eq(inventoryAssets.id, assetId), eq(inventoryAssets.status, 'active')))
        .for('update');
      if (!asset) throw new NotFoundException('Asset assignment not found');
      const [custody] = await tx
        .select({ id: inventoryCustodies.id })
        .from(inventoryCustodies)
        .innerJoin(hrEmployees, eq(inventoryCustodies.employeeId, hrEmployees.employeeId))
        .where(
          and(
            eq(inventoryCustodies.assetId, assetId),
            isNull(inventoryCustodies.endedAt),
            eq(hrEmployees.userId, actorId),
          ),
        );
      if (!custody) throw new NotFoundException('Asset assignment not found');

      const reports = inventoryDiscrepancies;
      const [existing] = await tx
        .select({ id: reports.id, details: reports.details })
        .from(reports)
        .where(
          and(
            eq(reports.custodyId, custody.id),
            eq(reports.category, category),
            eq(reports.reporterId, actorId),
            isNull(reports.reviewedAt),
          ),
        )
        .for('update');
      if (existing) {
        if (existing.details === details) return { id: existing.id };
        throw new ConflictException('An open report already exists for this issue.');
      }
      const [report] = await tx
        .insert(reports)
        .values({
          reporterId: actorId,
          custodyId: custody.id,
          category,
          details,
          assetRevision: asset.revision,
          roomId: asset.roomId,
          condition: asset.condition,
        })
        .returning({ id: reports.id });
      return report;
    });
  }

  list({ status, limit, offset }: z.infer<typeof discrepancyQuery>) {
    const reports = inventoryDiscrepancies;
    const reviewer = alias(user, 'reviewer');
    return this.db
      .select({
        id: reports.id,
        assetId: inventoryAssets.id,
        assetTag: inventoryAssets.tag,
        assetName: inventoryAssets.name,
        reportedBy: user.name,
        reportedAt: reports.reportedAt,
        category: reports.category,
        details: reports.details,
        room: facilitiesRooms.title,
        condition: reports.condition,
        assetRevision: reports.assetRevision,
        reviewedBy: reviewer.name,
        reviewedAt: reports.reviewedAt,
        reviewNote: reports.reviewNote,
      })
      .from(reports)
      .innerJoin(inventoryCustodies, eq(reports.custodyId, inventoryCustodies.id))
      .innerJoin(inventoryAssets, eq(inventoryCustodies.assetId, inventoryAssets.id))
      .innerJoin(user, eq(reports.reporterId, user.id))
      .leftJoin(facilitiesRooms, eq(reports.roomId, facilitiesRooms.roomId))
      .leftJoin(reviewer, eq(reports.reviewerId, reviewer.id))
      .where(status === 'open' ? isNull(reports.reviewedAt) : isNotNull(reports.reviewedAt))
      .orderBy(desc(reports.reportedAt), desc(reports.id))
      .limit(limit)
      .offset(offset);
  }

  async review(id: string, reviewerId: string, note: string) {
    const reports = inventoryDiscrepancies;
    const [updated] = await this.db
      .update(reports)
      .set({ reviewerId, reviewedAt: new Date(), reviewNote: note })
      .where(and(eq(reports.id, id), isNull(reports.reviewedAt)))
      .returning();
    if (updated) return updated;
    const [existing] = await this.db.select().from(reports).where(eq(reports.id, id));
    if (!existing) throw new NotFoundException();
    if (existing.reviewerId === reviewerId && existing.reviewNote === note) return existing;
    throw new ConflictException('This report has already been reviewed.');
  }
}
