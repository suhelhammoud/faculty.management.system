import { useId, useRef, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  ModuleSessionControls,
  type RenderModuleHeader,
} from '../../../components/ModuleDirectoryLink';
import { api } from '../lib/api';
import type { Session } from '../lib/types';
import { Field, ErrorMessage, Loading } from './common';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

export function AuthGate({
  children,
  renderHeader,
}: {
  children: ReactNode;
  renderHeader: RenderModuleHeader;
}) {
  const { t } = useTranslation();
  const signInFormId = useId();
  const client = useQueryClient();
  const previousUser = useRef<string | undefined>(undefined);
  const session = useQuery({
    queryKey: ['hr', 'session'],
    queryFn: async ({ signal }) => {
      const next = await api<Session>('auth/get-session', 'GET', undefined, signal);
      const identity = next?.user
        ? `${next.user.id}:${next.user.approved}:${next.user.enabled}:${next.user.mustChangePassword}`
        : undefined;
      if (identity !== previousUser.current) {
        await client.cancelQueries({ predicate: (q) => q.queryKey[1] !== 'session' });
        client.removeQueries({ predicate: (q) => q.queryKey[1] !== 'session' });
        previousUser.current = identity;
      }
      return next;
    },
    refetchInterval: 30000,
    staleTime: 0,
    retry: false,
  });
  const [values, setValues] = useState<Record<string, string>>({});
  const [validation, setValidation] = useState('');
  const [notice, setNotice] = useState('');
  const current = session.data?.user;
  const reset = async () => {
    await client.cancelQueries();
    client.clear();
    setValues({});
    setValidation('');
    await session.refetch();
  };
  const login = useMutation({
    mutationFn: () =>
      api('auth/sign-in/username', 'POST', {
        username: values.username?.trim(),
        password: values.Password,
      }),
    onSuccess: reset,
  });
  const logout = useMutation({
    mutationFn: () => api('auth/sign-out', 'POST', {}),
    onSuccess: reset,
  });
  const change = useMutation({
    mutationFn: () =>
      api('admin/change-password', 'POST', {
        currentPassword: values['Current password'],
        newPassword: values['New password'],
      }),
    onSuccess: async () => {
      setNotice('Sign in again with your new password.');
      await reset();
    },
  });
  const update = (name: string) => (value: string) => {
    setValues((previous) => ({ ...previous, [name]: value }));
    setValidation('');
  };
  if (session.isPending)
    return (
      <>
        {renderHeader(null)}
        <Loading />
      </>
    );
  if (session.error)
    return (
      <>
        {renderHeader(null)}
        <ErrorMessage error={session.error} retry={() => void session.refetch()} />
      </>
    );
  if (!current)
    return (
      <>
        {renderHeader(
          <Button type="submit" form={signInFormId} disabled={login.isPending}>
            {t(login.isPending ? 'Loading…' : 'Sign in')}
          </Button>,
        )}
        <Card className="module-auth">
          <CardHeader>
            <CardTitle>{t('Sign in')}</CardTitle>
            <p>{t('Use the account provided by your administrator.')}</p>
          </CardHeader>
          <CardContent>
            {notice && <p role="status">{t(notice)}</p>}
            <form
              id={signInFormId}
              onSubmit={(event) => {
                event.preventDefault();
                login.mutate();
              }}
              className="hr-stack"
            >
              <fieldset disabled={login.isPending} className="hr-stack">
                <div className="hr-form-fields">
                  <Field
                    name="Username"
                    value={values.username || ''}
                    onChange={update('username')}
                    required
                    autoComplete="username"
                  />
                  <Field
                    name="Password"
                    type="password"
                    value={values.Password || ''}
                    onChange={update('Password')}
                    required
                    autoComplete="current-password"
                  />
                </div>
              </fieldset>
              <ErrorMessage error={login.error} />
              <p className="hr-muted">{t('Forgot your password? Contact your administrator.')}</p>
            </form>
          </CardContent>
        </Card>
      </>
    );
  return (
    <>
      {renderHeader(
        <ModuleSessionControls username={current.username || current.name}>
          <Button
            type="button"
            variant="outline"
            disabled={logout.isPending}
            onClick={() => logout.mutate()}
          >
            {t('Sign out')}
          </Button>
        </ModuleSessionControls>,
      )}
      <ErrorMessage error={logout.error} />
      {!current.enabled ? (
        <Card>
          <CardContent>
            <p>{t('Your account is disabled.')}</p>
            <p>{t('Contact your administrator.')}</p>
          </CardContent>
        </Card>
      ) : current.mustChangePassword ? (
        <Card className="module-auth">
          <CardHeader>
            <CardTitle>{t('Change password')}</CardTitle>
            <p>{t('Change your temporary password to continue.')}</p>
          </CardHeader>
          <CardContent>
            <form
              className="hr-stack"
              onSubmit={(event) => {
                event.preventDefault();
                if ((values['New password']?.length || 0) < 12) {
                  setValidation('Use 12–128 characters.');
                  return;
                }
                if (values['New password'] !== values['Confirm password']) {
                  setValidation('Passwords do not match.');
                  return;
                }
                change.mutate();
              }}
            >
              <fieldset disabled={change.isPending} className="hr-stack">
                <div className="hr-form-fields">
                  {['Current password', 'New password', 'Confirm password'].map((name) => (
                    <Field
                      key={name}
                      name={name}
                      type="password"
                      required
                      value={values[name] || ''}
                      onChange={update(name)}
                      autoComplete={
                        name === 'Current password' ? 'current-password' : 'new-password'
                      }
                    />
                  ))}
                </div>
                <p className="hr-muted">{t('Use 12–128 characters.')}</p>
                <Button>{t(change.isPending ? 'Saving…' : 'Change password')}</Button>
              </fieldset>
              {validation && <p role="alert">{t(validation)}</p>}
              <ErrorMessage error={change.error} />
            </form>
          </CardContent>
        </Card>
      ) : !current.approved ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('Awaiting approval')}</CardTitle>
          </CardHeader>
          <CardContent className="hr-stack">
            <p>{t('Contact your administrator.')}</p>
            <Button onClick={() => void session.refetch()}>{t('Check again')}</Button>
          </CardContent>
        </Card>
      ) : (
        children
      )}
    </>
  );
}
