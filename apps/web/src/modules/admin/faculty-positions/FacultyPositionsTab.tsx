import { DateInput, formatDate } from '@/components/ui/date-input';
import { Fragment, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateFacultyPosition,
  FacultyPosition,
  FacultyPositionAppointment,
  FacultyPositionHolder,
  FacultyPositionsResponse,
  FacultyPositionTitles,
  UpdateFacultyPositionHolder,
} from '@project/contracts/faculty-positions';
import { api, ApiError } from '../api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

const path = 'admin/faculty-positions';
const queryKey = ['faculty-positions'];
const formatTimestamp = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'medium',
});
const localDate = new Intl.DateTimeFormat('sv-SE', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function name(holder: FacultyPositionHolder) {
  return holder.username ? `${holder.name} (@${holder.username})` : holder.name;
}

function PositionForm({
  position,
  onSaved,
}: {
  position?: FacultyPosition;
  onSaved?: (id: string) => void;
}) {
  const client = useQueryClient();
  const save = useMutation({
    mutationFn: (body: CreateFacultyPosition | FacultyPositionTitles) =>
      api<{ id: string }>(
        position ? `${path}/${position.id}` : path,
        position ? 'PATCH' : 'POST',
        body,
      ),
    onSuccess: async ({ id }) => {
      await client.invalidateQueries({ queryKey });
      onSaved?.(id);
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const titles = {
      titleEn: String(fields.get('titleEn')).trim(),
      titleAr: String(fields.get('titleAr')).trim() || null,
    };
    save.mutate(
      position
        ? titles
        : {
            ...titles,
            code: String(fields.get('code')).trim(),
            departmentCode: String(fields.get('departmentCode')).trim() || null,
          },
    );
  }

  return (
    <form className="space-y-3" onSubmit={submit}>
      <h3>{position ? 'Edit titles' : 'Add position'}</h3>
      {!position && (
        <>
          <label>
            Position code
            <Input
              name="code"
              required
              maxLength={80}
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              placeholder="head-of-library"
            />
          </label>
          <label>
            Department code (optional)
            <Input name="departmentCode" maxLength={80} pattern="[a-z0-9]+(-[a-z0-9]+)*" />
          </label>
        </>
      )}
      <label>
        English title
        <Input name="titleEn" required maxLength={200} defaultValue={position?.titleEn} />
      </label>
      <label>
        Arabic title (optional)
        <Input name="titleAr" dir="rtl" maxLength={200} defaultValue={position?.titleAr ?? ''} />
      </label>
      <Button type="submit" disabled={save.isPending}>
        {position ? 'Save titles' : 'Add position'}
      </Button>
      {save.error && <p role="alert">{save.error.message}</p>}
      {save.isSuccess && <p role="status">Position saved.</p>}
    </form>
  );
}

function HolderForm({ position }: { position: FacultyPosition }) {
  const client = useQueryClient();
  const current = position.currentAppointment;
  const [userId, setUserId] = useState(current?.userId ?? '');
  const [appointmentDate, setAppointmentDate] = useState(() => localDate.format(new Date()));
  const candidates = useQuery({
    queryKey: [...queryKey, 'eligible-holders'],
    queryFn: () => api<FacultyPositionHolder[]>(`${path}/eligible-holders`),
  });
  const update = useMutation({
    mutationFn: (body: UpdateFacultyPositionHolder) =>
      api(`${path}/${position.id}/holder`, 'PUT', body),
    onSuccess: () => client.invalidateQueries({ queryKey }),
  });
  const accounts = candidates.data ?? [];
  const holderChanged = userId !== (current?.userId ?? '');
  const assigning = holderChanged && userId !== '';

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (
          current &&
          !window.confirm(userId ? 'Replace the current holder?' : 'Mark this position vacant?')
        )
          return;
        update.mutate({
          userId: userId || null,
          expectedAppointmentId: current?.id ?? null,
          appointmentDate: assigning ? appointmentDate : undefined,
        });
      }}
    >
      <h3>Current holder</h3>
      <label>
        Appoint user
        <select
          value={userId}
          onChange={(event) => setUserId(event.target.value)}
          disabled={update.isPending}
        >
          <option value="">Vacant</option>
          {current && !accounts.some((account) => account.userId === current.userId) && (
            <option value={current.userId}>{name(current)}</option>
          )}
          {accounts.map((account) => (
            <option key={account.userId} value={account.userId}>
              {name(account)}
            </option>
          ))}
        </select>
      </label>
      {assigning && (
        <label>
          Appointment date
          <DateInput
            value={appointmentDate}
            onValueChange={setAppointmentDate}
            required
            disabled={update.isPending}
          />
        </label>
      )}
      {candidates.isPending && <p>Loading eligible accounts…</p>}
      {candidates.error && <p role="alert">{candidates.error.message}</p>}
      <Button type="submit" disabled={update.isPending || !holderChanged}>
        Save holder
      </Button>
      {update.error && <p role="alert">{update.error.message}</p>}
      {update.error instanceof ApiError && update.error.status === 409 && (
        <Button
          type="button"
          variant="outline"
          onClick={() => void client.invalidateQueries({ queryKey })}
        >
          Refresh position
        </Button>
      )}
    </form>
  );
}

