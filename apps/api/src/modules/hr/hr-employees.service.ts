import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, count, eq, getTableColumns, ilike, or } from 'drizzle-orm';
import type { Database } from '@project/db';
import { hrEmployees, hrEmploymentRecords, hrPositions, hrAuditLog } from '@project/db/schema';
import { DATABASE } from '../../database/database.constants.js';
import type { EmployeeCreate, EmployeePatch, EmployeeQuery, EmploymentPut } from './hr.schemas.js';
import { handleDatabaseErrors } from './hr.database-errors.js';

const { userId: _userId, ...profileColumns } = getTableColumns(hrEmployees);
const employmentColumns = {
  employmentRecordId: hrEmploymentRecords.employmentRecordId,
  categoryId: hrEmploymentRecords.categoryId,
  positionId: hrEmploymentRecords.positionId,
  academicRankId: hrEmploymentRecords.academicRankId,
  gradeId: hrEmploymentRecords.gradeId,
  department: hrEmploymentRecords.department,
  employmentRegime: hrEmploymentRecords.employmentRegime,
  employmentStatus: hrEmploymentRecords.employmentStatus,
  startDate: hrEmploymentRecords.startDate,
  endDate: hrEmploymentRecords.endDate,
  notes: hrEmploymentRecords.notes,
};
const currentJoin = and(
  eq(hrEmployees.employeeId, hrEmploymentRecords.employeeId),
  eq(hrEmploymentRecords.isCurrent, 1),
);

@Injectable()
export class HrEmployeesService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async list(query: EmployeeQuery) {
    const search = query.search?.replace(/[\\%_]/g, '\\$&');
    const where = and(
      search
        ? or(
            ...[
              hrEmployees.employeeNumber,
              hrEmployees.firstNameAr,
              hrEmployees.middleNameAr,
              hrEmployees.lastNameAr,
              hrEmployees.firstNameEn,
              hrEmployees.middleNameEn,
              hrEmployees.lastNameEn,
            ].map((column) => ilike(column, `%${search}%`)),
          )
        : undefined,
      query.categoryId ? eq(hrEmploymentRecords.categoryId, query.categoryId) : undefined,
      query.positionId ? eq(hrEmploymentRecords.positionId, query.positionId) : undefined,
      query.employmentStatus
        ? eq(hrEmploymentRecords.employmentStatus, query.employmentStatus)
        : undefined,
    );
    const [records, [totals]] = await Promise.all([
      this.db
        .select({
          employeeId: hrEmployees.employeeId,
          employeeNumber: hrEmployees.employeeNumber,
          firstNameAr: hrEmployees.firstNameAr,
          middleNameAr: hrEmployees.middleNameAr,
          lastNameAr: hrEmployees.lastNameAr,
          firstNameEn: hrEmployees.firstNameEn,
          middleNameEn: hrEmployees.middleNameEn,
          lastNameEn: hrEmployees.lastNameEn,
          employment: {
            employmentRecordId: hrEmploymentRecords.employmentRecordId,
            categoryId: hrEmploymentRecords.categoryId,
            positionId: hrEmploymentRecords.positionId,
            department: hrEmploymentRecords.department,
            employmentStatus: hrEmploymentRecords.employmentStatus,
          },
        })
        .from(hrEmployees)
        .leftJoin(hrEmploymentRecords, currentJoin)
        .where(where)
        .orderBy(asc(hrEmployees.employeeNumber), asc(hrEmployees.employeeId))
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize),
      this.db
        .select({ total: count() })
        .from(hrEmployees)
        .leftJoin(hrEmploymentRecords, currentJoin)
        .where(where),
    ]);
    return { records, page: query.page, pageSize: query.pageSize, total: totals.total };
  }

  async get(employeeId: string) {
    const [record] = await this.db
      .select({ ...profileColumns, employment: employmentColumns })
      .from(hrEmployees)
      .leftJoin(hrEmploymentRecords, currentJoin)
      .where(eq(hrEmployees.employeeId, employeeId));
    if (!record) throw new NotFoundException('Employee not found');
    return record;
  }

  create(values: EmployeeCreate, actorId: string) {
    return handleDatabaseErrors(() =>
      this.db.transaction(async (tx) => {
        const [record] = await tx.insert(hrEmployees).values(values).returning(profileColumns);
        await tx.insert(hrAuditLog).values({
          actorId,
          employeeId: record.employeeId,
          action: 'create',
          entityType: 'employee',
          entityId: record.employeeId,
          newValues: record,
        });
        return record;
      }),
    );
  }

  update(employeeId: string, values: EmployeePatch, actorId: string) {
    return handleDatabaseErrors(() =>
      this.db.transaction(async (tx) => {
        const [previous] = await tx
          .select(profileColumns)
          .from(hrEmployees)
          .where(eq(hrEmployees.employeeId, employeeId))
          .for('update');
        if (!previous) throw new NotFoundException('Employee not found');
        const [record] = await tx
          .update(hrEmployees)
          .set(values)
          .where(eq(hrEmployees.employeeId, employeeId))
          .returning(profileColumns);
        await tx.insert(hrAuditLog).values({
          actorId,
          employeeId,
          action: 'update',
          entityType: 'employee',
          entityId: employeeId,
          previousValues: previous,
          newValues: record,
        });
        return record;
      }),
    );
  }

  putEmployment(employeeId: string, values: EmploymentPut, actorId: string) {
    return handleDatabaseErrors(() =>
      this.db.transaction(async (tx) => {
        const [employee] = await tx
          .select({ id: hrEmployees.employeeId })
          .from(hrEmployees)
          .where(eq(hrEmployees.employeeId, employeeId))
          .for('update');
        if (!employee) throw new NotFoundException('Employee not found');
        // A shared lock also prevents the position category changing during validation.
        const [position] = await tx
          .select()
          .from(hrPositions)
          .where(eq(hrPositions.positionId, values.positionId))
          .for('share');
        if (!position || position.categoryId !== values.categoryId)
          throw new BadRequestException('Position must exist and belong to the selected category');
        const [previous] = await tx
          .select()
          .from(hrEmploymentRecords)
          .where(
            and(
              eq(hrEmploymentRecords.employeeId, employeeId),
              eq(hrEmploymentRecords.isCurrent, 1),
            ),
          );
        const replacement = {
          ...values,
          employeeId,
          isCurrent: 1,
          academicRankId: values.academicRankId ?? null,
          gradeId: values.gradeId ?? null,
          department: values.department ?? null,
          endDate: values.endDate ?? null,
          notes: values.notes ?? null,
          employmentStatus: values.employmentStatus ?? previous?.employmentStatus ?? 'active',
        };
        const [record] = previous
          ? await tx
              .update(hrEmploymentRecords)
              .set(replacement)
              .where(eq(hrEmploymentRecords.employmentRecordId, previous.employmentRecordId))
              .returning(employmentColumns)
          : await tx.insert(hrEmploymentRecords).values(replacement).returning(employmentColumns);
        await tx.insert(hrAuditLog).values({
          actorId,
          employeeId,
          action: previous ? 'update' : 'create',
          entityType: 'employment',
          entityId: record.employmentRecordId,
          previousValues: previous ?? null,
          newValues: record,
        });
        return record;
      }),
    );
  }
}
