import { useFacultyLanguage } from '@/components/language-preference';
import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { QueryClientProvider, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Navigate, NavLink, Route, Routes } from 'react-router';
import { ModuleHeaderActions, ModuleSessionControls } from '@/components/ModuleDirectoryLink';
import type { StudentAffairsCapabilities } from '@project/contracts/student-affairs';
import { ApiError, clearData, createClient, request, root, sessionKey, useRead } from './api';
import { Button, ErrorMessage, Field, Input, Resource } from './common';
import { LanguageContext, useLanguage } from './language';
import { Registry, StudentRoute, NewStudent } from './students';
import { Grants, StaffAssignments } from './management';
import './student-affairs.css';

type Session = {
  user: {
    id: string;
    name: string;
    username?: string;
    approved: boolean;
    enabled: boolean;
    mustChangePassword: boolean;
  };
} | null;

function Workspace() {
  const { t } = useLanguage();
  const query = useRead<StudentAffairsCapabilities>('capabilities', 30_000);
  const denied = <p role="alert">{t('Access denied')}</p>;
  return (
    <Resource query={query}>
      {(access) => (
        <>
          <nav className="module-navigation" aria-label={t('Student Affairs')}>
            {access.read && <NavLink to={`${root}/students`}>{t('Students')}</NavLink>}
            {access.administer && (
              <NavLink to={`${root}/staff-year-assignments`}>{t('Staff assignments')}</NavLink>
            )}
            {access.grantPromotions && (
              <NavLink to={`${root}/promotion-grants`}>{t('Promotion grants')}</NavLink>
            )}
          </nav>
          <Routes>
            <Route
              index
              element={
                access.read ? (
                  <Navigate to="students" replace />
                ) : access.grantPromotions ? (
                  <Navigate to="promotion-grants" replace />
                ) : access.administer ? (
                  <Navigate to="staff-year-assignments" replace />
                ) : (
                  denied
                )
              }
            />
            <Route path="students" element={access.read ? <Registry access={access} /> : denied} />
            <Route
              path="students/new"
              element={
                access.read && (access.administer || access.assignedStudyYears.length) ? (
                  <NewStudent access={access} />
                ) : (
                  denied
                )
              }
            />
            <Route
              path="students/:studentId"
              element={access.read ? <StudentRoute access={access} view="profile" /> : denied}
            />
            <Route
              path="students/:studentId/edit"
              element={access.read ? <StudentRoute access={access} view="edit" /> : denied}
            />
            <Route
              path="students/:studentId/academic-years"
              element={access.read ? <StudentRoute access={access} view="annual" /> : denied}
            />
            <Route
              path="staff-year-assignments"
              element={access.administer ? <StaffAssignments /> : denied}
            />
            <Route path="promotion-grants" element={access.grantPromotions ? <Grants /> : denied} />
            <Route path="*" element={<p role="alert">{t('Page not found')}</p>} />
          </Routes>
        </>
      )}
    </Resource>
  );
}

