import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import {
  ApiError,
  api,
  asQuery,
  useResource,
  useWrite,
  type AssetRow,
  type Ref,
  type Storage,
} from '../lib/api';
import {
  bidi,
  Choice,
  ErrorMessage,
  Field,
  Grid,
  localizedName,
  Pager,
  Picker,
  Resource,
  useFilters,
} from '../components/common';
import { useLanguage } from '../lib/i18n';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { assetOptions, conditions, operations } from './reads';

type Kind = (typeof operations)[number];
type AssetOption = ReturnType<typeof assetOptions>[number];
type Party = { kind: 'employee' | 'shared'; id: string };
type Line = {
  key: string;
  mode: 'asset' | 'consumable';
  asset?: AssetOption;
  item?: Ref;
  fields: Record<string, string>;
};
const line = (mode: Line['mode'] = 'asset'): Line => ({
  key: crypto.randomUUID(),
  mode,
  fields: {},
});
const storageOptions = (data: unknown) =>
  ((data as Storage[] | undefined) ?? []).map((row) => ({ ...row, id: row.roomId }));
const receivable = (row: ReturnType<typeof storageOptions>[number]) =>
  row.enabled === 1 && row.roomStatus === 'active';
function Store({
  label,
  value,
  set,
  inbound = false,
}: {
  label: string;
  value: string;
  set: (value: string) => void;
  inbound?: boolean;
}) {
  return (
    <Picker
      label={label}
      path="inventory/storage"
      required
      value={value}
      onChange={set}
      normalize={storageOptions}
      filter={inbound ? receivable : undefined}
    />
  );
}
function PartyPicker({
  label,
  value,
  set,
}: {
  label: string;
  value: Party;
  set: (value: Party) => void;
}) {
  return (
    <div className="inv-stack">
      <Choice
        label={label}
        choices={['employee', 'shared']}
        value={value.kind}
        onChange={(kind) => set({ kind: kind as Party['kind'], id: '' })}
      />
      <Picker
        label={value.kind === 'employee' ? 'Employee' : 'Shared account'}
        path={value.kind === 'employee' ? 'inventory/employees' : 'inventory/shared-accounts'}
        value={value.id}
        onChange={(id) => set({ ...value, id })}
        required
      />
    </div>
  );
}
export function whole(value: string) {
  const normalized = value
    .trim()
    .replace(/[٠-٩]/g, (n) => String(n.charCodeAt(0) - 1632))
    .replace(/[۰-۹]/g, (n) => String(n.charCodeAt(0) - 1776));
  return /^-?\d+$/.test(normalized) ? Number(normalized) : NaN;
}
export function roomPatch(mode: string, roomId: string) {
  return mode === 'keep' ? {} : { destinationRoomId: mode === 'clear' ? null : roomId };
}
const forms = {
  keep: 'keep',
  change: 'change',
  clear: 'clear',
};
export function TransactionForm({ kind }: { kind: Kind }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const lang = useLanguage((s) => s.language);
  const write = useWrite<{ id: string }>('inventory/transactions');
  const [header, setHeader] = useState({ name: '', reference: '', notes: '', eventDate: '' });
  const [sourceRoomId, setSourceRoom] = useState('');
  const [destinationRoomId, setDestinationRoom] = useState('');
  const [source, setSource] = useState('purchase');
  const [mode, setMode] = useState('keep');
  const [from, setFrom] = useState<Party>({ kind: 'employee', id: '' });
  const [recipient, setRecipient] = useState<Party>({ kind: 'employee', id: '' });
  const [lines, setLines] = useState(() => [
    line(kind.startsWith('consumable-') ? 'consumable' : 'asset'),
  ]);
  const [validation, setValidation] = useState('');
  const [reloading, setReloading] = useState(false);
  const [reloadError, setReloadError] = useState<unknown>();
  const [review, setReview] = useState(false);
  const receipt = kind === 'receipt',
    relocate = kind === 'storage-relocation',
    adjustment = kind === 'consumable-adjustment';
  const src = kind === 'asset-issue' || relocate || kind === 'consumable-issue';
  const dst = receipt || kind === 'asset-return' || relocate;
  const partyFrom = kind === 'asset-handover' || kind === 'asset-return';
  const partyTo = kind === 'asset-issue' || kind === 'asset-handover';
  const isAllowed = (item: AssetOption) => {
    if (item.asset.status !== (kind === 'disposal' ? 'decommissioned' : 'active')) return false;
    if ((kind === 'asset-issue' || relocate) && item.asset.roomId !== sourceRoomId) return false;
    if (kind === 'asset-issue' && !item.custody?.sharedAccountId) return false;
    return (
      !partyFrom ||
      (from.kind === 'employee' ? item.custody?.employeeId : item.custody?.sharedAccountId) ===
        from.id
    );
  };
  const assetPath = asQuery('inventory/assets', {
    status: kind === 'disposal' ? 'decommissioned' : 'active',
    roomId: kind === 'asset-issue' || relocate ? sourceRoomId : undefined,
    employeeId: partyFrom && from.kind === 'employee' ? from.id : undefined,
    sharedAccountId: partyFrom && from.kind === 'shared' ? from.id : undefined,
  });
  const stale =
    write.error instanceof ApiError &&
    [
      'Asset changed since it was loaded',
      'Asset is no longer at the source room',
      'Asset custody no longer matches the source',
    ].includes(write.error.message);
  const change = (row: Line, patch: Partial<Line>) => {
    setValidation('');
    setLines((list) => list.map((item) => (item.key === row.key ? { ...item, ...patch } : item)));
  };
  async function refresh() {
    setReloading(true);
    setReloadError(undefined);
    try {
      const fresh = await Promise.all(
        lines.map(async (row) => {
          if (!row.asset) return row;
          const data = await api<AssetRow[]>(
            asQuery('inventory/assets', { q: row.asset.code, limit: 100 }),
          );
          const updated = assetOptions(data).find((item) => item.id === row.asset?.id);
          return { ...row, asset: updated && isAllowed(updated) ? updated : undefined };
        }),
      );
      setLines(fresh);
      setReview(true);
      write.reset();
    } catch (error) {
      setReloadError(error);
    } finally {
      setReloading(false);
    }
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    setValidation('');
    if (stale || review) return;
    if (
      !header.name.trim() ||
      lines.some(({ fields }) =>
        Object.values(fields).some((value) => value !== '' && !value.trim()),
      )
    ) {
      setValidation('Check the form values and try again.');
      return;
    }
    const identifiers = lines.map((row) =>
      row.mode === 'consumable' ? row.item?.id : receipt ? row.fields.tag?.trim() : row.asset?.id,
    );
    if (new Set(identifiers).size !== identifiers.length) {
      setValidation('Select a different item for each line.');
      return;
    }
    if (
      lines.some((row) =>
        row.mode === 'asset'
          ? !receipt && (!row.asset || !isAllowed(row.asset))
          : !row.item ||
            !Number.isInteger(whole(row.fields.amount ?? '')) ||
            Math.abs(whole(row.fields.amount ?? '')) > 2147483647 ||
            (adjustment
              ? whole(row.fields.amount ?? '') === 0
              : whole(row.fields.amount ?? '') < 1),
      )
    ) {
      setValidation('Check quantities and required fields.');
      return;
    }
    const items = lines.map((row) => {
      if (row.mode === 'consumable') {
        const consumableId = row.item?.id;
        const amount = whole(row.fields.amount);
        return adjustment
          ? { consumableId, delta: amount, reason: row.fields.reason.trim() }
          : {
              ...(receipt || relocate ? { kind: 'consumable' } : {}),
              consumableId,
              quantity: amount,
            };
      }
      if (receipt)
        return {
          kind: 'asset',
          ...Object.fromEntries(
            Object.entries(row.fields)
              .map(([key, value]) => [key, value.trim()])
              .filter(([, value]) => value),
          ),
        };
      return {
        assetId: row.asset?.id,
        expectedRevision: row.asset?.asset.revision,
        ...(relocate && { kind: 'asset' }),
        ...(kind === 'condition-change' && {
          condition: row.fields.condition,
          reason: row.fields.reason.trim(),
        }),
      };
    });
    write.mutate(
      {
        type: kind,
        name: header.name.trim(),
        eventDate: header.eventDate,
        reference: header.reference.trim() || undefined,
        notes: header.notes.trim() || undefined,
        items,
        ...(receipt && { source }),
        ...(src && { sourceRoomId }),
        ...(dst && { destinationRoomId }),
        ...(adjustment && { roomId: sourceRoomId }),
        ...(partyFrom && { from }),
        ...(partyTo && { recipient, ...roomPatch(mode, destinationRoomId) }),
        ...(kind === 'consumable-issue' && { employeeId: recipient.id }),
      },
      { onSuccess: (result) => void navigate(`/inventory/transactions/${result.id}`) },
    );
  }
  return (
    <section className="inv-stack">
      <h2>{t(kind)}</h2>
      <form onSubmit={submit} className="inv-stack">
        <fieldset disabled={write.isPending || reloading} className="inv-stack">
          <div className="inv-fields inv-panel">
            {(
              [
                ['name', 'Name'],
                ['eventDate', 'Event date'],
                ['reference', 'Reference'],
                ['notes', 'Notes'],
              ] as const
            ).map(([key, label]) => (
              <Field key={key} label={label}>
                {key === 'notes' ? (
                  <Textarea
                    maxLength={2000}
                    value={header[key]}
                    onChange={(e) => setHeader({ ...header, [key]: e.target.value })}
                  />
                ) : (
                  <Input
                    maxLength={200}
                    type={key === 'eventDate' ? 'date' : 'text'}
                    required={key !== 'reference' || receipt || kind === 'disposal'}
                    value={header[key]}
                    onChange={(e) => setHeader({ ...header, [key]: e.target.value })}
                  />
                )}
              </Field>
            ))}
            {receipt && (
              <Choice
                label="Source"
                value={source}
                onChange={setSource}
                choices={['purchase', 'head-administration']}
              />
            )}
            {(src || adjustment) && (
              <Store
                label={adjustment ? 'Storage room' : 'Source storage'}
                value={sourceRoomId}
                set={setSourceRoom}
              />
            )}
            {dst && (
              <Store
                label="Destination storage"
                value={destinationRoomId}
                set={setDestinationRoom}
                inbound
              />
            )}
            {partyFrom && <PartyPicker label="Current party" value={from} set={setFrom} />}
            {partyTo && (
              <>
                <PartyPicker label="Recipient" value={recipient} set={setRecipient} />
                <Choice
                  label="Room"
                  choices={[forms.keep, forms.change, forms.clear]}
                  value={mode}
                  onChange={setMode}
                />
                {mode === 'change' && (
                  <Picker
                    label="Destination"
                    path="inventory/rooms"
                    value={destinationRoomId}
                    onChange={setDestinationRoom}
                    filter={(room) => room.status === 'active'}
                    required
                  />
                )}
              </>
            )}
            {kind === 'consumable-issue' && (
              <Picker
                label="Recipient"
                path="inventory/employees"
                value={recipient.id}
                onChange={(id) => setRecipient({ kind: 'employee', id })}
                required
              />
            )}
          </div>
          {lines.map((row, index) => {
            const field = (key: string, label: string, required = false) => (
              <Field key={key} label={label}>
                <Input
                  required={required}
                  maxLength={key === 'reason' || key === 'notes' ? 2000 : 200}
                  value={row.fields[key] ?? ''}
                  onChange={(e) =>
                    change(row, { fields: { ...row.fields, [key]: e.target.value } })
                  }
                />
              </Field>
            );
            return (
              <fieldset key={row.key} className="inv-panel inv-stack">
                <legend>
                  {index + 1} · {t(row.mode === 'asset' ? 'Asset' : 'Consumable')}
                </legend>
                <div className="inv-fields">
                  {(receipt || relocate) && (
                    <Choice
                      label="Type"
                      choices={['asset', 'consumable']}
                      value={row.mode}
                      onChange={(value) =>
                        change(row, {
                          mode: value as Line['mode'],
                          asset: undefined,
                          item: undefined,
                          fields: {},
                        })
                      }
                    />
                  )}
                  {row.mode === 'consumable' ? (
                    <>
                      <Picker
                        label="Consumable"
                        path="inventory/consumables"
                        value={row.item?.id ?? ''}
                        onChange={(_, item) => change(row, { item })}
                        required
                      />
                      <Field label={adjustment ? 'Delta' : 'Quantity'}>
                        <Input
                          inputMode="numeric"
                          required
                          value={row.fields.amount ?? ''}
                          onChange={(e) =>
                            change(row, { fields: { ...row.fields, amount: e.target.value } })
                          }
                        />
                      </Field>
                      {row.item?.unit && (
                        <p>
                          {t('Unit')} · {t(row.item.unit)}
                        </p>
                      )}
                      {adjustment && field('reason', 'Reason', true)}
                    </>
                  ) : receipt ? (
                    <>
                      {(
                        [
                          ['tag', 'Tag'],
                          ['name', 'Name'],
                          ['category', 'Category'],
                          ['model', 'Model'],
                          ['serialNumber', 'Serial number'],
                          ['acquisitionReference', 'Acquisition reference'],
                          ['notes', 'Notes'],
                        ] as const
                      ).map(([key, label]) => field(key, label, key === 'tag' || key === 'name'))}
                      <Choice
                        label="Condition"
                        value={row.fields.condition ?? ''}
                        choices={conditions}
                        optional
                        onChange={(value) =>
                          change(row, { fields: { ...row.fields, condition: value } })
                        }
                      />
                    </>
                  ) : (
                    <>
                      <Picker
                        label="Asset"
                        path={assetPath}
                        value={row.asset?.id ?? ''}
                        onChange={(_, asset) => change(row, { asset })}
                        normalize={assetOptions}
                        filter={isAllowed}
                        required
                      />
                      {row.asset && (
                        <p>
                          {bidi(row.asset.code)} · {bidi(row.asset.room ?? t('No room'))} ·{' '}
                          {bidi(
                            localizedName(row.asset.employee, lang) ??
                              row.asset.sharedAccount ??
                              t('No custodian'),
                          )}{' '}
                          · {t(row.asset.asset.condition)} ·{' '}
                          {t('Revision {{number}}', { number: row.asset.asset.revision })}
                        </p>
                      )}
                      {row.asset && !isAllowed(row.asset) && (
                        <p role="alert">{t('Asset is no longer eligible.')}</p>
                      )}
                      {kind === 'condition-change' && (
                        <>
                          <Choice
                            label="Condition"
                            value={row.fields.condition ?? ''}
                            choices={conditions}
                            onChange={(value) =>
                              change(row, { fields: { ...row.fields, condition: value } })
                            }
                          />
                          {field('reason', 'Reason', true)}
                        </>
                      )}
                    </>
                  )}
                </div>
                {lines.length > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setLines((list) => list.filter(({ key }) => key !== row.key))}
                  >
                    {t('Remove')}
                  </Button>
                )}
              </fieldset>
            );
          })}
          <div className="inv-actions">
            <Button
              type="button"
              variant="outline"
              disabled={lines.length >= 100}
              onClick={() => setLines((list) => [...list, line(list[0].mode)])}
            >
              {t('Add line')}
            </Button>
            <Button disabled={stale || review}>
              {t(write.isPending ? 'Saving…' : 'Post transaction')}
            </Button>
          </div>
        </fieldset>
        {validation && <p role="alert">{t(validation)}</p>}
        <ErrorMessage error={write.error} />
        <ErrorMessage error={reloadError} />
        {stale && (
          <Button
            type="button"
            variant="outline"
            disabled={reloading}
            onClick={() => void refresh()}
          >
            {t('Refresh and review assets')}
          </Button>
        )}
        {review && (
          <Button type="button" variant="outline" onClick={() => setReview(false)}>
            {t('Review updated revisions')}
          </Button>
        )}
      </form>
    </section>
  );
}

