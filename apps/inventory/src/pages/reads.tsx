import { Link, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Dialog } from 'radix-ui';
import {
  asQuery,
  useResource,
  type AssetRow,
  type Entry,
  type MyItems,
  type Ref,
  type Stock,
  type Transaction,
} from '../lib/api';
import {
  bidi,
  Choice,
  Field,
  Grid,
  localizedName,
  Pager,
  Picker,
  Resource,
  useDate,
  useFilters,
} from '../components/common';
import { useLanguage } from '../lib/i18n';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';

export const operations = [
  'receipt',
  'asset-issue',
  'asset-handover',
  'asset-return',
  'storage-relocation',
  'consumable-issue',
  'consumable-adjustment',
  'condition-change',
  'disposal',
] as const;
export const conditions = ['serviceable', 'malfunctioning', 'under-repair', 'lost', 'unassessed'];
export const lifecycles = ['active', 'decommissioned', 'disposed'];
export function assetOptions(data: unknown) {
  return ((data as AssetRow[] | undefined) ?? []).map((row) => ({
    ...row,
    id: row.asset.id,
    name: row.asset.name,
    code: row.asset.tag,
  }));
}

function usePage() {
  const filters = useFilters();
  return {
    ...filters,
    page: { limit: 50, offset: filters.offset },
    pager(count: number) {
      return (
        <Pager
          offset={filters.offset}
          next={count === 50}
          change={(offset) => filters.update('offset', String(offset))}
        />
      );
    },
    text(key: string, label: string, type = 'text') {
      return (
        <Field label={label}>
          <Input
            type={type}
            value={filters.get(key)}
            maxLength={200}
            onChange={(e) => filters.update(key, e.target.value)}
          />
        </Field>
      );
    },
  };
}

export function MyItemsPage() {
  const { t } = useTranslation();
  const date = useDate();
  const p = usePage();
  const query = useResource<MyItems>(asQuery('inventory/my-items', p.page), true, true);
  return (
    <section>
      <h2>{t('My Items')}</h2>
      <Resource query={query}>
        {({ linkedEmployee, items }) =>
          !linkedEmployee ? (
            <p>{t('No HR employee profile is linked to this account.')}</p>
          ) : !items.length && !p.offset ? (
            <p>{t('You have no active assignments.')}</p>
          ) : (
            <div className="inv-stack">
              <Grid
                columns={['Tag', 'Name', 'Condition', 'Room', 'Assigned on']}
                rows={items.map((row) => ({
                  id: row.id,
                  cells: [
                    bidi(row.tag),
                    bidi(row.name),
                    t(row.condition),
                    row.room ? bidi(row.room) : t('No room'),
                    date(row.assignedAt),
                  ],
                }))}
              />
              {p.pager(items.length)}
            </div>
          )
        }
      </Resource>
    </section>
  );
}