function History({ positionId }: { positionId: string }) {
  const history = useQuery({
    queryKey: [...queryKey, 'history', positionId],
    queryFn: () => api<FacultyPositionAppointment[]>(`${path}/${positionId}/appointments`),
  });
  return (
    <div className="overflow-x-auto">
      <h3>Appointment history</h3>
      {history.isPending && <p>Loading appointment history…</p>}
      {history.error && <p role="alert">{history.error.message}</p>}
      {history.data?.length === 0 && <p>No appointments yet.</p>}
      {!!history.data?.length && (
        <table>
          <thead>
            <tr>
              <th>Holder</th>
              <th>Appointment date</th>
              <th>Recorded at</th>
              <th>Ended</th>
            </tr>
          </thead>
          <tbody>
            {history.data.map((entry) => (
              <tr key={entry.id}>
                <td>{name(entry)}</td>
                <td>{formatDate(entry.appointmentDate ?? entry.startedAt.slice(0, 10))}</td>
                <td>{formatTimestamp.format(new Date(entry.startedAt))}</td>
                <td>
                  {entry.endedAt ? formatTimestamp.format(new Date(entry.endedAt)) : 'Current'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function FacultyPositionsTab() {
  const [selectedId, setSelectedId] = useState('');
  const [adding, setAdding] = useState(false);
  const catalog = useQuery({
    queryKey,
    queryFn: () => api<FacultyPositionsResponse>(path),
  });
  if (catalog.isPending) return <p>Loading faculty positions…</p>;
  if (catalog.error) return <p role="alert">{catalog.error.message}</p>;

  const { positions, canManage } = catalog.data;
  return (
    <section className="panel overflow-x-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2>Faculty Positions</h2>
        {canManage && (
          <Button onClick={() => setAdding(!adding)}>
            {adding ? 'Cancel adding position' : 'Add position'}
          </Button>
        )}
      </div>
      {canManage && adding && (
        <PositionForm
          onSaved={(id) => {
            setAdding(false);
            setSelectedId(id);
          }}
        />
      )}
      <table>
        <thead>
          <tr>
            <th>Position</th>
            <th>Scope</th>
            <th>Current holder</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {positions.map((position) => {
            const expanded = selectedId === position.id;
            const detailsId = `faculty-position-details-${position.id}`;
            const holder = position.currentAppointment;
            const appointmentDate = holder?.appointmentDate ?? holder?.startedAt.slice(0, 10);
            const action = canManage
              ? holder
                ? 'Manage holder'
                : 'Assign holder'
              : 'View details';

            return (
              <Fragment key={position.id}>
                <tr>
                  <td>
                    {position.titleEn}
                    {position.titleAr && (
                      <div lang="ar" dir="auto" className="text-sm">
                        {position.titleAr}
                      </div>
                    )}
                  </td>
                  <td>{position.departmentCode ?? 'Faculty-wide'}</td>
                  <td>
                    {holder ? (
                      <>
                        {name(holder)}
                        {appointmentDate && (
                          <div className="text-sm">
                            Appointed{' '}
                            <time dateTime={appointmentDate}>{formatDate(appointmentDate)}</time>
                          </div>
                        )}
                      </>
                    ) : (
                      'Vacant'
                    )}
                  </td>
                  <td>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      aria-label={`${action} for ${position.titleEn}`}
                      aria-expanded={expanded}
                      aria-controls={expanded ? detailsId : undefined}
                      onClick={() => setSelectedId(expanded ? '' : position.id)}
                    >
                      {action}
                    </Button>
                  </td>
                </tr>
                {expanded && (
                  <tr>
                    <td colSpan={4}>
                      <section
                        id={detailsId}
                        aria-labelledby={`${detailsId}-title`}
                        className="space-y-5"
                      >
                        <h3 id={`${detailsId}-title`} className="text-lg">
                          {position.titleEn}
                        </h3>
                        {canManage && (
                          <div className="grid gap-6 md:grid-cols-2">
                            <HolderForm key={holder?.id ?? 'vacant'} position={position} />
                            <PositionForm position={position} />
                          </div>
                        )}
                        <History positionId={position.id} />
                      </section>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
