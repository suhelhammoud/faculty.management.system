import { DateInput } from '@/components/ui/date-input';
import { useId, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, AlertDescription } from './ui/alert';
import { Skeleton } from './ui/skeleton';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { NativeSelect, NativeSelectOption } from './ui/native-select';
import { useUi } from '../lib/store';
import { referenceId, referenceName, type Kind, type Reference } from '../lib/types';
export function ErrorMessage({ error, retry }: { error?: Error | null; retry?: () => void }) {
  const { t } = useTranslation();
  if (!error) return null;
  return (
    <Alert variant="destructive" role="alert">
      <AlertDescription>
        {t(error.message)}
        {retry && (
          <Button type="button" variant="outline" onClick={retry}>
            {t('Retry')}
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
export function Loading() {
  const { t } = useTranslation();
  return (
    <div role="status" aria-label={t('Loading…')}>
      <p>{t('Loading…')}</p>
      <Skeleton className="hr:h-12 hr:w-full" />
    </div>
  );
}
export function Success({ show }: { show: boolean }) {
  const { t } = useTranslation();
  return show ? (
    <p role="status" className="module-success">
      {t('Saved successfully.')}
    </p>
  ) : null;
}
export function Field({
  name,
  value,
  onChange,
  error,
  required = false,
  type = 'text',
  textarea = false,
  min,
  max,
  autoComplete,
}: {
  name: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
  type?: string;
  textarea?: boolean;
  min?: number;
  max?: number;
  autoComplete?: string;
}) {
  const { t } = useTranslation();
  const id = useId();
  const direction = /Ar$/.test(name)
    ? 'rtl'
    : /En$/.test(name) ||
        [
          'email',
          'employeeNumber',
          'phoneNumber',
          'mobileNumber',
          'emergencyContactPhone',
          'civilRegistryNumber',
          'code',
          'username',
        ].includes(name) ||
        type === 'password'
      ? 'ltr'
      : undefined;
  const attributes = {
    id,
    name,
    value,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange(e.target.value),
    required,
    dir: direction,
    'aria-invalid': !!error,
    'aria-describedby': error ? `${id}-error` : undefined,
    maxLength: name === 'notes' ? 10000 : type === 'password' ? 128 : 1000,
    autoComplete,
  };
  return (
    <div className="hr-field">
      <Label htmlFor={id}>
        {t(name)}
        {required && <span aria-hidden="true"> *</span>}
      </Label>
      {textarea ? (
        <Textarea {...attributes} />
      ) : type === 'date' ? (
        <DateInput
          {...attributes}
          className="hr:h-9 hr:w-full hr:rounded-md hr:border hr:border-input hr:bg-transparent hr:px-3 hr:py-1 hr:text-base hr:shadow-xs hr:outline-none hr:focus-visible:border-ring hr:focus-visible:ring-2 hr:aria-invalid:border-destructive"
          onValueChange={onChange}
        />
      ) : (
        <Input
          {...attributes}
          type={type}
          min={min}
          max={max}
          step={type === 'number' ? 1 : undefined}
        />
      )}
      {error && (
        <p id={`${id}-error`} className="hr-field-error">
          {t(error)}
        </p>
      )}
    </div>
  );
}
export function SelectField({
  name,
  value,
  onChange,
  children,
  required = false,
  error,
  placeholder = 'Select…',
}: {
  name: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  required?: boolean;
  error?: string;
  placeholder?: string;
}) {
  const { t } = useTranslation();
  const id = useId();
  return (
    <div className="hr-field">
      <Label htmlFor={id}>
        {t(name)}
        {required && <span aria-hidden="true"> *</span>}
      </Label>
      <NativeSelect
        id={id}
        name={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
      >
        <NativeSelectOption value="">{t(placeholder)}</NativeSelectOption>
        {children}
      </NativeSelect>
      {error && (
        <p id={`${id}-error`} className="hr-field-error">
          {t(error)}
        </p>
      )}
    </div>
  );
}
export function ReferenceSelect({
  kind,
  rows = [],
  ...props
}: {
  kind: Kind;
  rows?: Reference[];
  name: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  error?: string;
  placeholder?: string;
}) {
  const language = useUi((state) => state.language);
  return (
    <SelectField {...props}>
      {rows.map((row) => (
        <NativeSelectOption key={referenceId(kind, row)} value={referenceId(kind, row)}>
          {referenceName(row, language)}
        </NativeSelectOption>
      ))}
    </SelectField>
  );
}
