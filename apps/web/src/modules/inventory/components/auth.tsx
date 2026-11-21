import { useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  ModuleSessionControls,
  type RenderModuleHeader,
} from '../../../components/ModuleDirectoryLink';
import { api, ApiError, type Session } from '../lib/api';
import { ErrorMessage, Field, Resource } from './common';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';

export function Auth({
  children,
  renderHeader,
}: {
  children: ReactNode;
  renderHeader: RenderModuleHeader;
}) {
  const { t } = useTranslation();
  const signInFormId = useId();
  const client = useQueryClient();
  const previous = useRef<string | undefined>(undefined);
  const [notice, setNotice] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const session = useQuery({
    queryKey: ['session'],
    queryFn: async ({ signal }) => {
      const current = await api<Session>('auth/get-session', { signal });
      const user = current?.user;
      const identity = user
        ? [user.id, user.approved, user.enabled, user.mustChangePassword].join(':')
        : undefined;
      if (identity !== previous.current) {
        await client.cancelQueries({ queryKey: ['inventory'] });
        client.removeQueries({ queryKey: ['inventory'] });
        previous.current = identity;
      }
      return current;
    },
    staleTime: 0,
    refetchInterval: 30000,
    retry: false,
  });
  const write = useMutation({
    mutationFn: ({ path, body }: { path: string; body: unknown }) => api(path, { body }),
    onSuccess: async (_, { path }) => {
      setInvalid(false);
      setNotice(path === 'admin/change-password');
      await client.cancelQueries({ queryKey: ['inventory'] });
      client.removeQueries({ queryKey: ['inventory'] });
      if (path !== 'auth/sign-in/username') client.setQueryData(['session'], null);
      await session.refetch();
    },
  });
  const submit = (event: FormEvent<HTMLFormElement>, change = false) => {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const password = String(fields.get('password') ?? '');
    if (
      change &&
      (password !== fields.get('confirm') || password.length < 12 || password.length > 128)
    ) {
      setInvalid(true);
      return;
    }
    write.mutate(
      change
        ? {
            path: 'admin/change-password',
            body: { currentPassword: fields.get('current'), newPassword: password },
          }
        : {
            path: 'auth/sign-in/username',
            body: { username: String(fields.get('username')).trim(), password },
          },
    );
  };
  const user = session.data?.user;
  const sessionControls = user ? (
    <ModuleSessionControls username={user.username || user.name}>
      <Button
        type="button"
        variant="outline"
        disabled={write.isPending}
        onClick={() => write.mutate({ path: 'auth/sign-out', body: {} })}
      >
        {t('Sign out')}
      </Button>
    </ModuleSessionControls>
  ) : (
    <Button type="submit" form={signInFormId} disabled={write.isPending}>
      {t(write.isPending ? 'Loading…' : 'Sign in')}
    </Button>
  );
  return (
    <>
      {renderHeader(session.isSuccess ? sessionControls : null)}
      <Resource query={session}>
        {(record) => {
          const user = record?.user;
          if (!user)
            return (
              <Card className="module-auth">
                <CardContent>
                  <h2>{t('Sign in')}</h2>
                  {notice && <p role="status">{t('Sign in again with your new password.')}</p>}
                  <form id={signInFormId} onSubmit={submit} className="inv-stack">
                    <Field label="Username">
                      <Input name="username" required autoComplete="username" />
                    </Field>
                    <Field label="Password">
                      <Input
                        name="password"
                        type="password"
                        required
                        autoComplete="current-password"
                      />
                    </Field>
                    {write.variables?.path === 'auth/sign-in/username' &&
                      (write.error instanceof ApiError &&
                      write.error.status >= 400 &&
                      write.error.status < 500 ? (
                        <p role="alert">{t('Invalid username or password.')}</p>
                      ) : (
                        <ErrorMessage error={write.error} />
                      ))}
                  </form>
                </CardContent>
              </Card>
            );

          return (
            <div key={user.id} className="inv-stack">
              <ErrorMessage error={write.error} />
              {!user.enabled ? (
                <p role="alert">{t('Account disabled')}</p>
              ) : user.mustChangePassword ? (
                <form className="inv-stack module-auth" onSubmit={(event) => submit(event, true)}>
                  <h2>{t('Change password')}</h2>
                  <Field label="Current password">
                    <Input
                      name="current"
                      type="password"
                      autoComplete="current-password"
                      required
                    />
                  </Field>
                  <Field label="New password">
                    <Input name="password" type="password" autoComplete="new-password" required />
                  </Field>
                  <Field label="Confirm password">
                    <Input name="confirm" type="password" autoComplete="new-password" required />
                  </Field>
                  {invalid && (
                    <p role="alert">{t('Passwords must match and contain 12–128 characters.')}</p>
                  )}
                  <Button disabled={write.isPending}>{t('Change password')}</Button>
                </form>
              ) : !user.approved ? (
                <div className="inv-actions">
                  <p>{t('Awaiting approval')}</p>
                  <Button onClick={() => void session.refetch()}>{t('Check again')}</Button>
                </div>
              ) : (
                children
              )}
            </div>
          );
        }}
      </Resource>
    </>
  );
}
