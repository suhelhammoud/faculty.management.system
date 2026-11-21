import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Search, X } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { facilityApi, facilityResourcePath } from '../lib/api';
import { useLanguage } from '../lib/language-context';
import type { FacilitiesData, Room } from '../lib/types';
import { useFacilities } from './use-facilities';

function RoomDialog({
  room,
  data,
  onClose,
}: {
  room: Room | null;
  data: FacilitiesData;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const client = useQueryClient();
  const [validation, setValidation] = useState('');
  const save = useMutation({
    mutationFn: async (body: Record<string, unknown>) =>
      facilityApi<Room>(facilityResourcePath('rooms', room?.roomId), room ? 'PATCH' : 'POST', body),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['facilities', 'data'] });
      onClose();
    },
  });
  const [buildingId, setBuildingId] = useState(
    room?.buildingId || data.buildings[0]?.buildingId || '',
  );
  const [floorId, setFloorId] = useState(room?.floorId || '');
  const floors = data.floors.filter((floor) => floor.buildingId === buildingId);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setValidation('');
    const form = new FormData(event.currentTarget);
    const maximumValue = String(form.get('maximumStudentCapacity') || '').trim();
    const availableValue = String(form.get('currentAvailableStudentCapacity') || '').trim();
    const maximum = maximumValue ? Number(maximumValue) : null;
    const available = availableValue ? Number(availableValue) : null;
    if (
      [maximum, available].some(
        (value) => value !== null && (!Number.isInteger(value) || value < 0),
      )
    ) {
      setValidation('Enter a valid capacity.');
      return;
    }
    if (maximum !== null && available !== null && available > maximum) {
      setValidation('Available capacity cannot exceed maximum capacity.');
      return;
    }
    save.mutate({
      buildingId,
      floorId: String(form.get('floorId') || ''),
      roomTypeId: String(form.get('roomTypeId') || ''),
      roomCode: String(form.get('roomCode') || '').trim(),
      title: String(form.get('title') || '').trim(),
      maximumStudentCapacity: maximum,
      currentAvailableStudentCapacity: available,
      status: String(form.get('status') || 'active'),
    });
  };

  return (
    <div
      className="fac-modal-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        className="fac-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="room-dialog-title"
      >
        <div className="fac-modal-heading">
          <h2 id="room-dialog-title">{t(room ? 'Edit room' : 'Add room')}</h2>
          <button
            type="button"
            className="fac-icon-button"
            onClick={onClose}
            aria-label={t('Cancel')}
          >
            <X size={18} />
          </button>
        </div>
        <form className="fac-form" onSubmit={submit}>
          <label className="fac-field">
            <span>{t('Building')}</span>
            <select
              name="buildingId"
              required
              value={buildingId}
              onChange={(event) => {
                const nextBuildingId = event.target.value;
                setBuildingId(nextBuildingId);
                const firstFloor = data.floors.find((floor) => floor.buildingId === nextBuildingId);
                setFloorId(firstFloor?.floorId || '');
              }}
            >
              {data.buildings.map((building) => (
                <option key={building.buildingId} value={building.buildingId}>
                  {building.title} ({building.buildingCode})
                </option>
              ))}
            </select>
          </label>
          <label className="fac-field">
            <span>{t('Floor')}</span>
            <select
              name="floorId"
              required
              value={
                floors.some((floor) => floor.floorId === floorId)
                  ? floorId
                  : floors[0]?.floorId || ''
              }
              onChange={(event) => setFloorId(event.target.value)}
            >
              {floors.map((floor) => (
                <option key={floor.floorId} value={floor.floorId}>
                  {floor.title || `${t('Floor')} ${floor.floorNumber}`}
                </option>
              ))}
            </select>
          </label>
          <label className="fac-field">
            <span>{t('Room type')}</span>
            <select
              name="roomTypeId"
              required
              defaultValue={room?.roomTypeId || data.roomTypes[0]?.roomTypeId || ''}
            >
              {data.roomTypes.map((type) => (
                <option key={type.roomTypeId} value={type.roomTypeId}>
                  {t(type.name)}
                </option>
              ))}
            </select>
          </label>
          <label className="fac-field">
            <span>{t('Room code')}</span>
            <input name="roomCode" required maxLength={1000} defaultValue={room?.roomCode || ''} />
          </label>
          <label className="fac-field">
            <span>{t('Title')}</span>
            <input name="title" required maxLength={1000} defaultValue={room?.title || ''} />
          </label>
          <label className="fac-field">
            <span>{t('Maximum student capacity')}</span>
            <input
              type="number"
              min="0"
              step="1"
              name="maximumStudentCapacity"
              defaultValue={room?.maximumStudentCapacity ?? ''}
            />
          </label>
          <label className="fac-field">
            <span>{t('Current available student capacity')}</span>
            <input
              type="number"
              min="0"
              step="1"
              name="currentAvailableStudentCapacity"
              defaultValue={room?.currentAvailableStudentCapacity ?? ''}
            />
          </label>
          <label className="fac-field">
            <span>{t('Status')}</span>
            <select name="status" defaultValue={room?.status || 'active'}>
              <option value="active">{t('Active')}</option>
              <option value="inactive">{t('Inactive')}</option>
            </select>
          </label>
          {validation && (
            <p className="fac-error" role="alert">
              {t(validation)}
            </p>
          )}
          {save.error && (
            <p className="fac-error" role="alert">
              {t(save.error.message)}
            </p>
          )}
          <div className="fac-actions fac-modal-actions">
            <button className="fac-button fac-button--secondary" type="button" onClick={onClose}>
              {t('Cancel')}
            </button>
            <button className="fac-button" disabled={save.isPending}>
              {t(save.isPending ? 'Saving…' : 'Save room')}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export function RoomsPage() {
  const { t } = useLanguage();
  const query = useFacilities();
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get('search') || '';
  const buildingFilter = searchParams.get('building') || '';
  const floorFilter = searchParams.get('floor') || '';
  const typeFilter = searchParams.get('type') || '';
  const statusFilter = searchParams.get('status') || '';
  const [editing, setEditing] = useState<Room | null | undefined>(undefined);
  const updateFilter = (key: string, value: string) => {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );
  };

  const filtered = useMemo(() => {
    const data = query.data;
    if (!data) return [];
    const needle = search.trim().toLowerCase();
    return data.rooms.filter((room) => {
      const matchesSearch =
        !needle || `${room.roomCode} ${room.title}`.toLowerCase().includes(needle);
      return (
        matchesSearch &&
        (!buildingFilter || room.buildingId === buildingFilter) &&
        (!floorFilter || room.floorId === floorFilter) &&
        (!typeFilter || room.roomTypeId === typeFilter) &&
        (!statusFilter || room.status === statusFilter)
      );
    });
  }, [query.data, search, buildingFilter, floorFilter, typeFilter, statusFilter]);

  if (query.isPending)
    return (
      <p className="fac-muted" role="status">
        {t('Loading…')}
      </p>
    );
  if (query.error) {
    return (
      <div className="fac-card fac-stack" role="alert">
        <p>{t(query.error.message)}</p>
        <button className="fac-button fac-button--secondary" onClick={() => void query.refetch()}>
          {t('Retry')}
        </button>
      </div>
    );
  }
  const data = query.data;
  if (!data) return null;
  const count = (name: string) =>
    data.rooms.filter(
      (room) => data.roomTypes.find((x) => x.roomTypeId === room.roomTypeId)?.name === name,
    ).length;
  const floorOptions = buildingFilter
    ? data.floors.filter((floor) => floor.buildingId === buildingFilter)
    : data.floors;
  const buildingLabel = (id: string) =>
    data.buildings.find((building) => building.buildingId === id)?.title || '—';
  const floorLabel = (id: string) => {
    const floor = data.floors.find((row) => row.floorId === id);
    return floor ? floor.title || `${t('Floor')} ${floor.floorNumber}` : '—';
  };
  const typeLabel = (id: string) =>
    data.roomTypes.find((row) => row.roomTypeId === id)?.name || '—';

  return (
    <div className="fac-stack">
      <section className="fac-page-heading">
        <div>
          <p className="fac-eyebrow">{t('Physical spaces')}</p>
          <h2>{t('Rooms')}</h2>
          <p className="fac-muted">{t('Overview of registered spaces and room availability.')}</p>
        </div>
        <button className="fac-button" onClick={() => setEditing(null)}>
          <Plus size={17} /> {t('Add room')}
        </button>
      </section>

      <section className="fac-stats" aria-label={t('Rooms')}>
        {[
          ['Total rooms', data.rooms.length],
          ['Classrooms', count('classroom')],
          ['Laboratories', count('laboratory')],
          ['Theaters', count('theater')],
        ].map(([label, value]) => (
          <article className="fac-card fac-stat" key={label}>
            <p className="fac-muted">{t(String(label))}</p>
            <strong>{value}</strong>
          </article>
        ))}
      </section>

      <section className="fac-card fac-room-list">
        <div className="fac-filter-bar">
          <label className="fac-search">
            <Search size={17} aria-hidden="true" />
            <input
              aria-label={t('Search rooms')}
              placeholder={t('Search rooms')}
              value={search}
              onChange={(e) => updateFilter('search', e.target.value)}
            />
          </label>
          <select
            aria-label={t('Building')}
            value={buildingFilter}
            onChange={(e) => {
              updateFilter('building', e.target.value);
              updateFilter('floor', '');
            }}
          >
            <option value="">{t('All buildings')}</option>
            {data.buildings.map((building) => (
              <option key={building.buildingId} value={building.buildingId}>
                {building.title}
              </option>
            ))}
          </select>
          <select
            aria-label={t('Floor')}
            value={floorFilter}
            onChange={(e) => updateFilter('floor', e.target.value)}
          >
            <option value="">{t('All floors')}</option>
            {floorOptions.map((floor) => (
              <option key={floor.floorId} value={floor.floorId}>
                {floor.title || `${t('Floor')} ${floor.floorNumber}`}
              </option>
            ))}
          </select>
          <select
            aria-label={t('Room type')}
            value={typeFilter}
            onChange={(e) => updateFilter('type', e.target.value)}
          >
            <option value="">{t('All room types')}</option>
            {data.roomTypes.map((type) => (
              <option key={type.roomTypeId} value={type.roomTypeId}>
                {t(type.name)}
              </option>
            ))}
          </select>
          <select
            aria-label={t('Status')}
            value={statusFilter}
            onChange={(e) => updateFilter('status', e.target.value)}
          >
            <option value="">{t('All')}</option>
            <option value="active">{t('Active')}</option>
            <option value="inactive">{t('Inactive')}</option>
          </select>
        </div>
        <div className="fac-table-wrap">
          <table className="fac-table">
            <thead>
              <tr>
                <th>{t('Room code')}</th>
                <th>{t('Title')}</th>
                <th>{t('Room type')}</th>
                <th>{t('Building')}</th>
                <th>{t('Floor')}</th>
                <th>{t('Available / maximum')}</th>
                <th>{t('Status')}</th>
                <th>{t('Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((room) => (
                <tr key={room.roomId}>
                  <td>
                    <strong>{room.roomCode}</strong>
                  </td>
                  <td>{room.title}</td>
                  <td>{t(typeLabel(room.roomTypeId))}</td>
                  <td>{buildingLabel(room.buildingId)}</td>
                  <td>{floorLabel(room.floorId)}</td>
                  <td>
                    {room.currentAvailableStudentCapacity ?? '—'} /{' '}
                    {room.maximumStudentCapacity ?? '—'}
                  </td>
                  <td>
                    <span
                      className={`fac-status ${room.status === 'active' ? 'is-active' : 'is-inactive'}`}
                    >
                      {t(room.status === 'active' ? 'Active' : 'Inactive')}
                    </span>
                  </td>
                  <td>
                    <button
                      className="fac-icon-button"
                      aria-label={`${t('Edit')} ${room.roomCode}`}
                      onClick={() => setEditing(room)}
                    >
                      <Pencil size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="fac-empty">
                    {t('No rooms found.')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      {editing !== undefined && (
        <RoomDialog
          key={editing?.roomId || 'new'}
          room={editing}
          data={data}
          onClose={() => setEditing(undefined)}
        />
      )}
    </div>
  );
}
