import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PERMISSION } from '@project/authorization';
import type {
  PromotionGrantRecipient,
  StaffYearAssignments,
  StudentAffairsCapabilities,
  StudentList,
  StudentYearChange,
} from '@project/contracts/student-affairs';
import type { Database } from '@project/db';
import {
  auditLog,
  rolePermissions,
  studentAcademicYears as annualYears,
  studentAffairsPromotionGrants as grants,
  studentAffairsStaffYears as staffYears,
  students,
  user,
  userRoles,
} from '@project/db/schema';
import {
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  getTableColumns,
  gt,
  ilike,
  isNull,
  ne,
  or,
  sql,
} from 'drizzle-orm';
import { AuthorizationService } from '../../auth/authorization.service.js';
import { DATABASE } from '../../database/database.constants.js';
import type {
  AnnualCreate,
  AnnualPatch,
  PromotionGrantCreate,
  StudentCreate,
  StudentPatch,
  StudentQuery,
} from './student-affairs.schemas.js';

type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];
const permissions = PERMISSION.studentAffairs;

function requireRevision(revision: number, expected: number) {
  if (revision !== expected)
    throw new ConflictException({
      statusCode: 409,
      code: 'STUDENT_REVISION_CONFLICT',
      message: 'This student record changed while you were editing.',
    });
}

const { userId: _accountLink, ...profileColumns } = getTableColumns(students);
const listColumns = {
  studentId: students.studentId,
  academicId: students.academicId,
  firstName: students.firstName,
  fatherName: students.fatherName,
  lastName: students.lastName,
  currentStudyYear: students.currentStudyYear,
};
const annualColumns = {
  studentId: annualYears.studentId,
  academicYear: annualYears.academicYear,
  year: annualYears.year,
  remarks: annualYears.remarks,
  createdAt: annualYears.createdAt,
  updatedAt: annualYears.updatedAt,
};

function liveGrant(userId: string) {
  return and(
    eq(grants.userId, userId),
    isNull(grants.revokedAt),
    gt(grants.expiresAt, sql`clock_timestamp()`),
  );
}

function periodKey(studentId: string, academicYear: string) {
  return and(eq(annualYears.studentId, studentId), eq(annualYears.academicYear, academicYear));
}

function literalSearch(text: string) {
  return text.replace(/[\\%_]/g, '\\$&');
}