function AssetDetail({ row }: { row: AssetRow }) {
  const { t } = useTranslation();
  const dir = useLanguage((s) => (s.language === 'ar' ? 'rtl' : 'ltr'));
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <Button type="button" variant="outline">
          {t('Asset details')}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal container={document.querySelector<HTMLElement>('.faculty-inventory')}>
        <Dialog.Overlay className="inv-dialog-overlay" />
        <Dialog.Content dir={dir} className="inv-panel inv-dialog inv-stack">
          <Dialog.Title>{bidi(row.asset.name)}</Dialog.Title>
          <Dialog.Description>{bidi(row.asset.tag)}</Dialog.Description>
          <dl>
            {[
              ['Model', row.asset.model],
              ['Serial number', row.asset.serialNumber],
              ['Acquisition reference', row.asset.acquisitionReference],
              ['Notes', row.asset.notes],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{t(label!)}</dt>
                <dd>{bidi(value)}</dd>
              </div>
            ))}
          </dl>
          <Dialog.Close asChild>
            <Button type="button" variant="outline">
              {t('Close')}
            </Button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function AssetsPage() {
  const { t } = useTranslation();
  const p = usePage();
  const language = useLanguage((s) => s.language);
  const keys = ['q', 'category', 'status', 'condition', 'roomId', 'employeeId', 'sharedAccountId'];
  const query = useResource<AssetRow[]>(
    asQuery('inventory/assets', {
      ...Object.fromEntries(keys.map((key) => [key, p.get(key).trim()])),
      ...p.page,
    }),
  );
  return (
    <section className="inv-stack">
      <h2>{t('Assets')}</h2>
      <div className="inv-fields inv-panel">
        {p.text('q', 'Search')}
        {p.text('category', 'Category')}
        <Choice
          label="Lifecycle"
          value={p.get('status')}
          onChange={(value) => p.update('status', value)}
          choices={lifecycles}
          optional
        />
        <Choice
          label="Condition"
          value={p.get('condition')}
          onChange={(value) => p.update('condition', value)}
          choices={conditions}
          optional
        />
        <Picker
          label="Room"
          path="inventory/rooms"
          value={p.get('roomId')}
          onChange={(value) => p.update('roomId', value)}
        />
        <Picker
          label="Employee"
          path="inventory/employees"
          value={p.get('employeeId')}
          onChange={(value) => p.update('employeeId', value)}
        />
        <Picker
          label="Shared account"
          path="inventory/shared-accounts"
          value={p.get('sharedAccountId')}
          onChange={(value) => p.update('sharedAccountId', value)}
        />
      </div>
      <Resource query={query}>
        {(rows) => (
          <>
            <Grid
              columns={[
                'Tag',
                'Name',
                'Category',
                'Lifecycle',
                'Condition',
                'Room',
                'Responsible party',
                'Asset details',
              ]}
              rows={rows.map((row) => ({
                id: row.asset.id,
                cells: [
                  bidi(row.asset.tag),
                  bidi(row.asset.name),
                  bidi(row.asset.category),
                  t(row.asset.status),
                  t(row.asset.condition),
                  row.room ? bidi(row.room) : t('No room'),
                  row.employee ? (
                    bidi(localizedName(row.employee, language))
                  ) : row.sharedAccount ? (
                    <>
                      {t('Shared account')} · {bidi(row.sharedAccount)}
                    </>
                  ) : (
                    t('No custodian')
                  ),
                  <div className="inv-actions">
                    <AssetDetail row={row} />
                    <Link to={asQuery('/inventory/transactions', { assetId: row.asset.id })}>
                      {t('View history')}
                    </Link>
                  </div>,
                ],
              }))}
            />
            {p.pager(rows.length)}
          </>
        )}
      </Resource>
    </section>
  );
}

export function StockPage() {
  const { t } = useTranslation();
  const p = usePage();
  const lang = useLanguage((s) => s.language);
  const query = useResource<Stock[]>(
    asQuery('inventory/stock', {
      q: p.get('q').trim(),
      roomId: p.get('roomId'),
      consumableId: p.get('consumableId'),
      ...p.page,
    }),
  );
  return (
    <section className="inv-stack">
      <h2>{t('Stock')}</h2>
      <div className="inv-panel inv-fields">
        {p.text('q', 'Search')}
        <Picker
          label="Storage room"
          path="inventory/rooms"
          value={p.get('roomId')}
          onChange={(value) => p.update('roomId', value)}
        />
        <Picker
          label="Consumable"
          path="inventory/consumables"
          value={p.get('consumableId')}
          onChange={(value) => p.update('consumableId', value)}
        />
      </div>
      <Resource query={query}>
        {(rows) => (
          <>
            <Grid
              columns={['Code', 'Consumable', 'Storage room', 'Quantity', 'Unit', 'View history']}
              rows={rows.map((row) => ({
                id: row.item.id + row.roomId,
                cells: [
                  bidi(row.item.code),
                  bidi(row.item.name),
                  bidi(row.room),
                  new Intl.NumberFormat(lang).format(row.quantity),
                  t(row.item.unit ?? ''),
                  <Link to={asQuery('/inventory/transactions', { consumableId: row.item.id })}>
                    {t('View history')}
                  </Link>,
                ],
              }))}
            />
            {p.pager(rows.length)}
          </>
        )}
      </Resource>
    </section>
  );
}

