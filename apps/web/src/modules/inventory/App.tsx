import { useState, type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider, useTranslation } from 'react-i18next';
import { DirectionProvider } from '@radix-ui/react-direction';
import { Navigate, NavLink, Route, Routes, useLocation, useParams } from 'react-router';
import { ModuleHeaderActions } from '../../components/ModuleDirectoryLink';
import { createClient, useResource, workflow, type Capabilities } from './lib/api';
import { i18n, useLanguage } from './lib/i18n';
import { Auth } from './components/auth';
import { Resource } from './components/common';
import { Button } from './components/ui/button';
import {
  AssetsPage,
  HistoryPage,
  MyItemsPage,
  operations,
  StockPage,
  TransactionPage,
} from './pages/reads';
import { SettingsPage, TransactionForm } from './pages/write';
import {
  InboxPage,
  InstancePage,
  MonitorPage,
  NewProposalPage,
  ProposalPage,
  TaskPage,
} from './pages/workflow';
import './index.css';

function Permit({ allow, children }: { allow: boolean; children: ReactNode }) {
  const { t } = useTranslation();
  return allow ? children : <p role="alert">{t('Access denied')}</p>;
}
function NewTransaction({ access }: { access: Capabilities }) {
  const { t } = useTranslation();
  const { type } = useParams();
  const { key, state } = useLocation();
  const kind = operations.find((candidate) => candidate === type);
  return kind ? (
    <Permit allow={access.read && (kind === 'disposal' ? access.dispose : access.postTransactions)}>
      <TransactionForm key={key} kind={kind} selected={state} />
    </Permit>
  ) : (
    <p role="alert">{t('Page not found')}</p>
  );
}

function Workspace() {
  const { t } = useTranslation();
  const query = useResource<Capabilities>('inventory/capabilities', true, true);
  return (
    <Resource query={query}>
      {(access) => (
        <>
          <nav className="module-navigation" aria-label={t('Inventory')}>
            <NavLink to="/inventory/my-items">{t('My Items')}</NavLink>
            {access.read && (
              <>
                <NavLink to="/inventory/assets">{t('Assets')}</NavLink>
                <NavLink to="/inventory/stock">{t('Stock')}</NavLink>
                <NavLink to="/inventory/transactions">{t('Transactions')}</NavLink>
                {access.configure && <NavLink to="/inventory/settings">{t('Settings')}</NavLink>}
              </>
            )}
            <NavLink to={`${workflow}/tasks`}>{t('Task inbox')}</NavLink>
            {access.monitorWorkflows && (
              <NavLink to={`${workflow}/monitor`}>{t('Monitor')}</NavLink>
            )}
            {access.requestRemoval && (
              <NavLink to={`${workflow}/removal-requests/new`}>
                {t('Propose asset removal')}
              </NavLink>
            )}
          </nav>
          <Routes>
            <Route
              index
              element={
                <Navigate
                  replace
                  to={
                    access.read
                      ? 'assets'
                      : access.hasEmployeeProfile
                        ? 'my-items'
                        : 'workflow/tasks'
                  }
                />
              }
            />
            <Route path="my-items" element={<MyItemsPage />} />
            <Route
              path="assets"
              element={
                <Permit allow={access.read}>
                  <AssetsPage post={access.postTransactions} />
                </Permit>
              }
            />
            <Route
              path="stock"
              element={
                <Permit allow={access.read}>
                  <StockPage post={access.postTransactions} />
                </Permit>
              }
            />
            <Route
              path="transactions"
              element={
                <Permit allow={access.read}>
                  <HistoryPage post={access.postTransactions} dispose={access.dispose} />
                </Permit>
              }
            />
            <Route
              path="transactions/:id"
              element={
                <Permit allow={access.read}>
                  <TransactionPage />
                </Permit>
              }
            />
            <Route path="transactions/new/:type" element={<NewTransaction access={access} />} />
            <Route
              path="settings"
              element={
                <Permit allow={access.read && access.configure}>
                  <SettingsPage />
                </Permit>
              }
            />
            <Route path="workflow/tasks" element={<InboxPage />} />
            <Route path="workflow/tasks/:id" element={<TaskPage />} />
            <Route path="workflow/instances/:id" element={<InstancePage />} />
            <Route
              path="workflow/monitor"
              element={
                <Permit allow={access.monitorWorkflows}>
                  <MonitorPage />
                </Permit>
              }
            />
            <Route
              path="workflow/removal-requests/new"
              element={
                <Permit allow={access.requestRemoval}>
                  <NewProposalPage />
                </Permit>
              }
            />
            <Route path="workflow/removal-requests/:id" element={<ProposalPage />} />
            <Route path="*" element={<p role="alert">{t('Page not found')}</p>} />
          </Routes>
        </>
      )}
    </Resource>
  );
}

function Layout() {
  const { t } = useTranslation();
  const { language, change } = useLanguage();
  const dir = language === 'ar' ? 'rtl' : 'ltr';
  return (
    <DirectionProvider dir={dir}>
      <section className="faculty-inventory module-surface" lang={language} dir={dir}>
        <Auth
          renderHeader={(sessionControls) => (
            <header className="module-header">
              <h1>{t('Inventory')}</h1>
              <ModuleHeaderActions sessionControls={sessionControls}>
                <Button
                  type="button"
                  variant="outline"
                  lang={language === 'ar' ? 'en' : 'ar'}
                  onClick={() => change(language === 'ar' ? 'en' : 'ar')}
                >
                  {language === 'ar' ? 'English' : 'العربية'}
                </Button>
              </ModuleHeaderActions>
            </header>
          )}
        >
          <Workspace />
        </Auth>
      </section>
    </DirectionProvider>
  );
}
export default function App() {
  const [client] = useState(createClient);
  return (
    <QueryClientProvider client={client}>
      <I18nextProvider i18n={i18n}>
        <Layout />
      </I18nextProvider>
    </QueryClientProvider>
  );
}