@Injectable()
export class StudentAffairsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(AuthorizationService) private readonly auth: AuthorizationService,
  ) {}

  async capabilities(actor: string): Promise<StudentAffairsCapabilities> {
    const [read, administer, grantPromotions] = await Promise.all([
      this.auth.can(actor, permissions.read),
      this.auth.can(actor, permissions.administer),
      this.auth.can(actor, permissions.grantPromotions),
    ]);
    const assignments = read
      ? await this.db
          .select({ year: staffYears.studyYear })
          .from(staffYears)
          .where(eq(staffYears.userId, actor))
          .orderBy(asc(staffYears.studyYear))
      : [];
    return {
      read,
      administer,
      grantPromotions,
      assignedStudyYears: assignments.map(({ year }) => year),
    };
  }

  promotionRecipients(actor: string): Promise<PromotionGrantRecipient[]> {
    return this.db
      .selectDistinct({ userId: user.id, name: user.name })
      .from(user)
      .innerJoin(userRoles, eq(userRoles.userId, user.id))
      .innerJoin(
        rolePermissions,
        and(
          eq(rolePermissions.roleId, userRoles.roleId),
          eq(rolePermissions.permission, permissions.administer),
        ),
      )
      .where(
        and(
          ne(user.id, actor),
          eq(user.approved, true),
          eq(user.enabled, true),
          eq(user.mustChangePassword, false),
        ),
      )
      .orderBy(asc(user.name), asc(user.id));
  }

  async list({ search, studyYear, page, pageSize }: StudentQuery): Promise<StudentList> {
    const matchesName = search?.split(/\s+/).map((token) => {
      const pattern = `%${literalSearch(token)}%`;
      return or(
        ilike(students.firstName, pattern),
        ilike(students.fatherName, pattern),
        ilike(students.lastName, pattern),
      );
    });
    const where = and(
      studyYear === 'unassigned'
        ? isNull(students.currentStudyYear)
        : studyYear === undefined
          ? undefined
          : eq(students.currentStudyYear, studyYear),
      search
        ? or(ilike(students.academicId, `%${literalSearch(search)}%`), and(...(matchesName ?? [])))
        : undefined,
    );
    const [records, [totals]] = await Promise.all([
      this.db
        .select(listColumns)
        .from(students)
        .where(where)
        .orderBy(asc(students.academicId), asc(students.studentId))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      this.db.select({ total: count() }).from(students).where(where),
    ]);
    return { records, page, pageSize, total: totals.total };
  }

  async get(id: string) {
    const [student] = await this.db
      .select(profileColumns)
      .from(students)
      .where(eq(students.studentId, id));
    if (!student) throw new NotFoundException('Student not found');
    return student;
  }

  create(actor: string, values: StudentCreate) {
    return this.db.transaction(async (tx) => {
      await this.requireYear(tx, actor, values.currentStudyYear);
      const [student] = await tx
        .insert(students)
        .values(values)
        .onConflictDoNothing({ target: students.academicId })
        .returning(profileColumns);
      if (!student) throw new ConflictException('Academic ID is already in use');
      await this.audit(tx, actor, 'student-affairs:student-create', student.studentId);
      return student;
    });
  }

  async patch(actor: string, id: string, { expectedRevision, ...values }: StudentPatch) {
    try {
      return await this.db.transaction(async (tx) => {
        const student = await this.lockStudent(tx, id);
        await this.requireYear(tx, actor, student.currentStudyYear);
        requireRevision(student.revision, expectedRevision);
        const [updated] = await tx
          .update(students)
          .set({ ...values, revision: student.revision + 1 })
          .where(eq(students.studentId, id))
          .returning(profileColumns);
        await this.audit(tx, actor, 'student-affairs:student-update', id);
        return updated;
      });
    } catch (error) {
      const source = (error as { cause?: unknown })?.cause ?? error;
      const pg = source as { code?: string; constraint?: string };
      if (pg?.code === '23505' && pg.constraint === 'students_academic_id_unique')
        throw new ConflictException('Academic ID is already in use');
      throw error;
    }
  }

  changeYear(actor: string, id: string, { currentStudyYear, expectedRevision }: StudentYearChange) {
    return this.db.transaction(async (tx) => {
      const student = await this.lockStudent(tx, id);
      await this.requirePermission(tx, actor, permissions.administer);
      const previousYear = student.currentStudyYear;
      requireRevision(student.revision, expectedRevision);
      if (previousYear === currentStudyYear) return student;

      let grantId: string | null = null;
      if (previousYear !== null) {
        const [grant] = await tx
          .select({ id: grants.id })
          .from(grants)
          .where(liveGrant(actor))
          .orderBy(desc(grants.issuedAt))
          .limit(1)
          .for('share');
        if (!grant) throw new ForbiddenException('An active dean promotion grant is required');
        grantId = grant.id;
      }
      const [updated] = await tx
        .update(students)
        .set({ currentStudyYear, revision: student.revision + 1 })
        .where(
          and(
            eq(students.studentId, id),
            grantId
              ? exists(
                  tx
                    .select({ id: grants.id })
                    .from(grants)
                    .where(and(eq(grants.id, grantId), liveGrant(actor))),
                )
              : undefined,
          ),
        )
        .returning(profileColumns);
      if (!updated) throw new ForbiddenException('An active dean promotion grant is required');
      await this.audit(
        tx,
        actor,
        'student-affairs:current-year-change',
        JSON.stringify({ studentId: id, previousYear, currentStudyYear, grantId }),
      );
      return updated;
    });
  }

  async listAnnual(id: string) {
    const [student] = await this.db
      .select({ id: students.studentId })
      .from(students)
      .where(eq(students.studentId, id));
    if (!student) throw new NotFoundException('Student not found');
    return this.db
      .select(annualColumns)
      .from(annualYears)
      .where(eq(annualYears.studentId, id))
      .orderBy(desc(annualYears.academicYear));
  }

  createAnnual(actor: string, id: string, values: AnnualCreate) {
    return this.db.transaction(async (tx) => {
      const student = await this.lockStudent(tx, id);
      if (!(await this.auth.can(actor, permissions.administer, undefined, tx))) {
        if (student.currentStudyYear !== values.year)
          throw new ForbiddenException('Annual record must match the current study year');
        await this.requireYear(tx, actor, values.year);
      }
      const [record] = await tx
        .insert(annualYears)
        .values({ studentId: id, ...values })
        .onConflictDoNothing({ target: [annualYears.studentId, annualYears.academicYear] })
        .returning(annualColumns);
      if (!record) throw new ConflictException('An annual record already exists for this period');
      await this.audit(
        tx,
        actor,
        'student-affairs:annual-create',
        JSON.stringify({ studentId: id, academicYear: values.academicYear }),
      );
      return record;
    });
  }

  patchAnnual(actor: string, id: string, period: string, values: AnnualPatch) {
    return this.db.transaction(async (tx) => {
      await this.lockStudent(tx, id);
      const key = periodKey(id, period);
      const [existing] = await tx
        .select({ year: annualYears.year })
        .from(annualYears)
        .where(key)
        .for('update');
      if (!existing) throw new NotFoundException('Annual record not found');
      if (values.year !== undefined)
        await this.requirePermission(tx, actor, permissions.administer);
      else await this.requireYear(tx, actor, existing.year);
      const [record] = await tx.update(annualYears).set(values).where(key).returning(annualColumns);
      await this.audit(
        tx,
        actor,
        'student-affairs:annual-update',
        JSON.stringify({ studentId: id, academicYear: period }),
      );
      return record;
    });
  }

  async listStaff(): Promise<StaffYearAssignments[]> {
    const [members, assignments] = await Promise.all([
      this.db
        .selectDistinct({ userId: user.id, name: user.name })
        .from(user)
        .innerJoin(userRoles, eq(userRoles.userId, user.id))
        .innerJoin(
          rolePermissions,
          and(
            eq(rolePermissions.roleId, userRoles.roleId),
            eq(rolePermissions.permission, permissions.read),
          ),
        ),
      this.db
        .select({ userId: staffYears.userId, name: user.name, studyYear: staffYears.studyYear })
        .from(staffYears)
        .innerJoin(user, eq(user.id, staffYears.userId))
        .orderBy(asc(staffYears.studyYear)),
    ]);
    const roster = new Map(
      members.map((member) => [member.userId, { ...member, years: [] as number[] }]),
    );
    for (const { userId, name, studyYear } of assignments) {
      const member = roster.get(userId) ?? { userId, name, years: [] };
      member.years.push(studyYear);
      roster.set(userId, member);
    }
    return [...roster.values()].sort(
      (a, b) => a.name.localeCompare(b.name) || a.userId.localeCompare(b.userId),
    );
  }

  assignYear(actor: string, userId: string, studyYear: number) {
    return this.db.transaction(async (tx) => {
      await this.requirePermission(tx, actor, permissions.administer);
      await this.lockUser(tx, userId);
      if (!(await this.auth.can(userId, permissions.read, undefined, tx)))
        throw new BadRequestException(
          'Year assignments require an active Student Affairs staff account',
        );
      const [assignment] = await tx
        .insert(staffYears)
        .values({ userId, studyYear })
        .onConflictDoNothing()
        .returning();
      if (assignment)
        await this.audit(
          tx,
          actor,
          'student-affairs:staff-year-assign',
          JSON.stringify(assignment),
        );
    });
  }

  revokeYear(actor: string, userId: string, studyYear: number) {
    return this.db.transaction(async (tx) => {
      await this.requirePermission(tx, actor, permissions.administer);
      await this.lockUser(tx, userId);
      const [assignment] = await tx
        .delete(staffYears)
        .where(and(eq(staffYears.userId, userId), eq(staffYears.studyYear, studyYear)))
        .returning();
      if (assignment)
        await this.audit(
          tx,
          actor,
          'student-affairs:staff-year-revoke',
          JSON.stringify(assignment),
        );
    });
  }

  listGrants() {
    return this.db.select().from(grants).orderBy(desc(grants.issuedAt), desc(grants.id));
  }

  async currentGrant(actor: string) {
    const [active] = await this.db.select().from(grants).where(liveGrant(actor)).limit(1);
    return { grant: active ?? null };
  }

  issueGrant(actor: string, { userId, expiresAt }: PromotionGrantCreate) {
    return this.db.transaction(async (tx) => {
      await this.requirePermission(tx, actor, permissions.grantPromotions);
      await this.lockUser(tx, userId);
      if (actor === userId || !(await this.auth.can(userId, permissions.administer, undefined, tx)))
        throw new ForbiddenException('The recipient must be the active Student Affairs admin');
      const [active] = await tx
        .select({ id: grants.id })
        .from(grants)
        .where(liveGrant(userId))
        .limit(1);
      if (active)
        throw new ConflictException('The recipient already has an active promotion grant');
      const {
        rows: [clock],
      } = await tx.execute<{ now_ms: number }>(
        sql`select (extract(epoch from clock_timestamp()) * 1000)::double precision as now_ms`,
      );
      if (expiresAt.getTime() <= clock.now_ms)
        throw new BadRequestException('Expiry must be in the future');
      const [grant] = await tx
        .insert(grants)
        .values({ userId, issuedBy: actor, issuedAt: new Date(clock.now_ms), expiresAt })
        .returning();
      await this.audit(
        tx,
        actor,
        'student-affairs:promotion-grant-issue',
        JSON.stringify({ grantId: grant.id, userId, expiresAt }),
      );
      return grant;
    });
  }

  revokeGrant(actor: string, id: string) {
    return this.db.transaction(async (tx) => {
      await this.requirePermission(tx, actor, permissions.grantPromotions);
      const [grant] = await tx
        .select({ revokedAt: grants.revokedAt })
        .from(grants)
        .where(eq(grants.id, id))
        .for('update');
      if (!grant) throw new NotFoundException('Promotion grant not found');
      if (grant.revokedAt) return;
      await tx
        .update(grants)
        .set({ revokedAt: sql`clock_timestamp()`, revokedBy: actor })
        .where(eq(grants.id, id));
      await this.audit(tx, actor, 'student-affairs:promotion-grant-revoke', id);
    });
  }

  private async lockStudent(tx: Tx, id: string) {
    const [student] = await tx
      .select(profileColumns)
      .from(students)
      .where(eq(students.studentId, id))
      .for('update');
    if (!student) throw new NotFoundException('Student not found');
    return student;
  }

  private async lockUser(tx: Tx, id: string) {
    const [account] = await tx
      .select({ id: user.id })
      .from(user)
      .where(eq(user.id, id))
      .for('update');
    if (!account) throw new NotFoundException('User not found');
  }

  private async requirePermission(
    tx: Tx,
    actor: string,
    permission: (typeof permissions)[keyof typeof permissions],
  ) {
    if (!(await this.auth.can(actor, permission, undefined, tx))) throw new ForbiddenException();
  }

  private async requireYear(tx: Tx, actor: string, year: number | null) {
    if (await this.auth.can(actor, permissions.administer, undefined, tx)) return;
    await this.requirePermission(tx, actor, permissions.read);
    if (year === null)
      throw new ForbiddenException('Student Affairs admin must assign the current study year');
    const [assignment] = await tx
      .select({ year: staffYears.studyYear })
      .from(staffYears)
      .where(and(eq(staffYears.userId, actor), eq(staffYears.studyYear, year)))
      .for('share');
    if (!assignment) throw new ForbiddenException('Study year is outside your assignments');
  }

  private audit(tx: Tx, actorId: string, action: string, targetId: string) {
    return tx.insert(auditLog).values({ id: randomUUID(), actorId, action, targetId });
  }
}