function Shell({
  switchLanguage,
  title,
  children,
}: {
  switchLanguage: () => void;
  title: 'Student Affairs' | 'Department';
  children: ReactNode;
}) {
  const { language, t } = useLanguage();
  const client = useQueryClient();
  const previous = useRef<string | undefined>(undefined);
  const [passwordError, setPasswordError] = useState(false);
  const [changed, setChanged] = useState(false);
  const session = useQuery({
    queryKey: sessionKey,
    queryFn: async ({ signal }) => {
      const next = await request<Session>('auth/get-session', 'GET', undefined, signal);
      const user = next?.user;
      const identity =
        user && [user.id, user.approved, user.enabled, user.mustChangePassword].join(':');
      if (identity !== previous.current) {
        await clearData(client);
        previous.current = identity;
      }
      return next;
    },
    refetchInterval: 30_000,
  });
  const auth = useMutation({
    mutationFn: ({ path, body }: { path: string; body: object }) => request(path, 'POST', body),
    onSuccess: async (_, { path }) => {
      await clearData(client);
      setPasswordError(false);
      setChanged(path === 'admin/change-password');
      if (path !== 'auth/sign-in/username') client.setQueryData(sessionKey, null);
      await session.refetch();
    },
  });
  const user = session.data?.user;
  function submit(event: FormEvent<HTMLFormElement>, change = false) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const password = String(values.get('password'));
    if (
      change &&
      (password !== values.get('confirm') || password.length < 12 || password.length > 128)
    ) {
      setPasswordError(true);
      return;
    }
    setPasswordError(false);
    auth.mutate(
      change
        ? {
            path: 'admin/change-password',
            body: { currentPassword: values.get('current'), newPassword: password },
          }
        : {
            path: 'auth/sign-in/username',
            body: { username: String(values.get('username')).trim(), password },
          },
    );
  }
  const invalidSignIn =
    auth.variables?.path === 'auth/sign-in/username' &&
    auth.error instanceof ApiError &&
    auth.error.status >= 400 &&
    auth.error.status < 500;
  return (
    <section
      className="module-surface faculty-student-affairs"
      lang={language}
      dir={language === 'ar' ? 'rtl' : 'ltr'}
    >
      <header className="module-header">
        <h1>{t(title)}</h1>
        <ModuleHeaderActions
          sessionControls={
            user && (
              <ModuleSessionControls username={user.username || user.name}>
                <Button
                  type="button"
                  variant="outline"
                  disabled={auth.isPending}
                  onClick={() => auth.mutate({ path: 'auth/sign-out', body: {} })}
                >
                  {t('Sign out')}
                </Button>
              </ModuleSessionControls>
            )
          }
        >
          <Button
            type="button"
            variant="outline"
            lang={language === 'ar' ? 'en' : 'ar'}
            onClick={switchLanguage}
          >
            {language === 'ar' ? 'English' : 'العربية'}
          </Button>
        </ModuleHeaderActions>
      </header>
      <Resource query={session}>
        {(record) =>
          !record?.user ? (
            <form className="module-auth sta-panel sta-stack" onSubmit={submit}>
              <h2>{t('Sign in')}</h2>
              {changed && <p role="status">{t('Sign in again with your new password.')}</p>}
              <Field label={t('Username')}>
                <Input name="username" autoComplete="username" required />
              </Field>
              <Field label={t('Password')}>
                <Input name="password" type="password" autoComplete="current-password" required />
              </Field>
              {invalidSignIn ? (
                <p role="alert">{t('Invalid username or password.')}</p>
              ) : (
                <ErrorMessage error={auth.error} />
              )}
              <Button disabled={auth.isPending}>{t('Sign in')}</Button>
            </form>
          ) : (
            <div className="sta-stack" key={record.user.id}>
              <ErrorMessage error={auth.error} />
              {!record.user.enabled ? (
                <p role="alert">{t('Account disabled')}</p>
              ) : record.user.mustChangePassword ? (
                <form
                  className="module-auth sta-panel sta-stack"
                  onSubmit={(event) => submit(event, true)}
                >
                  <h2>{t('Change password')}</h2>
                  <Field label={t('Current password')}>
                    <Input
                      name="current"
                      type="password"
                      autoComplete="current-password"
                      required
                    />
                  </Field>
                  <Field label={t('New password')}>
                    <Input name="password" type="password" autoComplete="new-password" required />
                  </Field>
                  <Field label={t('Confirm password')}>
                    <Input name="confirm" type="password" autoComplete="new-password" required />
                  </Field>
                  {passwordError && (
                    <p role="alert">{t('Passwords must match and contain 12–128 characters.')}</p>
                  )}
                  <Button disabled={auth.isPending}>{t('Change password')}</Button>
                </form>
              ) : !record.user.approved ? (
                <p role="status">{t('Awaiting approval')}</p>
              ) : (
                children
              )}
            </div>
          )
        }
      </Resource>
    </section>
  );
}

export function StudentAffairsSession({
  title,
  children,
}: {
  title: 'Student Affairs' | 'Department';
  children: ReactNode;
}) {
  const [client] = useState(createClient);
  const { language, setLanguage } = useFacultyLanguage();
  const switchLanguage = () => setLanguage(language === 'ar' ? 'en' : 'ar');
  return (
    <QueryClientProvider client={client}>
      <LanguageContext.Provider value={language}>
        <Shell switchLanguage={switchLanguage} title={title}>
          {children}
        </Shell>
      </LanguageContext.Provider>
    </QueryClientProvider>
  );
}

export default function App() {
  return (
    <StudentAffairsSession title="Student Affairs">
      <Workspace />
    </StudentAffairsSession>
  );
}
