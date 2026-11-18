import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi, ApiError } from '../lib/api';
import type { Session } from '../lib/types';
import { useLanguage } from '../lib/language-context';

export function AuthGate({ children }: { children: ReactNode }) {
  const { t } = useLanguage();
  const client = useQueryClient();
  const previousIdentity = useRef<string | undefined>(undefined);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [validation, setValidation] = useState('');
  const [notice, setNotice] = useState('');
  const session = useQuery({
    queryKey: ['facilities', 'session'],
    queryFn: async ({ signal }) => {
      const next = await authApi<Session>('auth/get-session', 'GET', undefined, signal);
      const identity = next?.user
        ? `${next.user.id}:${next.user.approved}:${next.user.enabled}:${next.user.mustChangePassword}`
        : undefined;
      if (identity !== previousIdentity.current) {
        await client.cancelQueries({ predicate: (query) => query.queryKey[1] !== 'session' });
        client.removeQueries({ predicate: (query) => query.queryKey[1] !== 'session' });
        previousIdentity.current = identity;
      }
      return next;
    },
    refetchInterval: 30000,
    staleTime: 0,
    retry: false,
  });
  const resetSession = async () => {
    await client.cancelQueries();
    client.clear();
    setPassword('');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    await session.refetch();
  };
  const signIn = useMutation({
    mutationFn: () =>
      authApi('auth/sign-in/username', 'POST', { username: username.trim(), password }),
    onSuccess: resetSession,
  });
  const signOut = useMutation({
    mutationFn: () => authApi('auth/sign-out', 'POST', {}),
    onSuccess: resetSession,
  });
  const changePassword = useMutation({
    mutationFn: () => authApi('admin/change-password', 'POST', { currentPassword, newPassword }),
    onSuccess: async () => {
      setNotice('Sign in again with your new password.');
      await resetSession();
    },
  });
  const handleSignIn = (event: FormEvent) => {
    event.preventDefault();
    setValidation('');
    signIn.mutate();
  };
  const handleChangePassword = (event: FormEvent) => {
    event.preventDefault();
    if (newPassword.length < 12 || newPassword.length > 128) {
      setValidation('Use 12–128 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setValidation('Passwords do not match.');
      return;
    }
    setValidation('');
    changePassword.mutate();
  };
  const failure = (error: Error | null) => {
    if (!error) return null;
    const message =
      error instanceof ApiError && error.status === 401 && signIn.isError
        ? 'Invalid username or password.'
        : error.message;
    return (
      <p className="fac-error" role="alert">
        {t(message)}
      </p>
    );
  };

  if (session.isPending) return <p role="status">{t('Loading…')}</p>;
  if (session.error) {
    return (
      <div className="fac-card fac-stack" role="alert">
        <p>{t(session.error.message)}</p>
        <button className="fac-button fac-button--secondary" onClick={() => void session.refetch()}>
          {t('Retry')}
        </button>
      </div>
    );
  }
  const current = session.data?.user;
  if (!current) {
    return (
      <div className="fac-auth fac-card">
        <h2>{t('Sign in')}</h2>
        <p className="fac-muted">{t('Use the account provided by your administrator.')}</p>
        {notice && <p role="status">{t(notice)}</p>}
        <form className="fac-form" onSubmit={handleSignIn}>
          <label className="fac-field">
            <span>{t('Username')}</span>
            <input
              autoComplete="username"
              required
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
          </label>
          <label className="fac-field">
            <span>{t('Password')}</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <button className="fac-button" disabled={signIn.isPending}>
            {t(signIn.isPending ? 'Loading…' : 'Sign in')}
          </button>
          {failure(signIn.error)}
        </form>
      </div>
    );
  }

  return (
    <>
      <div className="fac-session">
        <span dir="auto">{current.username || current.name}</span>
        <button
          className="fac-button fac-button--secondary"
          disabled={signOut.isPending}
          onClick={() => signOut.mutate()}
        >
          {t('Sign out')}
        </button>
      </div>
      {failure(signOut.error)}
      {!current.enabled ? (
        <div className="fac-card fac-stack">
          <h2>{t('Your account is disabled.')}</h2>
          <p>{t('Contact your administrator.')}</p>
        </div>
      ) : current.mustChangePassword ? (
        <form className="fac-auth fac-card fac-form" onSubmit={handleChangePassword}>
          <h2>{t('Change password')}</h2>
          <p className="fac-muted">{t('Use 12–128 characters.')}</p>
          <label className="fac-field">
            <span>{t('Current password')}</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
            />
          </label>
          <label className="fac-field">
            <span>{t('New password')}</span>
            <input
              type="password"
              autoComplete="new-password"
              required
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
          </label>
          <label className="fac-field">
            <span>{t('Confirm password')}</span>
            <input
              type="password"
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </label>
          <button className="fac-button" disabled={changePassword.isPending}>
            {t(changePassword.isPending ? 'Loading…' : 'Change password')}
          </button>
          {validation && (
            <p className="fac-error" role="alert">
              {t(validation)}
            </p>
          )}
          {failure(changePassword.error)}
        </form>
      ) : !current.approved ? (
        <div className="fac-card fac-stack">
          <h2>{t('Awaiting approval')}</h2>
          <p>{t('Contact your administrator.')}</p>
          <button
            className="fac-button fac-button--secondary"
            onClick={() => void session.refetch()}
          >
            {t('Check again')}
          </button>
        </div>
      ) : (
        children
      )}
    </>
  );
}
