import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import type { UseQueryResult } from '@tanstack/react-query';
import { createButton, createInput } from '@/components/ui/form-primitives';
import type {
  PromotionGrant,
  StudentAffairsCapabilities,
  StudentSummary,
} from '@project/contracts/student-affairs';
import { ApiError } from './api';
import { arabic, useLanguage, type Label } from './language';

const merge = (...classes: (string | undefined)[]) => classes.filter(Boolean).join(' ');
export const Button = createButton(merge);
export const Input = createInput(merge);
export const years = [1, 2, 3, 4, 5];
export const canWriteYear = (access: StudentAffairsCapabilities, year: number | null) =>
  access.administer || (year !== null && access.assignedStudyYears.includes(year));
export const studentName = (student: StudentSummary) =>
  [student.firstName, student.fatherName, student.lastName].filter(Boolean).join(' ') ||
  student.academicId;
export const grantState = (grant: PromotionGrant, now: number): Label =>
  grant.revokedAt ? 'Revoked' : Date.parse(grant.expiresAt) <= now ? 'Expired' : 'Active';

export function useGrantClock(expiry: string | undefined) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const update = () => setNow(Date.now());
    if (!expiry) return;
    const delay = Date.parse(expiry) - Date.now();
    const timer = delay > 0 ? window.setTimeout(update, Math.min(delay, 2_147_483_647)) : undefined;
    window.addEventListener('focus', update);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('focus', update);
    };
  }, [expiry, now]);
  return Math.max(now, Date.now());
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="sta-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function YearOptions({ choices = years }: { choices?: number[] }) {
  const { year } = useLanguage();
  return (
    <>
      {choices.map((value) => (
        <option value={value} key={value}>
          {year(value)}
        </option>
      ))}
    </>
  );
}

export function ActionLink({
  to,
  children,
  primary = false,
}: {
  to: string;
  children: ReactNode;
  primary?: boolean;
}) {
  return (
    <Button asChild variant={primary ? 'default' : 'outline'}>
      <Link to={to}>{children}</Link>
    </Button>
  );
}

export function ErrorMessage({ error }: { error: Error | null }) {
  const { t } = useLanguage();
  if (!error) return null;
  let label: Label = 'Unable to reach the server.';
  if (error instanceof ApiError) {
    label = Object.hasOwn(arabic, error.message)
      ? (error.message as Label)
      : ((
          {
            400: 'Review the form and try again.',
            403: 'Access denied',
            404: 'Record not found.',
            409: 'A conflicting record already exists.',
          } as Record<number, Label>
        )[error.status] ?? 'Unable to complete the request.');
  }
  return (
    <p className="sta-error" role="alert">
      {t(label)}
    </p>
  );
}

export function Resource<T>({
  query,
  children,
}: {
  query: UseQueryResult<T>;
  children: (data: T) => ReactNode;
}) {
  const { t } = useLanguage();
  if (query.isError)
    return (
      <>
        <ErrorMessage error={query.error} />
        <Button type="button" variant="outline" onClick={() => void query.refetch()}>
          {t('Retry')}
        </Button>
      </>
    );
  if (query.data === undefined) return <p role="status">{t('Loading…')}</p>;
  return children(query.data);
}
