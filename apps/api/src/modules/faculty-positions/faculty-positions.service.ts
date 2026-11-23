import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Database } from '@project/db';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import {
  auditLog,
  departments,
  facultyPositionAppointments as appointments,
  facultyPositions as positions,
  user,
} from '@project/db/schema';
import type {
  CreateFacultyPosition,
  FacultyPosition,
  FacultyPositionAppointment,
  FacultyPositionHolder,
  FacultyPositionTitles,
  UpdateFacultyPositionHolder,
} from '@project/contracts/faculty-positions';
import { DATABASE } from '../../database/database.constants.js';

const holder = { userId: user.id, name: user.name, username: user.username };
const appointment = {
  id: appointments.id,
  appointmentDate: appointments.appointmentDate,
  startedAt: appointments.startedAt,
  endedAt: appointments.endedAt,
};
type AppointmentRow = typeof appointments.$inferSelect;

function serialize(
  entry: Pick<AppointmentRow, 'id' | 'appointmentDate' | 'startedAt' | 'endedAt'> & {
    holder: FacultyPositionHolder;
  },
): FacultyPositionAppointment {
  return {
    id: entry.id,
    ...entry.holder,
    appointmentDate: entry.appointmentDate,
    startedAt: entry.startedAt.toISOString(),
    endedAt: entry.endedAt?.toISOString() ?? null,
  };
}

function audit(actorId: string, action: string, target: Record<string, string | null>) {
  return {
    id: randomUUID(),
    actorId,
    action: `faculty-positions:${action}`,
    targetId: JSON.stringify(target),
  };
}

@Injectable()
export class FacultyPositionsService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async list(): Promise<FacultyPosition[]> {
    const rows = await this.db
      .select({ position: positions, appointment, holder })
      .from(positions)
      .leftJoin(
        appointments,
        and(eq(positions.id, appointments.positionId), isNull(appointments.endedAt)),
      )
      .leftJoin(user, eq(user.id, appointments.userId))
      .orderBy(positions.titleEn, positions.code);
    return rows.map((row) => ({
      ...row.position,
      currentAppointment:
        row.appointment && row.holder
          ? serialize({ ...row.appointment, holder: row.holder })
          : null,
    }));
  }

  departmentOptions() {
    return this.db
      .select({ code: departments.code, name: departments.name })
      .from(departments)
      .where(eq(departments.active, true))
      .orderBy(departments.name, departments.code);
  }

  eligibleHolders() {
    return this.db
      .select(holder)
      .from(user)
      .where(and(eq(user.approved, true), eq(user.enabled, true)))
      .orderBy(user.name, user.id);
  }

  async history(positionId: string): Promise<FacultyPositionAppointment[]> {
    const [position] = await this.db
      .select({ id: positions.id })
      .from(positions)
      .where(eq(positions.id, positionId));
    if (!position) throw new NotFoundException('Faculty position not found');
    const rows = await this.db
      .select({ ...appointment, holder })
      .from(appointments)
      .innerJoin(user, eq(user.id, appointments.userId))
      .where(eq(appointments.positionId, positionId))
      .orderBy(desc(appointments.startedAt), desc(appointments.id));
    return rows.map(serialize);
  }

  create(body: CreateFacultyPosition, actorId: string) {
    return this.db.transaction(async (tx) => {
      if (body.departmentCode) {
        const [department] = await tx
          .select({ active: departments.active })
          .from(departments)
          .where(eq(departments.code, body.departmentCode))
          .for('share');
        if (!department?.active) throw new BadRequestException('Select an active department.');
      }
      const [position] = await tx
        .insert(positions)
        .values(body)
        .onConflictDoNothing({ target: positions.code })
        .returning({ id: positions.id });
      if (!position) throw new ConflictException('A faculty position already uses that code');
      await tx.insert(auditLog).values(audit(actorId, 'create', { positionId: position.id }));
      return position;
    });
  }

  updateTitles(positionId: string, body: FacultyPositionTitles, actorId: string) {
    return this.db.transaction(async (tx) => {
      const [position] = await tx
        .update(positions)
        .set(body)
        .where(eq(positions.id, positionId))
        .returning({ id: positions.id });
      if (!position) throw new NotFoundException('Faculty position not found');
      await tx.insert(auditLog).values(audit(actorId, 'update-titles', { positionId }));
      return position;
    });
  }

  updateHolder(positionId: string, body: UpdateFacultyPositionHolder, actorId: string) {
    return this.db.transaction(async (tx) => {
      // Serialize changes even when there is no current appointment to lock.
      const [position] = await tx
        .select({ id: positions.id })
        .from(positions)
        .where(eq(positions.id, positionId))
        .for('update');
      if (!position) throw new NotFoundException('Faculty position not found');

      const [current] = await tx
        .select()
        .from(appointments)
        .where(and(eq(appointments.positionId, positionId), isNull(appointments.endedAt)));
      if ((current?.id ?? null) !== body.expectedAppointmentId) {
        throw new ConflictException(
          'The current holder changed. Refresh the position before trying again.',
        );
      }
      if ((current?.userId ?? null) === body.userId) return { appointmentId: current?.id ?? null };

      if (body.userId !== null) {
        const [account] = await tx
          .select({ approved: user.approved, enabled: user.enabled })
          .from(user)
          .where(eq(user.id, body.userId))
          .for('share');
        if (!account?.approved || !account.enabled) {
          throw new BadRequestException('Choose an approved, enabled account');
        }
      }

      const [time] = await tx
        .select({
          effectiveAt: sql<string>`greatest(date_trunc('milliseconds', clock_timestamp()), ${current?.startedAt.toISOString() ?? null}::timestamptz)::text`,
        })
        .from(positions)
        .where(eq(positions.id, positionId));
      const effectiveAt = new Date(time.effectiveAt);
      if (current) {
        await tx
          .update(appointments)
          .set({ endedAt: effectiveAt })
          .where(eq(appointments.id, current.id));
      }
      const appointmentId = body.userId === null ? null : randomUUID();
      if (appointmentId !== null && body.userId !== null) {
        await tx.insert(appointments).values({
          id: appointmentId,
          positionId,
          userId: body.userId,
          appointmentDate: body.appointmentDate ?? effectiveAt.toISOString().slice(0, 10),
          startedAt: effectiveAt,
        });
      }
      await tx.insert(auditLog).values(
        audit(actorId, 'update-holder', {
          positionId,
          previousAppointmentId: current?.id ?? null,
          appointmentId,
        }),
      );
      return { appointmentId };
    });
  }
}