function StorageEditor() {
  const { t } = useTranslation();
  const [room, setRoom] = useState('');
  const [account, setAccount] = useState('');
  const [enabled, setEnabled] = useState(true);
  const write = useWrite(`inventory/storage/${room}`, 'PUT');
  const filters = useFilters();
  const storage = useResource<Storage[]>(
    asQuery('inventory/storage', { limit: 50, offset: filters.offset }),
  );
  return (
    <section className="inv-panel inv-stack">
      <h3>{t('Storage locations')}</h3>
      <Resource query={storage}>
        {(rows) => (
          <>
            <Grid
              columns={['Code', 'Room', 'Shared account', 'Enabled']}
              rows={rows.map((row) => ({
                id: row.roomId,
                cells: [
                  bidi(row.code),
                  <button
                    type="button"
                    className="inv:underline"
                    onClick={() => {
                      setRoom(row.roomId);
                      setAccount(row.sharedAccountId);
                      setEnabled(Boolean(row.enabled));
                      write.reset();
                    }}
                  >
                    {bidi(row.name)}
                  </button>,
                  bidi(row.sharedAccount),
                  row.enabled ? '✓' : '—',
                ],
              }))}
            />
            <Pager
              offset={filters.offset}
              next={rows.length === 50}
              change={(offset) => filters.update('offset', String(offset))}
            />
          </>
        )}
      </Resource>
      <form
        className="inv-stack"
        onSubmit={(e) => {
          e.preventDefault();
          write.mutate({ sharedAccountId: account, enabled });
        }}
      >
        <fieldset disabled={write.isPending} className="inv-fields">
          <Picker
            label="Room"
            path="inventory/rooms"
            value={room}
            onChange={(id) => {
              setRoom(id);
              write.reset();
            }}
            required
          />
          <Picker
            label="Shared account"
            path="inventory/shared-accounts"
            value={account}
            onChange={setAccount}
            required
          />
          <Field label="Enabled">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
          </Field>
        </fieldset>
        <Button disabled={write.isPending || !room || !account}>{t('Save storage')}</Button>
        <ErrorMessage error={write.error} />
        {write.isSuccess && <p role="status">{t('Saved')}</p>}
      </form>
    </section>
  );
}

