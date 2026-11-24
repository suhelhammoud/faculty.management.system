import { isDeepStrictEqual } from 'node:util';
import { and, asc, eq, getTableColumns } from 'drizzle-orm';
import type { Database } from '../../../client.js';
import {
  curriculumFamilies,
  curriculumModules,
  curriculumPlans,
  departments,
} from '../../../schema/department/index.js';
import { curriculumFixtures } from '../../fixtures/curricula/index.js';

const { id: _moduleId, planId: _planId, ...moduleFields } = getTableColumns(curriculumModules);

export function seedCurricula(db: Database) {
  return db.transaction(async (tx) => {
    const publishedAt = new Date();
    const counts = { departments: 0, versions: 0, modules: 0 };

    for (const fixture of curriculumFixtures) {
      await tx
        .insert(departments)
        .values({ code: fixture.code, name: fixture.name })
        .onConflictDoNothing({ target: departments.code });
      const [department] = await tx
        .select({ id: departments.id })
        .from(departments)
        .where(eq(departments.code, fixture.code))
        .for('update');

      await tx
        .insert(curriculumFamilies)
        .values({
          id: fixture.familyId,
          departmentId: department.id,
          name: fixture.familyName,
        })
        .onConflictDoNothing();
      const [family] = await tx
        .select()
        .from(curriculumFamilies)
        .where(eq(curriculumFamilies.id, fixture.familyId));
      if (!family || family.departmentId !== department.id) {
        throw new Error(`Curriculum family conflicts with existing data for ${fixture.code}.`);
      }
      counts.departments++;

      for (const version of fixture.versions) {
        const label = `${fixture.code} v${version.version}`;
        const [inserted] = await tx
          .insert(curriculumPlans)
          .values({
            id: version.id,
            familyId: family.id,
            version: version.version,
            name: version.name,
            description: version.description,
            remarks: version.remarks,
            publishedAt,
          })
          .onConflictDoNothing()
          .returning({ id: curriculumPlans.id });

        if (inserted) {
          await tx
            .insert(curriculumModules)
            .values(version.modules.map((row) => ({ ...row, planId: version.id })));
        } else {
          const [existing] = await tx
            .select()
            .from(curriculumPlans)
            .where(
              and(
                eq(curriculumPlans.familyId, family.id),
                eq(curriculumPlans.version, version.version),
              ),
            );
          if (
            existing?.id !== version.id ||
            existing.name !== version.name ||
            !existing.publishedAt
          ) {
            throw new Error(`Curriculum version conflicts with existing data for ${label}.`);
          }
          const rows = await tx
            .select(moduleFields)
            .from(curriculumModules)
            .where(eq(curriculumModules.planId, version.id))
            .orderBy(asc(curriculumModules.code));
          if (!isDeepStrictEqual(rows, version.modules)) {
            throw new Error(`Curriculum modules conflict with existing data for ${label}.`);
          }
          if (existing.description === null || existing.remarks === null) {
            await tx
              .update(curriculumPlans)
              .set({
                description: existing.description ?? version.description,
                remarks: existing.remarks ?? version.remarks,
              })
              .where(eq(curriculumPlans.id, version.id));
          }
        }
        counts.versions++;
        counts.modules += version.modules.length;
      }
    }
    return counts;
  });
}
