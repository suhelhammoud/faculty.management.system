import { facultyPositionAppointments, facultyPositions } from '@project/db/schema';
import { and, eq, isNull } from 'drizzle-orm';
import type {
  WorkflowAccess,
  WorkflowPositionTarget,
  WorkflowReader,
  WorkflowRegistration,
  WorkflowTransaction,
} from './workflow-definition.js';

const currentAppointments = {
  id: facultyPositionAppointments.id,
  code: facultyPositions.code,
  departmentCode: facultyPositions.departmentCode,
};

export async function loadWorkflowAppointments(db: WorkflowReader, actorId: string) {
  const rows = await db
    .select(currentAppointments)
    .from(facultyPositionAppointments)
    .innerJoin(facultyPositions, eq(facultyPositions.id, facultyPositionAppointments.positionId))
    .where(
      and(
        eq(facultyPositionAppointments.userId, actorId),
        isNull(facultyPositionAppointments.endedAt),
      ),
    );
  return new Map(rows.map((row) => [row.code, row]));
}

export type WorkflowAppointments = Awaited<ReturnType<typeof loadWorkflowAppointments>>;

export async function qualifyingAppointment(
  context: WorkflowAccess,
  registration: WorkflowRegistration,
  target: WorkflowPositionTarget,
  batch?: { appointments: WorkflowAppointments; departments?: ReadonlyMap<string, string> },
  transaction?: WorkflowTransaction,
) {
  let code: string;
  let departmentCode: string | null = null;
  if (typeof target === 'string') {
    code = target;
  } else {
    const departments = batch
      ? batch.departments
      : await registration.resolveDepartments?.(context.db, [context.subject.id]);
    const department = departments?.get(context.subject.id);
    if (!department || !Object.hasOwn(target.byDepartment, department)) return undefined;
    departmentCode = department;
    code = target.byDepartment[department];
  }

  if (transaction) {
    // The handover takes an exclusive lock on this same row. Read the current
    // appointment in a separate statement after the lock is acquired.
    const [position] = await transaction
      .select({ id: facultyPositions.id, departmentCode: facultyPositions.departmentCode })
      .from(facultyPositions)
      .where(eq(facultyPositions.code, code))
      .for('share');
    if (!position || position.departmentCode !== departmentCode) return undefined;
    const [appointment] = await transaction
      .select({ id: facultyPositionAppointments.id })
      .from(facultyPositionAppointments)
      .where(
        and(
          eq(facultyPositionAppointments.positionId, position.id),
          eq(facultyPositionAppointments.userId, context.actorId),
          isNull(facultyPositionAppointments.endedAt),
        ),
      );
    return appointment?.id;
  }

  const appointments =
    batch?.appointments ?? (await loadWorkflowAppointments(context.db, context.actorId));
  const appointment = appointments.get(code);
  return appointment?.departmentCode === departmentCode ? appointment.id : undefined;
}