function Catalog({ shared }: { shared?: boolean }) {
  const { t } = useTranslation();
  const path = shared ? 'inventory/shared-accounts' : 'inventory/consumables';
  const [offset, setOffset] = useState(0);
  const query = useResource<Ref[]>(asQuery(path, { limit: 50, offset }));
  const write = useWrite(path);
  return (
    <section className="inv-panel inv-stack">
      <h3>{t(shared ? 'Shared accounts' : 'Consumable catalog')}</h3>
      <Resource query={query}>
        {(rows) => (
          <>
            <Grid
              columns={shared ? ['Name'] : ['Code', 'Name', 'Unit']}
              rows={rows.map((row) => ({
                id: row.id,
                cells: shared
                  ? [bidi(row.name)]
                  : [bidi(row.code), bidi(row.name), t(row.unit ?? '')],
              }))}
            />
            <Pager offset={offset} next={rows.length === 50} change={setOffset} />
          </>
        )}
      </Resource>
      <form
        className="inv-stack"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          write.mutate(Object.fromEntries(new FormData(form)), { onSuccess: () => form.reset() });
        }}
      >
        <fieldset className="inv-fields" disabled={write.isPending}>
          {(shared ? ['name'] : ['code', 'name', 'unit']).map((key) => (
            <Field key={key} label={key[0].toUpperCase() + key.slice(1)}>
              <Input name={key} maxLength={200} required />
            </Field>
          ))}
        </fieldset>
        <Button disabled={write.isPending}>
          {t(shared ? 'Create shared account' : 'Create consumable')}
        </Button>
        <ErrorMessage error={write.error} />
        {write.isSuccess && <p role="status">{t('Saved')}</p>}
      </form>
    </section>
  );
}
export function SettingsPage() {
  const { t } = useTranslation();
  return (
    <section className="inv-stack">
      <h2>{t('Settings')}</h2>
      <StorageEditor />
      <Catalog shared />
      <Catalog />
    </section>
  );
}