export function HistoryPage({ post, dispose }: { post: boolean; dispose: boolean }) {
  const { t } = useTranslation();
  const p = usePage();
  const date = useDate();
  const keys = ['type', 'from', 'to', 'actorId', 'assetId', 'consumableId', 'reference'];
  const query = useResource<Entry[]>(
    asQuery('inventory/transactions', {
      ...Object.fromEntries(keys.map((key) => [key, p.get(key).trim()])),
      ...p.page,
    }),
  );
  return (
    <section className="inv-stack">
      <h2>{t('Transactions')}</h2>
      {(post || dispose) && (
        <div className="inv-panel">
          <h3>{t('New transaction')}</h3>
          <div className="inv-actions">
            {operations
              .filter((kind) => (kind === 'disposal' ? dispose : post))
              .map((kind) => (
                <Link key={kind} to={`/inventory/transactions/new/${kind}`}>
                  {t(kind)}
                </Link>
              ))}
          </div>
        </div>
      )}
      <div className="inv-panel inv-fields">
        <Choice
          label="Type"
          value={p.get('type')}
          onChange={(value) => p.update('type', value)}
          choices={[...operations, 'committee-decision', 'asset-registration', 'custody-change']}
          optional
        />
        {p.text('from', 'From', 'date')}
        {p.text('to', 'To', 'date')}
        {p.text('actorId', 'Actor ID')}
        {p.text('reference', 'Reference')}
        <Picker
          label="Asset"
          path="inventory/assets"
          normalize={assetOptions}
          value={p.get('assetId')}
          onChange={(value) => p.update('assetId', value)}
        />
        <Picker
          label="Consumable"
          path="inventory/consumables"
          value={p.get('consumableId')}
          onChange={(value) => p.update('consumableId', value)}
        />
      </div>
      <Resource query={query}>
        {(rows) => (
          <>
            <Grid
              columns={['Type', 'Name', 'Event date', 'Reference', 'Recorded by']}
              rows={rows.map((row) => ({
                id: row.id,
                cells: [
                  t(row.type),
                  <Link to={`/inventory/transactions/${row.id}`}>{bidi(row.name)}</Link>,
                  date(row.eventDate, true),
                  bidi(row.reference),
                  <button
                    className="inv:underline"
                    type="button"
                    onClick={() => p.update('actorId', row.actorId)}
                  >
                    {bidi(row.actorName ?? row.actorId)}
                  </button>,
                ],
              }))}
            />
            {p.pager(rows.length)}
          </>
        )}
      </Resource>
    </section>
  );
}

export function TransactionPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const date = useDate();
  const lang = useLanguage((s) => s.language);
  const query = useResource<Transaction>(`inventory/transactions/${id}`, !!id);
  return (
    <Resource query={query}>
      {(row) => {
        const name = (list: Ref[], id: string | null) =>
          id ? (list.find((entry) => entry.id === id)?.name ?? id) : '—';
        const employee = (id: string | null) =>
          id
            ? (localizedName(
                row.labels.employees.find((entry) => entry.id === id),
                lang,
              ) ?? id)
            : '—';
        const snapshot = (value: Transaction['items'][number]['before']) =>
          value && (
            <div className="inv-stack">
              <span>
                {t(value.status)} · {t(value.condition)}
              </span>
              <span>
                {t('Room')} · {bidi(name(row.labels.rooms, value.roomId))}
              </span>
              <span>
                {t('Responsible party')} ·{' '}
                {bidi(
                  value.employeeId
                    ? employee(value.employeeId)
                    : name(row.labels.sharedAccounts, value.sharedAccountId),
                )}
              </span>
            </div>
          );
        return (
          <section className="inv-stack">
            <h2>{bidi(row.name)}</h2>
            <dl className="inv-fields inv-panel">
              {[
                ['Type', t(row.type)],
                ['Reference', bidi(row.reference)],
                ['Event date', date(row.eventDate, true)],
                ['Recorded at', date(row.recordedAt)],
                ['Recorded by', bidi(row.actorName ?? row.actorId)],
                [
                  'Source',
                  row.source ? t(row.source) : bidi(name(row.labels.rooms, row.sourceRoomId)),
                ],
                ['Destination', bidi(name(row.labels.rooms, row.destinationRoomId))],
                ['Recipient', bidi(employee(row.recipientEmployeeId))],
                ['Notes', bidi(row.notes)],
              ].map(([label, value], index) => (
                <div key={index}>
                  <dt>{t(String(label))}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            <Grid
              columns={[
                'Asset',
                'Consumable',
                'Quantity',
                'Unit',
                'Before',
                'After',
                'Outcome',
                'Reason',
              ]}
              rows={row.items.map((item) => ({
                id: String(item.line),
                cells: [
                  bidi([item.assetTag, item.assetName].filter(Boolean).join(' · ') || null),
                  bidi([item.itemCode, item.itemName].filter(Boolean).join(' · ') || null),
                  item.quantity === null ? '—' : new Intl.NumberFormat(lang).format(item.quantity),
                  item.unit ? t(item.unit) : '—',
                  snapshot(item.before) ?? '—',
                  snapshot(item.after) ?? '—',
                  item.outcome ? t(item.outcome) : '—',
                  bidi(item.reason),
                ],
              }))}
            />
          </section>
        );
      }}
    </Resource>
  );
}
