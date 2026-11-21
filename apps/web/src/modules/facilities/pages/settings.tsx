import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, X } from 'lucide-react';
import { facilityApi, facilityResourcePath } from '../lib/api';
import { useLanguage } from '../lib/language-context';
import type { Building, FacilitiesData, FacilityKind, Floor, RoomType } from '../lib/types';
import { useFacilities } from './use-facilities';

type SettingTab = 'buildings' | 'floors' | 'room-types';
type SettingsRecord = Building | Floor | RoomType;

function recordId(kind: SettingTab, record: SettingsRecord) {
  if (kind === 'buildings') return (record as Building).buildingId;
  if (kind === 'floors') return (record as Floor).floorId;
  return (record as RoomType).roomTypeId;
}

function SettingsDialog({
  kind,
  record,
  data,
  onClose,
}: {
  kind: SettingTab;
  record: SettingsRecord | null;
  data: FacilitiesData;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const client = useQueryClient();
  const [validation, setValidation] = useState('');
  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      facilityApi(
        facilityResourcePath(kind as FacilityKind, record ? recordId(kind, record) : undefined),
        record ? 'PATCH' : 'POST',
        body,
      ),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['facilities', 'data'] });
      onClose();
    },
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setValidation('');
    const form = new FormData(event.currentTarget);
    let body: Record<string, unknown>;
    if (kind === 'buildings') {
      body = {
        buildingCode: String(form.get('buildingCode') || '').trim(),
        title: String(form.get('title') || '').trim(),
        address: String(form.get('address') || '').trim() || null,
        status: String(form.get('status') || 'active'),
      };
    } else if (kind === 'floors') {
      const floorNumber = Number(form.get('floorNumber'));
      if (!Number.isInteger(floorNumber)) {
        setValidation('Enter a valid floor number.');
        return;
      }
      body = {
        buildingId: String(form.get('buildingId') || ''),
        floorNumber,
        title: String(form.get('title') || '').trim() || null,
      };
    } else {
      body = {
        name: String(form.get('name') || '').trim(),
        description: String(form.get('description') || '').trim() || null,
      };
    }
    save.mutate(body);
  };

  const building = kind === 'buildings' ? (record as Building | null) : null;
  const floor = kind === 'floors' ? (record as Floor | null) : null;
  const roomType = kind === 'room-types' ? (record as RoomType | null) : null;
  const heading = kind === 'buildings' ? 'Buildings' : kind === 'floors' ? 'Floors' : 'Room types';

  return (
    <div
      className="fac-modal-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        className="fac-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-dialog-title"
      >
        <div className="fac-modal-heading">
          <h2 id="settings-dialog-title">
            {t(record ? 'Edit record' : `Create ${heading.toLowerCase().replace(/s$/, '')}`)}
          </h2>
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
          {kind === 'buildings' && (
            <>
              <label className="fac-field">
                <span>{t('Building code')}</span>
                <input name="buildingCode" required defaultValue={building?.buildingCode || ''} />
              </label>
              <label className="fac-field">
                <span>{t('Title')}</span>
                <input name="title" required defaultValue={building?.title || ''} />
              </label>
              <label className="fac-field">
                <span>{t('Address')}</span>
                <input name="address" defaultValue={building?.address || ''} />
              </label>
              <label className="fac-field">
                <span>{t('Status')}</span>
                <select name="status" defaultValue={building?.status || 'active'}>
                  <option value="active">{t('Active')}</option>
                  <option value="inactive">{t('Inactive')}</option>
                </select>
              </label>
            </>
          )}
          {kind === 'floors' && (
            <>
              <label className="fac-field">
                <span>{t('Building')}</span>
                <select
                  name="buildingId"
                  required
                  defaultValue={floor?.buildingId || data.buildings[0]?.buildingId || ''}
                >
                  {data.buildings.map((item) => (
                    <option key={item.buildingId} value={item.buildingId}>
                      {item.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="fac-field">
                <span>{t('Floor number')}</span>
                <input
                  name="floorNumber"
                  type="number"
                  step="1"
                  required
                  defaultValue={floor?.floorNumber ?? ''}
                />
              </label>
              <label className="fac-field">
                <span>{t('Title')}</span>
                <input name="title" defaultValue={floor?.title || ''} />
              </label>
            </>
          )}
          {kind === 'room-types' && (
            <>
              <label className="fac-field">
                <span>{t('Name')}</span>
                <input name="name" required defaultValue={roomType?.name || ''} />
              </label>
              <label className="fac-field">
                <span>{t('Description')}</span>
                <textarea name="description" rows={3} defaultValue={roomType?.description || ''} />
              </label>
            </>
          )}
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
            <button type="button" className="fac-button fac-button--secondary" onClick={onClose}>
              {t('Cancel')}
            </button>
            <button className="fac-button" disabled={save.isPending}>
              {t(save.isPending ? 'Saving…' : 'Save')}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export function SettingsPage() {
  const { t } = useLanguage();
  const query = useFacilities();
  const [tab, setTab] = useState<SettingTab>('buildings');
  const [editing, setEditing] = useState<SettingsRecord | null | undefined>(undefined);
  if (query.isPending) return <p role="status">{t('Loading…')}</p>;
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
  const tabs: { id: SettingTab; label: string }[] = [
    { id: 'buildings', label: 'Buildings' },
    { id: 'floors', label: 'Floors' },
    { id: 'room-types', label: 'Room types' },
  ];
  const records: SettingsRecord[] =
    tab === 'buildings' ? data.buildings : tab === 'floors' ? data.floors : data.roomTypes;
  const buildingLabel = (id: string) =>
    data.buildings.find((item) => item.buildingId === id)?.title || '—';
  const heading = tab === 'buildings' ? 'Buildings' : tab === 'floors' ? 'Floors' : 'Room types';

  return (
    <div className="fac-stack">
      <section className="fac-page-heading">
        <div>
          <p className="fac-eyebrow">{t('Facilities configuration')}</p>
          <h2>{t('Settings')}</h2>
        </div>
        <button className="fac-button" onClick={() => setEditing(null)}>
          <Plus size={17} /> {t(`Create ${heading.toLowerCase().replace(/s$/, '')}`)}
        </button>
      </section>
      <div className="fac-tabs" role="tablist" aria-label={t('Settings')}>
        {tabs.map((item) => (
          <button
            key={item.id}
            role="tab"
            aria-selected={tab === item.id}
            className={tab === item.id ? 'is-selected' : ''}
            onClick={() => {
              setTab(item.id);
              setEditing(undefined);
            }}
          >
            {t(item.label)}
          </button>
        ))}
      </div>
      <section className="fac-card fac-room-list">
        <div className="fac-table-wrap">
          <table className="fac-table">
            <thead>
              {tab === 'buildings' && (
                <tr>
                  <th>{t('Building code')}</th>
                  <th>{t('Title')}</th>
                  <th>{t('Address')}</th>
                  <th>{t('Status')}</th>
                  <th>{t('Actions')}</th>
                </tr>
              )}
              {tab === 'floors' && (
                <tr>
                  <th>{t('Building')}</th>
                  <th>{t('Floor number')}</th>
                  <th>{t('Title')}</th>
                  <th>{t('Actions')}</th>
                </tr>
              )}
              {tab === 'room-types' && (
                <tr>
                  <th>{t('Name')}</th>
                  <th>{t('Description')}</th>
                  <th>{t('Actions')}</th>
                </tr>
              )}
            </thead>
            <tbody>
              {records.map((record) => {
                if (tab === 'buildings') {
                  const item = record as Building;
                  return (
                    <tr key={item.buildingId}>
                      <td>
                        <strong>{item.buildingCode}</strong>
                      </td>
                      <td>{item.title}</td>
                      <td>{item.address || '—'}</td>
                      <td>{t(item.status === 'active' ? 'Active' : 'Inactive')}</td>
                      <td>
                        <button
                          className="fac-icon-button"
                          aria-label={`${t('Edit')} ${item.title}`}
                          onClick={() => setEditing(item)}
                        >
                          <Pencil size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                }
                if (tab === 'floors') {
                  const item = record as Floor;
                  return (
                    <tr key={item.floorId}>
                      <td>{buildingLabel(item.buildingId)}</td>
                      <td>
                        <strong>{item.floorNumber}</strong>
                      </td>
                      <td>{item.title || '—'}</td>
                      <td>
                        <button
                          className="fac-icon-button"
                          aria-label={`${t('Edit')} ${item.floorNumber}`}
                          onClick={() => setEditing(item)}
                        >
                          <Pencil size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                }
                const item = record as RoomType;
                return (
                  <tr key={item.roomTypeId}>
                    <td>
                      <strong>{item.name}</strong>
                    </td>
                    <td>{item.description || '—'}</td>
                    <td>
                      <button
                        className="fac-icon-button"
                        aria-label={`${t('Edit')} ${item.name}`}
                        onClick={() => setEditing(item)}
                      >
                        <Pencil size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!records.length && (
                <tr>
                  <td colSpan={5} className="fac-empty">
                    {t('No records yet.')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      {editing !== undefined && (
        <SettingsDialog
          key={`${tab}-${editing ? recordId(tab, editing) : 'new'}`}
          kind={tab}
          record={editing}
          data={data}
          onClose={() => setEditing(undefined)}
        />
      )}
    </div>
  );
}
