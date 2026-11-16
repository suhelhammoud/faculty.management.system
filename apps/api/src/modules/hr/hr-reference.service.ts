import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, eq, isNull } from 'drizzle-orm';
import type { Database } from '@project/db';
import {
  hrStaffCategories,
  hrPositions,
  hrAcademicRanks,
  hrGradeSchemes,
  hrEmploymentGrades,
  hrEmploymentRecords,
  hrAuditLog,
} from '@project/db/schema';
import { DATABASE } from '../../database/database.constants.js';
import { handleDatabaseErrors } from './hr.database-errors.js';
import { referenceSchemas, referencePatchSchemas, type ReferenceKind } from './hr.schemas.js';

const tables = {
  'staff-categories': {
    table: hrStaffCategories,
    id: hrStaffCategories.categoryId,
    order: hrStaffCategories.code,
  },
  positions: { table: hrPositions, id: hrPositions.positionId, order: hrPositions.code },
  'academic-ranks': {
    table: hrAcademicRanks,
    id: hrAcademicRanks.rankId,
    order: hrAcademicRanks.rankOrder,
  },
  'grade-schemes': {
    table: hrGradeSchemes,
    id: hrGradeSchemes.schemeId,
    order: hrGradeSchemes.code,
  },
  'employment-grades': {
    table: hrEmploymentGrades,
    id: hrEmploymentGrades.gradeId,
    order: hrEmploymentGrades.gradeNumber,
  },
};

@Injectable()
export class HrReferenceService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  list(kind: ReferenceKind, query: { categoryId?: string; schemeId?: string }) {
    if (
      (query.categoryId && kind !== 'positions') ||
      (query.schemeId && kind !== 'employment-grades')
    )
      throw new BadRequestException('Filter does not apply to this reference list');
    const { table, id, order } = tables[kind];
    const filter =
      kind === 'positions' && query.categoryId
        ? eq(hrPositions.categoryId, query.categoryId)
        : kind === 'employment-grades' && query.schemeId
          ? eq(hrEmploymentGrades.schemeId, query.schemeId)
          : undefined;
    return this.db.select().from(table).where(filter).orderBy(asc(order), asc(id));
  }

  async write(kind: ReferenceKind, id: string | undefined, input: unknown, actorId: string) {
    const parsed = (id ? referencePatchSchemas[kind] : referenceSchemas[kind]).safeParse(input);
    if (!parsed.success)
      throw new BadRequestException(
        parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
      );
    const values = parsed.data as Record<string, unknown>;
    return handleDatabaseErrors(() =>
      this.db.transaction(async (tx) => {
        const definition = tables[kind];
        const [previous] = id
          ? await tx.select().from(definition.table).where(eq(definition.id, id)).for('update')
          : [];
        if (id && !previous) throw new NotFoundException('Reference record not found');
        if (
          kind === 'positions' &&
          id &&
          values.categoryId &&
          values.categoryId !== (previous as typeof hrPositions.$inferSelect).categoryId
        ) {
          const [used] = await tx
            .select({ id: hrEmploymentRecords.employmentRecordId })
            .from(hrEmploymentRecords)
            .where(eq(hrEmploymentRecords.positionId, id))
            .limit(1);
          if (used)
            throw new BadRequestException(
              'Cannot change the category of a position used by employment records',
            );
        }
        // PostgreSQL unique constraints treat NULL steps as distinct; enforce a single grade without a step here.
        if (kind === 'employment-grades') {
          const merged = { ...previous, ...values } as typeof hrEmploymentGrades.$inferInsert;
          await tx
            .select()
            .from(hrGradeSchemes)
            .where(eq(hrGradeSchemes.schemeId, merged.schemeId))
            .for('update');
          const matches = await tx
            .select({ id: hrEmploymentGrades.gradeId })
            .from(hrEmploymentGrades)
            .where(
              and(
                eq(hrEmploymentGrades.schemeId, merged.schemeId),
                eq(hrEmploymentGrades.gradeNumber, merged.gradeNumber),
                merged.stepNumber == null
                  ? isNull(hrEmploymentGrades.stepNumber)
                  : eq(hrEmploymentGrades.stepNumber, merged.stepNumber),
              ),
            );
          if (matches.some((match) => match.id !== id)) {
            throw new ConflictException('Grade and step already exist in this scheme');
          }
        }
        let record: Record<string, unknown>;
        switch (kind) {
          case 'staff-categories': {
            const [saved] = id
              ? await tx
                  .update(hrStaffCategories)
                  .set(values)
                  .where(eq(hrStaffCategories.categoryId, id))
                  .returning()
              : await tx
                  .insert(hrStaffCategories)
                  .values(values as typeof hrStaffCategories.$inferInsert)
                  .returning();
            record = saved;
            break;
          }
          case 'positions': {
            const [saved] = id
              ? await tx
                  .update(hrPositions)
                  .set(values)
                  .where(eq(hrPositions.positionId, id))
                  .returning()
              : await tx
                  .insert(hrPositions)
                  .values(values as typeof hrPositions.$inferInsert)
                  .returning();
            record = saved;
            break;
          }
          case 'academic-ranks': {
            const [saved] = id
              ? await tx
                  .update(hrAcademicRanks)
                  .set(values)
                  .where(eq(hrAcademicRanks.rankId, id))
                  .returning()
              : await tx
                  .insert(hrAcademicRanks)
                  .values(values as typeof hrAcademicRanks.$inferInsert)
                  .returning();
            record = saved;
            break;
          }
          case 'grade-schemes': {
            const [saved] = id
              ? await tx
                  .update(hrGradeSchemes)
                  .set(values)
                  .where(eq(hrGradeSchemes.schemeId, id))
                  .returning()
              : await tx
                  .insert(hrGradeSchemes)
                  .values(values as typeof hrGradeSchemes.$inferInsert)
                  .returning();
            record = saved;
            break;
          }
          case 'employment-grades': {
            const [saved] = id
              ? await tx
                  .update(hrEmploymentGrades)
                  .set(values)
                  .where(eq(hrEmploymentGrades.gradeId, id))
                  .returning()
              : await tx
                  .insert(hrEmploymentGrades)
                  .values(values as typeof hrEmploymentGrades.$inferInsert)
                  .returning();
            record = saved;
            break;
          }
        }
        const idKeys = {
          'staff-categories': 'categoryId',
          positions: 'positionId',
          'academic-ranks': 'rankId',
          'grade-schemes': 'schemeId',
          'employment-grades': 'gradeId',
        };
        const entityId = String(record[idKeys[kind]]);
        await tx.insert(hrAuditLog).values({
          actorId,
          action: id ? 'update' : 'create',
          entityType: kind,
          entityId,
          previousValues: previous ?? null,
          newValues: record,
        });
        return record;
      }),
    );
  }
}
