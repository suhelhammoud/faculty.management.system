import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { ApiError, asQuery, useResource, type Ref } from '../lib/api';
import { useLanguage } from '../lib/i18n';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { NativeSelect } from './ui/native-select';

const messages = new Set([
  'Asset changed since it was loaded',
  'Insufficient stock',
  'Asset tag already exists',
  'Storage location is unavailable',
  'Consumable code already exists',
  'Shared account name already exists',
  'Asset is no longer at the source room',
  'Asset custody no longer matches the source',
  'Storage locations must differ',
  'Only decommissioned assets can be disposed',
  'A committee approval is required before physical disposal',
  'This task is no longer pending',
  'Action is unavailable',
  'Enter a reason for returning the request',
]);
export function ErrorMessage({ error, retry }: { error: unknown; retry?: () => void }) {
  const { t } = useTranslation();
  if (!error) return null;
  let message = 'Request failed';
  if (error instanceof ApiError) {
    message =
      error.status === 0
        ? 'Unable to reach the server.'
        : error.message.includes('changed during review')
          ? 'An asset changed during review. Return the proposal for revision.'
          : messages.has(error.message)
            ? error.message
            : ((
                {
                  400: 'Check the form values and try again.',
                  401: 'Sign in',
                  403: 'Access denied',
                  404: 'Record not found',
                  409: 'The data changed. Review the latest values and try again.',
                } as Record<number, string>
              )[error.status] ?? message);
  }
  return (
    <div role="alert">
      {t(message)}{' '}
      {retry && (
        <Button type="button" variant="outline" onClick={retry}>
          {t('Retry')}
        </Button>
      )}
    </div>
  );
}
export function Resource<T>({
  query,
  children,
}: {
  query: { data?: T; error: unknown; isPending: boolean; refetch: () => unknown };
  children: (data: T) => ReactNode;
}) {
  const { t } = useTranslation();
  if (query.error) return <ErrorMessage error={query.error} retry={() => void query.refetch()} />;
  return query.isPending || query.data === undefined ? (
    <p role="status">{t('Loading…')}</p>
  ) : (
    children(query.data)
  );
}
export function Field({ label, children }: { label: string; children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <label className="inv-field">
      <span>{t(label)}</span>
      {children}
    </label>
  );
}
export function Choice({
  label,
  value,
  onChange,
  choices,
  optional = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  choices: readonly string[];
  optional?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <Field label={label}>
      <NativeSelect value={value} required={!optional} onChange={(e) => onChange(e.target.value)}>
        <option value="">{t(optional ? 'All' : 'Select an option')}</option>
        {choices.map((key) => (
          <option key={key} value={key}>
            {t(key)}
          </option>
        ))}
      </NativeSelect>
    </Field>
  );
}
export function localizedName(
  person: { name?: string; nameEn?: string | null; nameAr?: string | null } | null | undefined,
  language: string,
) {
  return (
    (language === 'ar' ? person?.nameAr || person?.nameEn : person?.nameEn || person?.nameAr) ||
    person?.name
  );
}
export function Picker<T extends Ref>({
  label,
  path,
  value,
  onChange,
  required = false,
  filter,
  normalize,
}: {
  label: string;
  path: string;
  value: string;
  onChange: (id: string, record?: T) => void;
  required?: boolean;
  filter?: (item: T) => boolean;
  normalize?: (items: unknown) => T[];
}) {
  const { t } = useTranslation();
  const language = useLanguage((s) => s.language);
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<T>();
  const query = useResource<unknown>(asQuery(path, { q: search.trim(), limit: 50, offset }));
  const items = normalize ? normalize(query.data) : ((query.data as T[] | undefined) ?? []);
  const choices = items.filter((item) => !filter || filter(item));
  return (
    <div className="inv-picker">
      <Field label={label}>
        <NativeSelect
          aria-label={t(label)}
          value={value}
          required={required}
          onChange={(event) => {
            const item = choices.find(({ id }) => id === event.target.value);
            setSelected(item);
            onChange(event.target.value, item);
          }}
        >
          <option value="">{t('Select an option')}</option>
          {value && !choices.some(({ id }) => id === value) && (
            <option value={value}>
              {selected?.id === value ? localizedName(selected, language) : value}
            </option>
          )}
          {choices.map((item) => (
            <option key={item.id} value={item.id}>
              {item.code || item.number ? `${item.code || item.number} · ` : ''}
              {localizedName(item, language)}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Input
        aria-label={`${t('Search')} · ${t(label)}`}
        placeholder={t('Search')}
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setOffset(0);
        }}
      />
      {query.isPending && <small role="status">{t('Loading…')}</small>}
      <ErrorMessage error={query.error} retry={() => void query.refetch()} />
      {(offset > 0 || items.length === 50) && (
        <Pager offset={offset} next={items.length === 50} change={setOffset} />
      )}
    </div>
  );
}
export const pageSize = 50;
export function useFilters() {
  const [params, setParams] = useSearchParams();
  const raw = Number(params.get('offset'));
  const offset = Number.isSafeInteger(raw) && raw > 0 && raw <= 2147483647 ? raw : 0;
  const update = (key: string, value: string) =>
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (key !== 'offset') next.delete('offset');
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: key !== 'offset' },
    );
  return { offset, get: (key: string) => params.get(key) ?? '', update };
}
export function Pager({
  offset,
  next,
  change,
}: {
  offset: number;
  next: boolean;
  change: (value: number) => void;
}) {
  const { t } = useTranslation();
  return (
    <nav
      className="inv-actions"
      aria-label={t('Page {{number}}', { number: Math.floor(offset / pageSize) + 1 })}
    >
      <Button
        type="button"
        variant="outline"
        disabled={!offset}
        onClick={() => change(Math.max(0, offset - pageSize))}
      >
        {t('Previous')}
      </Button>
      <span>{t('Page {{number}}', { number: Math.floor(offset / pageSize) + 1 })}</span>
      <Button
        type="button"
        variant="outline"
        disabled={!next}
        onClick={() => change(offset + pageSize)}
      >
        {t('Next')}
      </Button>
    </nav>
  );
}
export function Grid({
  columns,
  rows,
}: {
  columns: string[];
  rows: { id: string; cells: ReactNode[] }[];
}) {
  const { t } = useTranslation();
  if (!rows.length) return <p role="status">{t('No results')}</p>;
  return (
    <div className="inv-table">
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column} scope="col">
                {t(column)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ id, cells }) => (
            <tr key={id}>
              {cells.map((cell, index) => (
                <td key={index}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export const bidi = (value: ReactNode) => <bdi>{value ?? '—'}</bdi>;
export function useDate() {
  const lang = useLanguage((s) => s.language);
  return (date: string, dateOnly = false) =>
    new Intl.DateTimeFormat(lang, {
      dateStyle: 'medium',
      ...(dateOnly ? { timeZone: 'UTC' } : { timeStyle: 'short' }),
    }).format(new Date(date));
}
