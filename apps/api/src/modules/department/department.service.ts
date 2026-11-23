import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { CurriculumModule } from '@project/contracts/department';
import type { Database } from '@project/db';
import {
  auditLog,
  curriculumFamilies as families,
  curriculumModules as modules,
  curriculumPlans as plans,
  departments,
  studentCurriculumAssignments as assignments,
  students,
} from '@project/db/schema';
import { randomUUID } from 'node:crypto';
import { and, asc, count, desc, eq, ilike, inArray, or } from 'drizzle-orm';
import { DATABASE } from '../../database/database.constants.js';

type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];
const versionFields = {
  id: plans.id,
  familyId: plans.familyId,
  departmentId: families.departmentId,
  name: plans.name,
  version: plans.version,
  revision: plans.revision,
  publishedAt: plans.publishedAt,
};

@Injectable()
export class DepartmentService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  list() {
    return this.db.select().from(departments).orderBy(asc(departments.name), asc(departments.code));
  }

  async create(input: { code: string; name: string }) {
    const [entry] = await this.db
      .insert(departments)
      .values(input)
      .onConflictDoNothing()
      .returning();
    if (!entry) throw new ConflictException('A department already uses this code.');
    return entry;
  }

  async update(id: string, input: { name: string; active: boolean }) {
    const [entry] = await this.db
      .update(departments)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(departments.id, id))
      .returning();
    if (!entry) throw new NotFoundException('Department not found.');
    return entry;
  }

  versions(departmentId: string) {
    return this.db
      .select(versionFields)
      .from(plans)
      .innerJoin(families, eq(plans.familyId, families.id))
      .where(eq(families.departmentId, departmentId))
      .orderBy(asc(families.name), desc(plans.version));
  }

  detail(id: string) {
    return this.db.transaction(
      async (tx) => {
        const [plan] = await tx
          .select(versionFields)
          .from(plans)
          .innerJoin(families, eq(plans.familyId, families.id))
          .where(eq(plans.id, id));
        if (!plan) throw new NotFoundException('Curriculum version not found.');
        const rows = await tx
          .select()
          .from(modules)
          .where(eq(modules.planId, id))
          .orderBy(
            asc(modules.studyYear),
            asc(modules.semester),
            asc(modules.code),
            asc(modules.id),
          );
        return { ...plan, modules: rows };
      },
      { isolationLevel: 'repeatable read', accessMode: 'read only' },
    );
  }

  createPlan(input: { departmentId: string; name: string; modules: CurriculumModule[] }) {
    return this.db.transaction(async (tx) => {
      await this.requireActive(tx, input.departmentId);
      const [family] = await tx
        .insert(families)
        .values({
          departmentId: input.departmentId,
          name: input.name,
        })
        .onConflictDoNothing()
        .returning();
      if (!family)
        throw new ConflictException('This department already has a plan with that name.');
      const [plan] = await tx
        .insert(plans)
        .values({ familyId: family.id, name: input.name, version: 1 })
        .returning();
      await this.saveModules(tx, plan.id, input.modules);
      return plan;
    });
  }

  newDraft(familyId: string) {
    return this.db.transaction(async (tx) => {
      const [family] = await tx.select().from(families).where(eq(families.id, familyId));
      if (!family) throw new NotFoundException('Curriculum plan not found.');
      await this.requireActive(tx, family.departmentId);
      const [latest] = await tx
        .select()
        .from(plans)
        .where(eq(plans.familyId, familyId))
        .orderBy(desc(plans.version))
        .limit(1)
        .for('update');
      if (!latest.publishedAt) return latest;
      const [draft] = await tx
        .insert(plans)
        .values({
          familyId,
          name: latest.name,
          version: latest.version + 1,
        })
        .returning();
      const rows = await tx.select().from(modules).where(eq(modules.planId, latest.id));
      await this.saveModules(tx, draft.id, rows);
      return draft;
    });
  }

  edit(id: string, input: { name: string; expectedRevision: number; modules: CurriculumModule[] }) {
    return this.db.transaction(async (tx) => {
      const plan = await this.lockDraft(tx, id, input.expectedRevision);
      const [updated] = await tx
        .update(plans)
        .set({ name: input.name, revision: plan.revision + 1 })
        .where(eq(plans.id, id))
        .returning();
      await tx.delete(modules).where(eq(modules.planId, id));
      await this.saveModules(tx, id, input.modules);
      return updated;
    });
  }

  publish(id: string, input: { expectedRevision: number; allowEmptySemesters: boolean }) {
    return this.db.transaction(async (tx) => {
      const plan = await this.lockDraft(tx, id, input.expectedRevision);
      const rows = await tx
        .select({ year: modules.studyYear, semester: modules.semester })
        .from(modules)
        .where(eq(modules.planId, id));
      if (!rows.length) throw new BadRequestException('Add at least one module before publishing.');
      if (
        !input.allowEmptySemesters &&
        new Set(rows.map((row) => `${row.year}/${row.semester}`)).size !== 10
      )
        throw new BadRequestException('Confirm the empty semesters before publishing.');
      const [collision] = await tx
        .select({ id: families.id })
        .from(families)
        .where(and(eq(families.departmentId, plan.departmentId), eq(families.name, plan.name)));
      if (collision && collision.id !== plan.familyId)
        throw new ConflictException('This department already has a plan with that name.');
      await tx.update(families).set({ name: plan.name }).where(eq(families.id, plan.familyId));
      const [updated] = await tx
        .update(plans)
        .set({ publishedAt: new Date() })
        .where(eq(plans.id, id))
        .returning();
      return updated;
    });
  }

  async candidates(departmentId: string, page: number, search?: string) {
    const pattern = search && `%${search.replace(/[\\%_]/g, '\\$&')}%`;
    const filter = and(
      eq(students.departmentId, departmentId),
      pattern
        ? or(
            ilike(students.academicId, pattern),
            ilike(students.firstName, pattern),
            ilike(students.fatherName, pattern),
            ilike(students.lastName, pattern),
          )
        : undefined,
    );
    const [records, [summary]] = await Promise.all([
      this.db
        .select({
          studentId: students.studentId,
          academicId: students.academicId,
          firstName: students.firstName,
          fatherName: students.fatherName,
          lastName: students.lastName,
          currentStudyYear: students.currentStudyYear,
          assignment: { id: plans.id, name: plans.name, version: plans.version },
        })
        .from(students)
        .leftJoin(assignments, eq(students.studentId, assignments.studentId))
        .leftJoin(plans, eq(assignments.planId, plans.id))
        .where(filter)
        .orderBy(asc(students.academicId), asc(students.studentId))
        .limit(50)
        .offset((page - 1) * 50),
      this.db.select({ total: count() }).from(students).where(filter),
    ]);
    return { records, total: summary.total };
  }

  assign(actorId: string, input: { planId: string; studentIds: string[] }) {
    return this.db.transaction(async (tx) => {
      const [plan] = await tx
        .select(versionFields)
        .from(plans)
        .innerJoin(families, eq(plans.familyId, families.id))
        .where(eq(plans.id, input.planId));
      if (!plan) throw new NotFoundException('Curriculum version not found.');
      await this.requireActive(tx, plan.departmentId);
      if (!plan.publishedAt)
        throw new ConflictException('Publish this curriculum before assigning it.');
      const selected = await tx
        .select({
          id: students.studentId,
          academicId: students.academicId,
          departmentId: students.departmentId,
        })
        .from(students)
        .where(inArray(students.studentId, input.studentIds))
        .orderBy(asc(students.studentId))
        .for('update');
      const assigned = await tx
        .select({ id: assignments.studentId })
        .from(assignments)
        .where(inArray(assignments.studentId, input.studentIds));
      const hasPlan = new Set(assigned.map((entry) => entry.id));
      const invalid = selected.filter(
        (student) => student.departmentId !== plan.departmentId || hasPlan.has(student.id),
      );
      if (selected.length !== input.studentIds.length || invalid.length) {
        const affected = invalid.map((student) => student.academicId);
        throw new ConflictException(
          `Some students are missing, have moved departments, or already have a plan.${affected.length ? ` Check student IDs: ${affected.join(', ')}.` : ''}`,
        );
      }
      await tx.insert(assignments).values(
        input.studentIds.map((studentId) => ({
          studentId,
          planId: plan.id,
          assignedBy: actorId,
        })),
      );
      await tx.insert(auditLog).values({
        id: randomUUID(),
        actorId,
        action: 'department:assign-curriculum',
        targetId: JSON.stringify({ planId: plan.id, studentIds: input.studentIds }),
      });
      return { assigned: input.studentIds.length };
    });
  }

  private async requireActive(tx: Tx, id: string) {
    const [department] = await tx
      .select()
      .from(departments)
      .where(eq(departments.id, id))
      .for('update');
    if (!department) throw new NotFoundException('Department not found.');
    if (!department.active) throw new ConflictException('This department is inactive.');
  }

  private async lockDraft(tx: Tx, id: string, revision: number) {
    const [entry] = await tx
      .select(versionFields)
      .from(plans)
      .innerJoin(families, eq(plans.familyId, families.id))
      .where(eq(plans.id, id));
    if (!entry) throw new NotFoundException('Curriculum version not found.');
    await this.requireActive(tx, entry.departmentId);
    const [plan] = await tx.select().from(plans).where(eq(plans.id, id)).for('update');
    if (plan.publishedAt || plan.revision !== revision)
      throw new ConflictException('This draft changed. Reload it before continuing.');
    return { ...plan, departmentId: entry.departmentId };
  }

  private async saveModules(tx: Tx, planId: string, rows: CurriculumModule[]) {
    if (rows.length)
      await tx.insert(modules).values(
        rows.map(
          ({ studyYear, semester, code, name, theoryHours, labHours, credits, requirement }) => ({
            planId,
            studyYear,
            semester,
            code,
            name,
            theoryHours,
            labHours,
            credits,
            requirement,
          }),
        ),
      );
  }
}
